import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { AttachmentBuilder, GuildTextBasedChannel, Message, User } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { Logger } from 'tslog';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { TYPES } from '@src/types';
import { TextHelper } from '@src/helpers/text.helper';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import * as Buffer from 'buffer';
import { ChannelService } from '@src/infrastructure/services/channel.service';

@injectable()
export class StaffMailCloseCommand implements ICommand {
    name: string = 'close';
    description: string =
        'Closes a staff mail channel. Reasons are not disclosed to the user. Use `silentclose` to close it without sending a message to the user.';
    usageHint: string = '<reason>';
    examples: string[] = ['Closing because of inactivity.', 'Crowns unban request, granted.'];
    permissionLevel = CommandPermissionLevel.Administrator;
    aliases = ['silentclose'];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<StaffMailCloseCommand>;
    channelService: ChannelService;
    private loggingService: LoggingService;
    private staffmailRepository: StaffMailRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StaffMailCloseCommand>,
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.ChannelService) channelService: ChannelService
    ) {
        this.channelService = channelService;
        this.loggingService = loggingService;
        this.logger = logger;
        this.staffmailRepository = staffMailRepository;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        this.logger.info(
            `New staffmail close request by user ${TextHelper.userLog(message.author)} for channel ID ${message.channelId}.`
        );
        const isSilentClose = message.content.match(this.aliases[0]) != null;
        const deleted = await this.staffmailRepository.deleteStaffMail(message.channelId);
        const isAnonymous = deleted?.mode === StaffMailModeEnum.ANONYMOUS;
        if (deleted == null) {
            return {
                isSuccessful: false,
                reason: `Cannot find a staff mail for channel ID ${message.channelId}`,
                replyToUser: `You are not in a staff mail channel! Please run this command in a staff mail channel.`,
            };
        }
        if (deleted.user == null) {
            this.logger.debug(
                `User with ID ${deleted.userId} has left the server. StaffMail channel was closed regardless.`
            );
            return {};
        }

        if (!isSilentClose) {
            try {
                await deleted.user.send({
                    embeds: [EmbedHelper.getStaffMailCloseEmbed(deleted.summary, deleted.type, args.join(' '))],
                });
            } catch (e) {
                this.logger.warn(`Could not send closing message to user.`, e);
                return {
                    isSuccessful: false,
                    replyToUser: `I could not send the closing message to the user. Perhaps they have their DMs closed (or have blocked me 😭). `,
                };
            }
        } else {
            this.logger.info(`Close command is silent, so I've skipped sending a message to the user.`);
        }

        try {
            const oldStaffMailEmbed = await this.channelService.getMessageFromChannelByMessageId(
                deleted.lastMessageId,
                deleted.user.dmChannel!
            );
            await oldStaffMailEmbed?.unpin();
        } catch (e) {
            this.logger.warn(`Could not unpin old staffmail message.`, e);
        }

        this.logger.debug(`Staffmail channel was closed.`);

        const protocol = await this.getChannelProtocol(
            message.channel as GuildTextBasedChannel,
            isAnonymous ? null : deleted.user
        );

        await this.loggingService.logStaffMailEvent(
            false,
            deleted.summary,
            deleted.type,
            isAnonymous ? null : deleted.user,
            message.author,
            args.join(' '),
            [protocol]
        );

        await this.staffmailRepository.deleteStaffMailChannel(message.channelId);

        return {};
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }

    private async getChannelProtocol(channel: GuildTextBasedChannel, user: User | null): Promise<AttachmentBuilder> {
        const messages = Array.from((await channel.messages.fetch()).values());
        messages.sort((a, b) => (a.createdTimestamp > b.createdTimestamp ? 0 : -1));
        let protocol = '';
        messages.forEach((message) => {
            let sender = `${message.author.username} | ${message.author.id}`;
            let recipient = '';
            if (message.author.bot && message.embeds.length > 0) {
                if (message.embeds[message.embeds.length - 1].title?.startsWith('📥')) {
                    sender = message.embeds[message.embeds.length - 1].footer?.text ?? '???';
                    recipient = 'Staff';
                } else {
                    sender = message.embeds[message.embeds.length - 1].footer?.text ?? '???';
                    recipient = user ? `${user.username} | (${user.id})` : `Anonymous User`;
                }
            }
            let content = message.content;

            if (message.embeds.length > 0) {
                content = message.embeds[message.embeds.length - 1].description ?? '';
            }
            if (message.attachments.size > 0) {
                content += ` (Attachments: `;
                const attachmentUrls: string[] = [];
                message.attachments.forEach((a) => attachmentUrls.push(a.url));
                content += attachmentUrls.join(' ; ');
                content += `)`;
            }
            protocol += `[${sender}${recipient !== '' ? ` -> ${recipient}` : ''}]: ${content}\n`;
        });

        return new AttachmentBuilder(Buffer.Buffer.from(protocol, 'utf-8'), { name: 'protocol.txt' });
    }
}
