import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { StaffMailCustomIds } from '@src/feature/interactions/models/staff-mail-custom-ids';
import { StaffMailType } from '@src/feature/interactions/models/staff-mail-type';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import {
    bold,
    ButtonInteraction,
    Client,
    codeBlock,
    EmbedBuilder,
    GuildMember,
    Interaction,
    Message,
    MessageContextMenuCommandInteraction,
    MessageReplyOptions,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class StaffMailReportCommand implements ICommand {
    name: string = 'report';
    description: string = 'Quickly reports something to staff. You can include pictures.';
    usageHint: string = '<message>';
    examples: string[] = ['user abc123 is trolling in the general channel'];
    permissionLevel = CommandPermissionLevel.User;
    aliases = [];
    isUsableInDms = true;
    isUsableInServer = false;

    private logger: Logger<StaffMailReportCommand>;
    usersRepository: UsersRepository;
    loggingService: LoggingService;
    staffMailRepository: StaffMailRepository;
    memberService: MemberService;
    private env: Environment;
    private client: Client;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StaffMailReportCommand>,
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.usersRepository = usersRepository;
        this.loggingService = loggingService;
        this.staffMailRepository = staffMailRepository;
        this.memberService = memberService;
        this.env = env;
        this.client = client;
        this.logger = logger;
    }

    public async run(message: Message): Promise<CommandResult> {
        this.logger.info(`New staff mail command report received.`);
        const member = await this.memberService.getGuildMemberFromUserId(message.author.id);
        if (!member)
            return {
                isSuccessful: false,
                reason: `Cannot find guild member for this interaction`,
            };

        return await this.createNewStaffMailReport(message, message, member);
    }

    async runInteraction(interaction: MessageContextMenuCommandInteraction): Promise<CommandResult> {
        this.logger.info(`New staff mail interaction report received.`);
        if (!interaction.member)
            return {
                isSuccessful: false,
                reason: `Cannot find guild member for this interaction`,
            };
        return await this.createNewStaffMailReport(
            interaction,
            interaction.targetMessage,
            interaction.member as GuildMember
        );
    }

    public validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(
                `No args provided for report.`,
                `Please enter your report right after the command!`
            );
        }
        return Promise.resolve();
    }

    private async createNewStaffMailReport(
        trigger: Message | MessageContextMenuCommandInteraction,
        reportedMessage: Message,
        reporter: GuildMember
    ): Promise<CommandResult> {
        const isInteraction = trigger instanceof MessageContextMenuCommandInteraction;
        let createMessage: Message;
        if (!isInteraction)
            createMessage = await trigger.reply(
                EmbedHelper.getStaffMailUrgentReportEmbed(
                    isInteraction,
                    Array.from(trigger.attachments.values()),
                    trigger.content.split(' ').slice(1).join(' ')
                ) as MessageReplyOptions
            );
        else
            createMessage = await trigger.editReply(
                EmbedHelper.getStaffMailUrgentReportEmbed(
                    isInteraction,
                    Array.from(trigger.targetMessage.attachments.values()),
                    trigger.targetMessage.content
                ) as MessageReplyOptions
            );

        // User needs to confirm or cancel
        const collectorFilter = (interaction: Interaction) =>
            isInteraction ? interaction.user.id === trigger.member?.user.id : interaction.user.id === trigger.author.id;
        let sendInteraction: ButtonInteraction;
        try {
            sendInteraction = (await createMessage.awaitMessageComponent({
                filter: collectorFilter,
                time: 120_000,
            })) as ButtonInteraction;
        } catch (e) {
            this.logger.info(`Staff mail urgent report has timed out.`);
            const content = `Request timed out after 2 minutes.`;
            if (isInteraction) return { replyToUser: content };
            await createMessage.edit({ content: content, embeds: [], components: [] });
            return {};
        }

        if (sendInteraction.customId === StaffMailCustomIds.CancelButton) {
            this.logger.info(`User has cancelled sending a staff mail urgent report.`);
            const content = `You've cancelled the report to staff.`;
            if (isInteraction) return { replyToUser: content };
            await createMessage.edit({ content: content, embeds: [], components: [] });
            return {};
        }

        if (
            sendInteraction.customId === StaffMailCustomIds.UrgentReportSendButton ||
            sendInteraction.customId === StaffMailCustomIds.UrgentReportSendAnonButton
        ) {
            try {
                if (!sendInteraction.deferred) await sendInteraction.deferUpdate({});
                await this.sendUrgentReport(
                    reportedMessage,
                    reporter,
                    sendInteraction.customId === StaffMailCustomIds.UrgentReportSendAnonButton,
                    isInteraction
                );
            } catch (e) {
                this.logger.error(
                    `Something went wrong while trying to send an urgent report by user ${reporter.user.username}`,
                    e
                );
                return {
                    isSuccessful: false,
                };
            }
        }

        if (!isInteraction) await createMessage.delete();

        return {
            isSuccessful: true,
        };
    }

    private async sendUrgentReport(
        reportedMessage: Message,
        reporter: GuildMember,
        isAnonymous: boolean,
        isContextMenuReport: boolean
    ) {
        const mode = isAnonymous ? StaffMailModeEnum.ANONYMOUS : StaffMailModeEnum.NAMED;
        const category = StaffMailType.UrgentReport;
        this.logger.debug(
            `Interaction is of category ${category} and mode ${mode}. Creating StaffMail Urgent Report...`
        );
        const staffMailChannel = await this.staffMailRepository.createStaffMailChannel(reporter.user, mode);

        const text = isContextMenuReport
            ? 'Message reported via context menu.\n\n' +
              `${bold('Content:')} ${codeBlock(reportedMessage.content)}\n` +
              `${bold('Link:')} ${TextHelper.getDiscordMessageLink(reportedMessage)}`
            : reportedMessage.content.slice(reportedMessage.content.indexOf(' '));

        let rolePings = '';
        this.env.STAFFMAIL.PING_ROLE_IDS.forEach((id) => (rolePings += `<@&${id}> `));
        const embeds: EmbedBuilder[] = [];
        embeds.push(
            EmbedHelper.getStaffMailStaffViewNewEmbed(
                isAnonymous ? null : reporter.user,
                isAnonymous ? null : reporter.user,
                category,
                null,
                this.env.CORE.PREFIX
            )
        );
        if (!isAnonymous) {
            if (!isAnonymous) {
                // Attach information about user
                const indexedUser = await this.usersRepository.getUserByUserId(reporter.user.id);
                embeds.push(EmbedHelper.getDiscordMemberEmbed(reporter.user.id, reporter ?? undefined));
                embeds.push(EmbedHelper.getVerificationHistoryEmbed(indexedUser?.verifications ?? []));
                embeds.push(EmbedHelper.getCrownsEmbed(indexedUser ?? undefined));
            }
        }

        await staffMailChannel!.send({
            content: `${rolePings} New StaffMail: Urgent Report`,
            embeds: embeds,
        });

        await staffMailChannel!.send({
            embeds: [EmbedHelper.getStaffMailStaffViewIncomingEmbed(isAnonymous ? null : reporter.user, text)],
            files: reportedMessage.attachments.map((a) => a.proxyURL),
        });

        this.logger.debug(`StaffMail channel is set up. Sending response to user...`);
        const openedStaffMailMessage = await reporter.user.send({
            components: [],
            embeds: [EmbedHelper.getStaffMailOpenEmbed(false), EmbedHelper.getStaffMailLinkToLatestMessage()],
        });
        const outgoingMessage = await reporter.user.send({
            embeds: [
                EmbedHelper.getStaffMailUserViewOutgoingEmbed(
                    reporter.user,
                    mode === StaffMailModeEnum.ANONYMOUS,
                    text,
                    null,
                    category
                ),
            ],
            files: reportedMessage.attachments.map((a) => a.proxyURL),
        });
        await openedStaffMailMessage?.edit({
            embeds: [openedStaffMailMessage?.embeds[0], EmbedHelper.getStaffMailLinkToLatestMessage(outgoingMessage)],
        });
        openedStaffMailMessage?.pin();
        this.logger.debug(`Response to user sent, saving StaffMail...`);
        await this.staffMailRepository.createStaffMail(
            reporter.user,
            category,
            mode,
            null,
            openedStaffMailMessage,
            outgoingMessage,
            staffMailChannel
        );

        await this.loggingService.logStaffMailEvent(
            true,
            null,
            category,
            mode === StaffMailModeEnum.NAMED ? reporter.user : null,
            mode === StaffMailModeEnum.NAMED ? reporter.user : null,
            null
        );
    }
}
