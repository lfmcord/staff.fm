import { Constants } from '@models/constants';
import { Environment } from '@models/environment';
import { Verification } from '@src/feature/commands/administration/models/verification.model';
import { Flag } from '@src/feature/commands/moderation/models/flag.model';
import { ComponentHelper } from '@src/helpers/component.helper';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { LogLevel } from '@src/helpers/models/LogLevel';
import { TextHelper } from '@src/helpers/text.helper';
import { IDiscussionsModel } from '@src/infrastructure/repositories/discussions.repository';
import { CachedAttachmentModel } from '@src/infrastructure/repositories/models/cached-attachment.model';
import { CachedMessageModel } from '@src/infrastructure/repositories/models/cached-message.model';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { TYPES } from '@src/types';
import {
    AttachmentBuilder,
    bold,
    Client,
    codeBlock,
    EmbedBuilder,
    GuildMember,
    GuildTextBasedChannel,
    inlineCode,
    italic,
    Message,
    User,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { getInfo } from 'lastfm-typed/dist/interfaces/userInterface';
import { extension } from 'mime-types';
import { Logger } from 'tslog';
import moment = require('moment');

@injectable()
export class LoggingService {
    private client: Client;
    private channelService: ChannelService;
    env: Environment;
    private logger: Logger<LoggingService>;

    constructor(
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.ChannelService) channelService: ChannelService,
        @inject(TYPES.InfrastructureLogger) logger: Logger<LoggingService>,
        @inject(TYPES.Client) client: Client
    ) {
        this.env = env;
        this.client = client;
        this.logger = logger;
        this.channelService = channelService;
    }

    public async logDeletedMessage(deletedMessage: CachedMessageModel, author: User | null, actor: User | null) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.DELETED_MESSAGE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const logEmbed = new EmbedBuilder()
            .setColor(EmbedHelper.red)
            .setFooter({ text: `Message ID: ${deletedMessage.messageId}` })
            .setTimestamp();

        let description = `${Constants.Deletion} Message from ${TextHelper.userDisplay(author, false)} deleted `;
        if (actor) description += `by ${TextHelper.userDisplay(actor, false)} `;
        description += `in <#${deletedMessage.channelId}>`;
        if (deletedMessage.contents !== '') description += `:\n${codeBlock(deletedMessage.contents)}`;

        logEmbed.setDescription(description);

        let attachments: AttachmentBuilder[] | string[] = [];
        if (deletedMessage.attachments.length > 0 && typeof deletedMessage.attachments[0] == 'string') {
            this.logger.trace(`attachments are urls`);
            attachments = deletedMessage.attachments as string[];
        } else {
            this.logger.trace(`attachments are cached`);
            attachments = deletedMessage.attachments.map((a) => {
                a = a as CachedAttachmentModel;
                this.logger.trace(`mapping ${a.mimeType}`);
                const ext = extension(a.mimeType);
                return new AttachmentBuilder(a.data, { name: `deleted_${ext}_${deletedMessage.messageId}.${ext}` });
            });
        }
        await logChannel.send({
            embeds: [logEmbed],
            files: attachments,
        });
    }

    public async logBulkDelete(
        deletedMessageCount: number,
        channelId: string,
        actor: GuildMember | null,
        attachment: AttachmentBuilder
    ) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.DELETED_MESSAGE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const logEmbed = new EmbedBuilder()
            .setColor(EmbedHelper.red)
            .setFooter({ text: `Channel ID: ${channelId}` })
            .setTimestamp();

        let description = `${Constants.Deletion} Bulk deleted ${deletedMessageCount} messages `;
        if (actor) description += `by ${TextHelper.userDisplay(actor?.user, false)} `;
        description += `in <#${channelId}>`;

        logEmbed.setDescription(description);

        await logChannel.send({ embeds: [logEmbed], files: [attachment] });
    }

    public async logMute(subject: User, actor: User, endsAt: Date, reason?: string) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const isSelfmute = subject.id === actor.id;

        let embed;
        if (isSelfmute) {
            const title = `${Constants.Mute} Selfmute`;
            const description =
                `${Constants.User} ${bold('User:')} ${TextHelper.userDisplay(subject)}\n` +
                `${Constants.Hourglass} ${bold('Expires:')} <t:${moment(endsAt).unix()}:R>`;
            embed = EmbedHelper.getLogEmbed(subject, subject, LogLevel.Trace)
                .setDescription(description)
                .setTitle(title);
        } else {
            const title = `${Constants.Mute} Mute`;
            const description =
                `${Constants.User} ${bold('User:')} ${TextHelper.userDisplay(subject)}\n` +
                `${Constants.Note} ${bold('Reason:')} ${reason ?? 'No reason provided.'}\n` +
                `${Constants.Hourglass} ${bold('Expires:')} <t:${moment(endsAt).unix()}:R>`;
            embed = EmbedHelper.getLogEmbed(actor, subject, LogLevel.Warning)
                .setDescription(description)
                .setTitle(title);
        }

        await logChannel.send({ embeds: [embed] });
    }

    public async logUnmute(subject: User, actor?: User, reason?: string) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const isSelfmute = subject.id === actor?.id;

        const title = isSelfmute ? `${Constants.Loud} Selfmute ended` : `${Constants.Loud} Unmute`;
        const description =
            `${Constants.User} ${bold('User:')} ${TextHelper.userDisplay(subject)}\n` +
            `${Constants.Note} ${bold('Reason:')} ${reason ?? 'No reason provided.'}\n`;
        const embed = EmbedHelper.getLogEmbed(actor ?? null, subject, LogLevel.Info)
            .setDescription(description)
            .setTitle(title);

        await logChannel.send({ embeds: [embed] });
    }

    public async logVerification(verification: Verification) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.USER_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const embeds: EmbedBuilder[] = [];
        const description = `${bold('Verified user')} ${inlineCode(verification.verifiedUser.username)} ${italic('(ID ' + verification.verifiedUser.id + ')')}`;
        embeds.push(
            EmbedHelper.getLogEmbed(verification.verifyingUser, verification.verifiedUser, LogLevel.Info)
                .setDescription(description)
                .setFields([
                    {
                        name: `Created`,
                        value: `<t:${moment(verification.verifiedUser.createdAt).unix()}:D> (<t:${moment(verification.verifiedUser.createdAt).unix()}:R>)`,
                        inline: true,
                    },
                    {
                        name: `Returning?`,
                        value: verification.isReturningUser ? `${Constants.Warning} Yes` : 'No',
                        inline: true,
                    },
                    {
                        name: `Note`,
                        value: `${verification.verificationMessage?.content ?? 'Manual Verification'}`,
                        inline: false,
                    },
                ])
        );

        if (verification.lastfmUser) {
            embeds.push(
                EmbedHelper.getLastFmUserEmbed(
                    verification.lastfmUser.name,
                    verification.lastfmUser,
                    moment().diff(moment.unix(verification.lastfmUser.registered), 'days') <
                        this.env.MISC.LASTFM_AGE_ALERT_IN_DAYS
                )
            );
        } else {
            embeds.push(new EmbedBuilder().setTitle('No Last.fm Account').setColor(EmbedHelper.blue));
        }

        await logChannel.send({ embeds: embeds });
    }

    public async logIndex(verification: Verification, reason: string) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.USER_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const embeds: EmbedBuilder[] = [];
        const description = `${bold('Indexed user')} ${inlineCode(verification.verifiedUser.username)} ${italic('(ID ' + verification.verifiedUser.id + ')')}`;
        embeds.push(
            EmbedHelper.getLogEmbed(verification.verifyingUser, verification.verifiedUser, LogLevel.Info)
                .setDescription(description)
                .setFields([
                    {
                        name: `Created`,
                        value: `<t:${moment(verification.verifiedUser.createdAt).unix()}:D> (<t:${moment(verification.verifiedUser.createdAt).unix()}:R>)`,
                        inline: true,
                    },
                    {
                        name: `Reason`,
                        value: reason == '' ? 'No reason provided.' : reason,
                        inline: false,
                    },
                ])
        );

        embeds.push(
            EmbedHelper.getLastFmUserEmbed(
                verification.lastfmUser!.name,
                verification.lastfmUser!,
                moment().diff(moment.unix(verification.lastfmUser!.registered), 'days') <
                    this.env.MISC.LASTFM_AGE_ALERT_IN_DAYS
            )
        );

        await logChannel.send({ embeds: embeds });
    }

    public async logStaffMailEvent(
        isOpen: boolean,
        summary: string | null,
        type: string,
        author: User | null,
        actor: User | null,
        reason: string | null,
        attachments: AttachmentBuilder[] = [],
        logNote: string = ''
    ) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.STAFFMAIL_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const humanReadableType = EmbedHelper.getHumanReadableStaffMailType(type);
        const fields = [{ name: 'Category', value: humanReadableType, inline: true }];
        if (summary) fields.push({ name: 'Summary', value: summary, inline: true });
        fields.push(
            { name: 'User', value: author ? TextHelper.userDisplay(author) : 'Anonymous', inline: false },
            {
                name: isOpen ? 'Created by' : 'Closed by',
                value: actor ? TextHelper.userDisplay(actor) : 'Anonymous',
                inline: false,
            }
        );
        const embed = new EmbedBuilder()
            .setColor(isOpen ? EmbedHelper.green : EmbedHelper.red)
            .setTitle(isOpen ? `New StaffMail` : `Closed StaffMail`)
            .setFields(fields)
            .setTimestamp();
        if (reason) embed.setDescription(`${bold('Reason:')} ${reason}\n\n${logNote}`);
        else if (!isOpen) embed.setDescription(`No reason provided.\n\n${logNote}`);
        await logChannel.send({
            embeds: [embed],
            files: attachments,
        });
    }

    async logLastFmAgeAlert(message: Message, lastFmUser: getInfo) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.USER_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const logEmbed = EmbedHelper.getLogEmbed(message.author, message.author, LogLevel.Warning).setDescription(
            `${TextHelper.userDisplay(message.author, false)} is trying to verify with a new Last.fm Account that is younger than 30 days: ${TextHelper.getDiscordMessageLink(message)}`
        );
        logChannel.send({ embeds: [logEmbed, EmbedHelper.getLastFmUserEmbed(lastFmUser.name, lastFmUser, true)] });
    }

    async logLastFmFlagAlert(message: Message, flag: Flag) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.BACKSTAGE_CHANNEL_ID);
        if (!logChannel) return;

        const lastFmUsername = TextHelper.getLastfmUsername(message.content);
        let description = `${TextHelper.userDisplay(message.author, true)} `;
        if (lastFmUsername) description += `is trying to verify with a Last.fm account`;
        else description += `mentioned a term`;
        description += ` that was flagged as suspicious or malicious by staff.\n\n`;
        if (lastFmUsername)
            description += `${bold(`Last.fm Link: `)} https://last.fm/user/${TextHelper.getLastfmUsername(message.content)}\n`;
        description +=
            `${bold(`Message: `)} ${TextHelper.getDiscordMessageLink(message)}\n` +
            `${bold(`Flagged term: `)} ${inlineCode(flag.term)}\n` +
            `${bold(`Reason: `)} ${flag.reason}`;

        const logEmbed = EmbedHelper.getLogEmbed(this.client.user, message.author, LogLevel.Warning)
            .setTitle(`${Constants.Warning} Last.fm Account Flagged`)
            .setDescription(description);
        logChannel.send({ embeds: [logEmbed] });
    }

    async logDiscordFlagAlert(message: Message, flag: Flag) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.BACKSTAGE_CHANNEL_ID);
        if (!logChannel) return;

        let description = `${TextHelper.userDisplay(message.author, true)} is trying to verify with a Discord account that was flagged as suspicious or malicious by staff.\n\n`;
        description +=
            `${bold(`Message: `)} ${TextHelper.getDiscordMessageLink(message)}\n` +
            `${bold(`Flagged term: `)} ${inlineCode(flag.term)}\n` +
            `${bold(`Reason: `)} ${flag.reason}`;

        const logEmbed = EmbedHelper.getLogEmbed(this.client.user, message.author, LogLevel.Warning)
            .setTitle(`${Constants.Warning} Discord Account Flagged`)
            .setDescription(description);
        logChannel.send({ embeds: [logEmbed] });
    }

    async logDuplicateLastFmUsername(message: Message, otherMembers: string[]) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.BACKSTAGE_CHANNEL_ID);
        if (!logChannel) return;

        let description =
            `${TextHelper.userDisplay(message.author, true)} is trying to verify with a Last.fm account that is already verified and tied to a different account.\n\n` +
            `${bold(`Last.fm Link: `)} https://last.fm/user/${TextHelper.getLastfmUsername(message.content)}\n` +
            `${bold(`Other users using this last.fm username:`)}\n`;

        otherMembers.forEach((memberString) => (description += `- ${memberString}\n`));

        const logEmbed = EmbedHelper.getLogEmbed(this.client.user, message.author, LogLevel.Warning)
            .setTitle(`${Constants.Warning} Last.fm Account Duplicate`)
            .setDescription(description)
            .setFooter({ text: `Please make sure they are not an alt account. When in doubt, ask staff!` });
        logChannel.send({ embeds: [logEmbed] });
    }

    async logReturningUserNote(
        user: User,
        lastFmUsername: string,
        isUsingDifferentLastfm: boolean,
        otherDiscordUsers: User[] = []
    ): Promise<void> {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.BACKSTAGE_CHANNEL_ID);
        if (!logChannel) return;

        const isCertain = otherDiscordUsers.length > 0;

        let description =
            `${TextHelper.userDisplay(user, true)} ${isCertain ? 'most likely ' : ''}is a returning member.\n\n` +
            `${bold(`Last.fm Link:`)} https://last.fm/user/${lastFmUsername}`;
        if (isUsingDifferentLastfm) description += ` (${Constants.Warning} verifying with different last.fm account)`;
        if (otherDiscordUsers.length > 0) {
            description += `\n\nPrevious Discord accounts:`;
            otherDiscordUsers.forEach((user) => {
                description += `\n- ${TextHelper.userDisplay(user, false)}`;
            });
        }

        const logEmbed = EmbedHelper.getLogEmbed(this.client.user, user, LogLevel.Info)
            .setTitle(`${Constants.Information} Returning member${isCertain ? '?' : ''}`)
            .setDescription(description)
            .setFooter({ text: `Welcome back${isCertain ? '?' : '! 🎉'}` });
        logChannel.send({ embeds: [logEmbed] });
    }

    async logZeroPlaycountVerification(user: User, lastFmUsername: string) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.BACKSTAGE_CHANNEL_ID);
        if (!logChannel) return;

        const description =
            `Last.fm returned a playcount of 0 for ${TextHelper.userDisplay(user, true)}. If this is incorrect, please rerun the verify command or ask a Helper to fix the scrobble roles.\n\n` +
            `${bold(`Last.fm Link: `)} https://last.fm/user/${lastFmUsername}\n`;

        const footer = `Please dismiss this with the button below if this is correct or verify them again if it's not.`;

        const logEmbed = EmbedHelper.getLogEmbed(this.client.user, user, LogLevel.Warning)
            .setTitle(`:zero: Last.fm returned 0 playcount`)
            .setFooter({ text: footer })
            .setDescription(description);
        await logChannel.send({
            embeds: [logEmbed],
            components: [ComponentHelper.zeroPlaycountWarningActions()],
        });
    }

    async logFlag(actor: User, flag: Flag, isUnflag: boolean = false) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        let description = isUnflag
            ? `${Constants.Flag} ${bold('Removed flag')} ${inlineCode(flag.term)}\n`
            : `${Constants.Flag} ${bold('Added flag')} ${inlineCode(flag.term)}\n`;
        if (!isUnflag) description += `${Constants.Note} ${bold('Reason:')} ${flag.reason}`;
        const embed = EmbedHelper.getLogEmbed(actor, null, isUnflag ? LogLevel.Info : LogLevel.Warning).setDescription(
            description
        );
        await logChannel.send({ embeds: [embed] });
    }

    async logImports(actor: User, subject: User, isDeletion: boolean = false) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.CROWNS_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description = `${Constants.User} ${bold('User:')} ${TextHelper.userDisplay(subject, true)}`;
        const embed = EmbedHelper.getLogEmbed(actor, subject, LogLevel.Info).setDescription(description);
        embed.setTitle(
            isDeletion
                ? `${Constants.DownwardChart} Removed Imports Flag`
                : `${Constants.UpwardChart} Added Imports Flag`
        );
        await logChannel.send({ embeds: [embed] });
    }

    async logCrownsBan(actor: User, subject: User, reason: string, message: Message, isUnban: boolean = false) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.CROWNS_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description =
            `${Constants.User} ${bold('User:')} ${TextHelper.userDisplay(subject, true)}` +
            `\n${Constants.Note} ${bold('Reason:')} ${reason == '' ? 'No reason provided.' : reason}`;
        const embed = EmbedHelper.getLogEmbed(actor, subject, LogLevel.Info).setDescription(description);
        embed.setTitle(isUnban ? `${Constants.Crown} Crowns Unban` : `<:nocrown:816944519924809779> Crowns Ban`);
        embed.setURL(TextHelper.getDiscordMessageLink(message));
        await logChannel.send({ embeds: [embed] });
    }

    async logNoDiscussionTopicsAlert(topicsLeftCount: number) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.DISCUSSIONS_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description =
            topicsLeftCount === 1
                ? `There is only 1 discussion topic left. Please add more topics using \`${this.env.CORE.PREFIX}dtopic add\`.`
                : `The next discussion topic is set to be posted but there are no more topics available. Please add more topics using \`${this.env.CORE.PREFIX}dtopic add\`.\n\n` +
                  `Automatic posting of discussions is **disabled**. enable it again with \`${this.env.CORE.PREFIX}dmanage start\` once there are topics available.`;
        const embed = new EmbedBuilder()
            .setColor(EmbedHelper.orange)
            .setTitle(`${Constants.Warning} No Discussion Topics Available`)
            .setDescription(description)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    }

    async logScrobbleCap(subject: User, actor: User, reason: string, message: Message, capRoleId?: string) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.CROWNS_LOG_CHANNEL_ID);
        if (!logChannel) return;

        let description = `${Constants.User} ${bold('User:')} ${TextHelper.userDisplay(subject, true)}`;
        if (capRoleId) description += `\n${Constants.Numbers} ${bold('Cap:')} <@&${capRoleId}>`;
        description += `\n${Constants.Note} ${bold('Reason:')} ${reason == '' ? 'No reason provided.' : reason}`;

        const embed = EmbedHelper.getLogEmbed(actor, subject, LogLevel.Info).setDescription(description);
        embed.setTitle(
            capRoleId ? `${Constants.Blocked} Scrobble Cap Set` : `${Constants.Accepted} Scrobble Cap Removed`
        );
        embed.setURL(TextHelper.getDiscordMessageLink(message));

        await logChannel.send({ embeds: [embed] });
    }

    async logDiscussionTopic(actor: User, topic: string, openTopicsCount: number, isRemoval: boolean = false) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.DISCUSSIONS_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const embed = EmbedHelper.getLogEmbed(actor, null, isRemoval ? LogLevel.Failure : LogLevel.Success)
            .setDescription(topic)
            .setTitle(isRemoval ? `${Constants.Outgoing} Topic removed` : `${Constants.Incoming} Topic added`)
            .setFooter({ text: `Topics left: ${openTopicsCount}` });

        await logChannel.send({ embeds: [embed] });
    }

    async logDiscussionOpened(discussion: IDiscussionsModel, actor: User) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.DISCUSSIONS_LOG_CHANNEL_ID);
        if (!logChannel) return;

        let description = `${Constants.Thread} ${bold('Thread:')} <#${discussion.threadId}>`;
        description += `\n${Constants.EmptyPage} ${bold('Topic:')} \`${discussion.topic}\``;

        const embed = EmbedHelper.getLogEmbed(actor, null, LogLevel.Success)
            .setDescription(description)
            .setTitle(`${Constants.Speech} Discussion opened`);

        await logChannel.send({ embeds: [embed] });
    }

    async logDiscussionScheduled(discussion: IDiscussionsModel) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.DISCUSSIONS_LOG_CHANNEL_ID);
        if (!logChannel) return;

        let description = `${Constants.EmptyPage} ${bold('Topic:')} \`${discussion.topic}\``;
        description += `\n${Constants.Time} ${bold('Scheduled for:')} <t:${moment(discussion.scheduledFor).unix()}:f> (<t:${moment(discussion.scheduledFor).unix()}:R>)`;

        const embed = EmbedHelper.getLogEmbed(null, null, LogLevel.Info)
            .setDescription(description)
            .setTitle(`${Constants.Hourglass} Discussion scheduled`);

        await logChannel.send({ embeds: [embed] });
    }

    async logDiscussionScheduleChanged(actor: User, isStart: boolean = false) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.DISCUSSIONS_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description = isStart
            ? `Automatic discussions have been scheduled (Interval: ${this.env.DISCUSSIONS.AUTO_INTERVAL_IN_HOURS} hours).`
            : `Automatic discussions have been stopped.`;

        const embed = EmbedHelper.getLogEmbed(actor, null, LogLevel.Info)
            .setDescription(description)
            .setTitle(
                isStart
                    ? `${Constants.Infinity} Automatic Discussions scheduled`
                    : `${Constants.Stop} Automatic Discussions stopped`
            )
            .setFooter({
                text: isStart
                    ? `Use ${this.env.CORE.PREFIX}dmanage stop to stop automatic discussions.`
                    : `Use ${this.env.CORE.PREFIX}dmanage start to start automatic discussions.`,
            });

        await logChannel.send({ embeds: [embed] });
    }

    async logStrike(
        subject: User,
        actor: User,
        reason: string,
        activeStrikeCount: number,
        allStrikesCount: number,
        action: string
    ) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        let actionDescription = `User received a **${action}** strike.`;
        if (action === 'Manual') actionDescription = `-# Strike was manually added. No action has been taken.`;
        else if (action.match('/Mute/'))
            actionDescription = `${Constants.Mute} User received a **${action}** for this strike.`;
        else if (action.match('/Ban/'))
            actionDescription = `${Constants.Hammer} User received a **${action}** for this strike.`;

        const description =
            `${Constants.User} ${bold('User:')} ${TextHelper.userDisplay(subject, true)}` +
            `\n${Constants.Note} ${bold('Reason:')} ${reason == '' ? 'No reason provided.' : reason}` +
            `\n\n${actionDescription}`;
        const embed = EmbedHelper.getLogEmbed(actor, subject, LogLevel.Failure).setDescription(description);
        embed.setFooter({ text: TextHelper.strikeCounter(activeStrikeCount, allStrikesCount) });
        embed.setTitle(`${Constants.Scream} Strike Issued`);
        return await logChannel.send({ embeds: [embed] });
    }

    async logStrikeAppeal(
        subject: User,
        actor: User,
        reason: string,
        activeStrikeCount: number,
        allStrikesCount: number
    ) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description =
            `${Constants.User} ${bold('User:')} ${TextHelper.userDisplay(subject, true)}` +
            `\n${Constants.Note} ${bold('Reason:')} ${reason == '' ? 'No reason provided.' : reason}`;
        const embed = EmbedHelper.getLogEmbed(actor, subject, LogLevel.Success).setDescription(description);
        embed.setFooter({ text: TextHelper.strikeCounter(activeStrikeCount, allStrikesCount) });
        embed.setTitle(`${Constants.Scream} Strike Appealed`);
        await logChannel.send({ embeds: [embed] });
    }

    async logStrikeRemove(
        subject: User,
        actor: User,
        reason: string,
        activeStrikeCount?: number,
        allStrikesCount?: number
    ) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description =
            `${Constants.User} ${bold('User:')} ${TextHelper.userDisplay(subject, true)}` +
            `\n${Constants.Note} ${bold('Reason:')} ${reason == '' ? 'No reason provided.' : reason}`;
        const embed = EmbedHelper.getLogEmbed(actor, subject, LogLevel.Success).setDescription(description);
        if (activeStrikeCount && allStrikesCount)
            embed.setFooter({ text: TextHelper.strikeCounter(activeStrikeCount, allStrikesCount) });
        embed.setTitle(`${Constants.Deletion} Strike Removed`);
        await logChannel.send({ embeds: [embed] });
    }

    async logBan(subject: User, actor: User, reason?: string) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description =
            `${Constants.User} ${bold('User:')} ${TextHelper.userDisplay(subject, true)}` +
            `\n${Constants.Note} ${bold('Reason:')} ${!reason || reason == '' ? 'No reason provided.' : reason}`;
        const embed = EmbedHelper.getLogEmbed(actor, subject, LogLevel.Failure).setDescription(description);
        embed.setTitle(`${Constants.Hammer} Ban Issued`);
        await logChannel.send({ embeds: [embed] });
    }

    async logInform(subject: User, actor: User, content: string) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description =
            `${Constants.User} ${bold('User:')} ${TextHelper.userDisplay(subject, true)}` +
            `\n${Constants.Note} ${bold('Content:')} ${content}`;
        const embed = EmbedHelper.getLogEmbed(actor, subject, LogLevel.Info).setDescription(description);
        embed.setTitle(`${Constants.Information} Informed User`);
        await logChannel.send({ embeds: [embed] });
    }

    async logFlaggedBotMessage(message: Message, flaggedTerm: string, actor: User) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description =
            `${Constants.Speech} ${bold('Link to Message:')} ${TextHelper.getDiscordMessageLink(message)}` +
            `\n${Constants.Note} ${bold('Flagged term:')} ${inlineCode(flaggedTerm)}`;
        const embed = EmbedHelper.getLogEmbed(actor, null, LogLevel.Warning).setDescription(description);
        embed.setTitle(`${Constants.Flag} Bot Message Flagged`);
        await logChannel.send({ embeds: [embed] });
    }

    async logBlockedBotMessage(originalMessage: Message, surrounding: Message, blockedWord: string, actor: User) {
        const logChannel = await this.getLogChannel(this.env.CHANNELS.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description =
            `${Constants.Speech} ${bold('Link to Surrounding:')} ${TextHelper.getDiscordMessageLink(surrounding)}` +
            `\n${Constants.Note} ${bold('Blocked word:')} ${inlineCode(blockedWord)}` +
            `\n${Constants.Deletion} ${bold('Original Message:')} ${originalMessage.content}`;
        const embed = EmbedHelper.getLogEmbed(actor, null, LogLevel.Failure).setDescription(description);
        embed.setTitle(`${Constants.Blocked} Bot Message Blocked`);
        const embeds = [embed];
        for (const embed of originalMessage.embeds) {
            const newEmbed = new EmbedBuilder(embed.data);
            embeds.push(newEmbed);
        }
        await logChannel.send({ embeds: embeds });
    }

    private async getLogChannel(channelId: string): Promise<GuildTextBasedChannel | null> {
        const logChannel = await this.channelService.getGuildChannelById(channelId);
        if (!logChannel) {
            this.logger.error(`Unable to log message to channel with Channel ID ${channelId}`);
        }
        return logChannel;
    }
}
