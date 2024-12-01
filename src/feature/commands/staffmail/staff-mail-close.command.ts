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
import * as moment from 'moment';

@injectable()
export class StaffMailCloseCommand implements ICommand {
    name: string = 'close';
    description: string =
        'Closes a staff mail channel. Reasons are not disclosed to the user. Use `silentclose` to close it without sending a message to the user.';
    usageHint: string = '<reason>';
    examples: string[] = ['Closing because of inactivity.', 'Crowns unban request, granted.'];
    permissionLevel = CommandPermissionLevel.Moderator;
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
        const staffMail = await this.staffmailRepository.getStaffMailByChannelId(message.channelId);
        const isAnonymous = staffMail?.mode === StaffMailModeEnum.ANONYMOUS;
        if (!staffMail) {
            return {
                isSuccessful: false,
                reason: `Cannot find a staff mail for channel ID ${message.channelId}`,
                replyToUser: `You are not in a staff mail channel! Please run this command in a staff mail channel.`,
            };
        }

        let logNote = '';
        if (!isSilentClose) {
            if (staffMail.user != null) {
                try {
                    await staffMail.user.send({
                        embeds: [EmbedHelper.getStaffMailCloseEmbed(staffMail.summary, staffMail.type, args.join(' '))],
                    });
                } catch (e) {
                    this.logger.warn(`Could not send closing message to user.`, e);
                    return {
                        isSuccessful: false,
                        replyToUser: `I could not send the closing message to the user. Perhaps they have their DMs closed (or have blocked me 😭). `,
                    };
                }

                try {
                    const oldStaffMailEmbed = await this.channelService.getMessageFromChannelByMessageId(
                        staffMail.mainMessageId,
                        staffMail.user.dmChannel!
                    );
                    await oldStaffMailEmbed?.unpin();
                } catch (e) {
                    this.logger.warn(`Could not unpin old staffmail message.`, e);
                }
            } else {
                this.logger.info(
                    `User with ID ${staffMail.userId} has left the server. StaffMail channel was closed regardless.`
                );
                logNote = `User left, user was not notified of closing.`;
            }
        } else {
            this.logger.info(`Close command is silent, so I've skipped sending a message to the user.`);
            logNote = `Silent close, user was not notified of closing.`;
        }

        this.logger.debug(`Staffmail channel was closed.`);

        const protocol = await this.getChannelProtocol(
            message.channel as GuildTextBasedChannel,
            isAnonymous ? null : staffMail.user
        );

        await this.loggingService.logStaffMailEvent(
            false,
            staffMail.summary,
            staffMail.type,
            isAnonymous ? null : staffMail.user,
            message.author,
            args.join(' '),
            [protocol],
            logNote
        );

        // await this.staffmailRepository.deleteStaffMailChannel(message.channelId);

        // await this.staffmailRepository.deleteStaffMail(message.channelId)

        return {};
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }

    private async getChannelProtocol(channel: GuildTextBasedChannel, user: User | null): Promise<AttachmentBuilder> {
        let isDone = false;
        let lastMessageId =
            channel.messages.cache.last()?.id || (await channel.messages.fetch({ limit: 1 })).last()?.id;
        let messages: Message[] = [];
        do {
            const fetchedMessages = Array.from(
                (await channel.messages.fetch({ limit: 100, before: lastMessageId })).values()
            );
            this.logger.debug(`Fetched ${fetchedMessages.length} messages.`);
            if (fetchedMessages.length > 0) messages = messages.concat(fetchedMessages);
            if (fetchedMessages.length < 100) isDone = true;
            lastMessageId = fetchedMessages[fetchedMessages.length - 1].id;
        } while (!isDone);

        messages.sort((a, b) => (a.createdTimestamp > b.createdTimestamp ? 0 : -1));
        this.logger.debug(`Writing ${messages.length} messages to the protocol.`);
        let protocol = '';
        messages.forEach((message) => {
            const date = moment(message.createdAt).format('YYYY-MM-DD HH:mm:ss');
            let sender = message.author.username;
            let recipient = '';
            if (message.author.bot && message.embeds.length == 1) {
                const footer = message.embeds[0].footer?.text.slice(0, message.embeds[0].footer?.text.indexOf('|') - 1);
                if (message.embeds[message.embeds.length - 1].title?.startsWith('📥')) {
                    sender = footer ?? '???';
                    recipient = 'Staff';
                } else {
                    sender = footer + ' (Staff)' ?? '???';
                    recipient = user ? user.username : `Anonymous User`;
                }
            }
            let content = message.content;

            if (message.embeds.length > 0) {
                content = message.embeds[message.embeds.length - 1].description ?? '';
            }
            if (message.attachments.size > 0) {
                content += ` (Attachments: `;
                const attachmentUrls: string[] = [];
                message.attachments.forEach((a) => attachmentUrls.push(a.proxyURL));
                content += attachmentUrls.join(' ; ');
                content += `)`;
            }
            protocol += `[${date}] ${sender}${recipient !== '' ? ` -> ${recipient}` : ''}: ${content}\n`;
        });

        return new AttachmentBuilder(Buffer.Buffer.from(protocol, 'utf-8'), { name: 'protocol.txt' });
    }
}
