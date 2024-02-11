import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Message, MessageResolvable, MessageType } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { Logger } from 'tslog';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { TYPES } from '@src/types';
import { TextHelper } from '@src/helpers/text.helper';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StaffMailModeEnum } from '@src/feature/staffmail/models/staff-mail-mode.enum';

@injectable()
export class StaffMailReplyCommand implements ICommand {
    name: string = 'reply';
    description: string =
        'Replies to the StaffMail. Must be used in StaffMail channel. Use areply to reply anonymously.';
    usageHint: string = '<message to user>';
    examples: string[] = ['Hi, thank you for reaching out!'];
    permissionLevel = CommandPermissionLevel.Staff;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<StaffMailReplyCommand>;
    private staffMailRepository: StaffMailRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StaffMailReplyCommand>,
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository
    ) {
        this.logger = logger;
        this.staffMailRepository = staffMailRepository;
    }

    // TODO: Support anonymous reply
    async run(message: Message, args: string[]): Promise<CommandResult> {
        this.logger.trace(args);
        this.logger.info(
            `New staffmail reply by user ${TextHelper.userLog(message.author)} for channel ID ${message.channelId}.`
        );
        const staffMail = await this.staffMailRepository.getStaffMailByChannelId(message.channelId);
        if (!staffMail) {
            throw new ValidationError(
                new Error(`No StaffMail in DB for channel ID ${message.channelId}.`),
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
        const messageToUser = await staffMail.user?.send({
            embeds: [
                EmbedHelper.getStaffMailUserViewIncomingEmbed(
                    message.author,
                    false,
                    args.join(' '),
                    staffMail.summary,
                    staffMail.type
                ),
            ],
        });

        await (await staffMail.user.dmChannel?.messages.fetch(staffMail.lastMessageId as MessageResolvable))?.unpin();
        await messageToUser.pin();
        await staffMail.user.dmChannel?.messages.cache
            .filter((m: Message) => (m.type = MessageType.ChannelPinnedMessage))
            .last()
            ?.delete();

        this.logger.debug(`Updating staff mail in DB and staff mail channel...`);
        await this.staffMailRepository.updateStaffMailLastMessageId(staffMail.id, messageToUser.id);

        await staffMail.channel!.send({
            embeds: [
                EmbedHelper.getStaffMailStaffViewOutgoingEmbed(
                    message.author,
                    false,
                    staffMail.mode === StaffMailModeEnum.ANONYMOUS ? null : staffMail.user,
                    args.join(' ')
                ),
            ],
        });
        await message.delete();

        return {};
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}
