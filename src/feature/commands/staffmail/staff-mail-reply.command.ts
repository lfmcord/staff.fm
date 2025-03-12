import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { StaffMail } from '@src/infrastructure/repositories/models/staff-mail.model';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { TYPES } from '@src/types';
import { Embed, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class StaffMailReplyCommand implements ICommand {
    name: string = 'reply';
    description: string =
        'Replies to the StaffMail. Must be used in StaffMail channel. Use areply to reply anonymously.';
    usageHint: string = '<message to user>';
    examples: string[] = ['Hi, thank you for reaching out!'];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = ['areply'];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<StaffMailReplyCommand>;
    channelService: ChannelService;
    private staffMailRepository: StaffMailRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StaffMailReplyCommand>,
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.ChannelService) channelService: ChannelService
    ) {
        this.channelService = channelService;
        this.logger = logger;
        this.staffMailRepository = staffMailRepository;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        this.logger.info(
            `New staffmail reply by user ${TextHelper.userLog(message.author)} for channel ID ${message.channelId}.`
        );
        if (args.length === 0 && message.attachments.size === 0)
            throw new ValidationError(`Empty reply args and no attachment.`, `You have to provide a reply!`);
        const isAnonReply = message.content.match(this.aliases[0]) != null;
        const staffMail: StaffMail | null = await this.staffMailRepository.getStaffMailByChannelId(message.channelId);
        if (!staffMail) {
            throw new ValidationError(
                `No StaffMail in DB for channel ID ${message.channelId}.`,
                'You can only use this command in an open StaffMail channel!'
            );
        }

        if (!staffMail.user) {
            return {
                isSuccessful: false,
                reason: `User with user ID ${staffMail.userId} has left the guild.`,
                replyToUser: `This user seems to have left the server. You can close this StaffMail.`,
            };
        }

        this.logger.debug(
            `Preparing message to user ${staffMail.mode != StaffMailModeEnum.ANONYMOUS ? TextHelper.userLog(staffMail.user) : ''}.`
        );

        let messageToUser;
        try {
            messageToUser = await staffMail.user?.send({
                embeds: [
                    EmbedHelper.getStaffMailUserViewIncomingEmbed(
                        isAnonReply ? null : message.author,
                        staffMail.mode === StaffMailModeEnum.ANONYMOUS,
                        args.join(' '),
                        staffMail.summary,
                        staffMail.type
                    ),
                ],
                files: message.attachments.map((a) => a.proxyURL),
            });
        } catch (e) {
            this.logger.warn(`Could not send message to user ${TextHelper.userLog(staffMail.user)}.`, e);
            return {
                isSuccessful: false,
                replyToUser: `I could not send a message to the user. They most likely have their DMs turned off.`,
            };
        }

        try {
            let mainMessage =
                (await this.channelService.getMessageFromChannelByMessageId(
                    staffMail.mainMessageId,
                    staffMail.user.dmChannel!
                )) ?? undefined;
            mainMessage = await mainMessage?.edit({
                embeds: [mainMessage?.embeds[0], EmbedHelper.getStaffMailLinkToLatestMessage(messageToUser)],
            });
            const oldStaffMailMessage =
                staffMail.mainMessageId === staffMail.lastMessageId
                    ? mainMessage
                    : await this.channelService.getMessageFromChannelByMessageId(
                          staffMail.lastMessageId,
                          staffMail.user.dmChannel!
                      );
            const newEmbeds: Embed[] =
                oldStaffMailMessage?.embeds.map((e: Embed) => {
                    return { ...e.data, footer: undefined } as unknown as Embed;
                }) ?? oldStaffMailMessage!.embeds;
            await oldStaffMailMessage?.edit({ embeds: newEmbeds });
        } catch (e) {
            this.logger.warn(`Could not edit old staff mail embeds.`, e);
        }

        this.logger.debug(`Updating staff mail in DB and staff mail channel...`);
        await this.staffMailRepository.updateStaffMailLastMessageId(staffMail.id, messageToUser.id);

        // TODO: Catch 403 case
        await staffMail.channel!.send({
            embeds: [
                EmbedHelper.getStaffMailStaffViewOutgoingEmbed(
                    message.author,
                    isAnonReply,
                    staffMail.mode === StaffMailModeEnum.ANONYMOUS ? null : staffMail.user,
                    args.join(' ')
                ),
            ],
            files: Array.from(message.attachments.values()),
        });
        await message.delete();

        return {};
    }

    validateArgs(args: string[]): Promise<void> {
        return Promise.resolve();
    }
}
