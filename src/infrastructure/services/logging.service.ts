import { inject, injectable } from 'inversify';
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
import { TYPES } from '@src/types';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { CachedMessageModel } from '@src/infrastructure/repositories/models/cached-message.model';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { LogLevel } from '@src/helpers/models/LogLevel';
import { SelfMute } from '@src/feature/commands/utility/models/self-mute.model';
import { Logger } from 'tslog';
import { Verification } from '@src/feature/commands/administration/models/verification.model';
import { TextHelper } from '@src/helpers/text.helper';
import { Environment } from '@models/environment';
import { getInfo } from 'lastfm-typed/dist/interfaces/userInterface';
import { Flag } from '@src/feature/commands/moderation/models/flag.model';
import moment = require('moment');
import { ComponentHelper } from '@src/helpers/component.helper';
import { CachedAttachmentModel } from '@src/infrastructure/repositories/models/cached-attachment.model';
import { extension } from 'mime-types';
import { IDiscussionsModel } from '@src/infrastructure/repositories/discussions.repository';

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
        const logChannel = await this.getLogChannel(this.env.DELETED_MESSAGE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const logEmbed = new EmbedBuilder()
            .setColor(EmbedHelper.red)
            .setFooter({ text: `Message ID: ${deletedMessage.messageId}` })
            .setTimestamp();

        let description = `🗑️ Message from ${TextHelper.userDisplay(author, false)} deleted `;
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
        const logChannel = await this.getLogChannel(this.env.DELETED_MESSAGE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const logEmbed = new EmbedBuilder()
            .setColor(EmbedHelper.red)
            .setFooter({ text: `Channel ID: ${channelId}` })
            .setTimestamp();

        let description = `🗑️ Bulk deleted ${deletedMessageCount} messages `;
        if (actor) description += `by ${TextHelper.userDisplay(actor?.user, false)} `;
        description += `in <#${channelId}>`;

        logEmbed.setDescription(description);

        await logChannel.send({ embeds: [logEmbed], files: [attachment] });
    }

    public async logSelfmute(selfMute: SelfMute, muteDuration?: string) {
        const logChannel = await this.getLogChannel(this.env.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description = muteDuration
            ? `🔇 ${bold('Selfmute created')} ${inlineCode(selfMute.member.user.username)} ${italic('(ID ' + selfMute.member.user.id + ')')}\n`
            : `🔊 ${bold('Selfmute ended')} ${inlineCode(selfMute.member.user.username)} ${italic('(ID ' + selfMute.member.user.id + ')')}\n📝 ${bold('Reason:')} ${selfMute.endsAt > moment().utc().toDate() ? 'User used unmute command' : 'Duration expired'}`;
        const embed = EmbedHelper.getLogEmbed(this.client.user!, selfMute.member.user, LogLevel.Trace).setDescription(
            description
        );
        if (muteDuration) embed.setFooter({ text: `Duration: ${muteDuration}` });
        await logChannel.send({ embeds: [embed] });
    }

    public async logVerification(verification: Verification) {
        const logChannel = await this.getLogChannel(this.env.USER_LOG_CHANNEL_ID);
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
                        value: verification.isReturningUser ? `⚠️ Yes` : 'No',
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
                        this.env.LASTFM_AGE_ALERT_IN_DAYS
                )
            );
        } else {
            embeds.push(new EmbedBuilder().setTitle('No Last.fm Account').setColor(EmbedHelper.blue));
        }

        await logChannel.send({ embeds: embeds });
    }

    public async logIndex(verification: Verification, reason: string) {
        const logChannel = await this.getLogChannel(this.env.USER_LOG_CHANNEL_ID);
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
                        value: reason,
                        inline: false,
                    },
                ])
        );

        embeds.push(
            EmbedHelper.getLastFmUserEmbed(
                verification.lastfmUser!.name,
                verification.lastfmUser!,
                moment().diff(moment.unix(verification.lastfmUser!.registered), 'days') <
                    this.env.LASTFM_AGE_ALERT_IN_DAYS
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
        const logChannel = await this.getLogChannel(this.env.STAFFMAIL_LOG_CHANNEL_ID);
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
        const logChannel = await this.getLogChannel(this.env.USER_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const logEmbed = EmbedHelper.getLogEmbed(message.author, message.author, LogLevel.Warning).setDescription(
            `${TextHelper.userDisplay(message.author, false)} is trying to verify with a new Last.fm Account that is younger than 30 days: ${TextHelper.getDiscordMessageLink(message)}`
        );
        logChannel.send({ embeds: [logEmbed, EmbedHelper.getLastFmUserEmbed(lastFmUser.name, lastFmUser, true)] });
    }

    async logLastFmFlagAlert(message: Message, flag: Flag) {
        const logChannel = await this.getLogChannel(this.env.BACKSTAGE_CHANNEL_ID);
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
            .setTitle(`⚠️ Last.fm Account Flagged`)
            .setDescription(description);
        logChannel.send({ embeds: [logEmbed] });
    }

    async logDiscordFlagAlert(message: Message, flag: Flag) {
        const logChannel = await this.getLogChannel(this.env.BACKSTAGE_CHANNEL_ID);
        if (!logChannel) return;

        let description = `${TextHelper.userDisplay(message.author, true)} is trying to verify with a Discord account that was flagged as suspicious or malicious by staff.\n\n`;
        description +=
            `${bold(`Message: `)} ${TextHelper.getDiscordMessageLink(message)}\n` +
            `${bold(`Flagged term: `)} ${inlineCode(flag.term)}\n` +
            `${bold(`Reason: `)} ${flag.reason}`;

        const logEmbed = EmbedHelper.getLogEmbed(this.client.user, message.author, LogLevel.Warning)
            .setTitle(`⚠️ Discord Account Flagged`)
            .setDescription(description);
        logChannel.send({ embeds: [logEmbed] });
    }

    async logDuplicateLastFmUsername(message: Message, otherMembers: string[]) {
        const logChannel = await this.getLogChannel(this.env.BACKSTAGE_CHANNEL_ID);
        if (!logChannel) return;

        let description =
            `${TextHelper.userDisplay(message.author, true)} is trying to verify with a Last.fm account that is already verified and tied to a different account.\n\n` +
            `${bold(`Last.fm Link: `)} https://last.fm/user/${TextHelper.getLastfmUsername(message.content)}\n` +
            `${bold(`Other users using this last.fm username:`)}\n`;

        otherMembers.forEach((memberString) => (description += `- ${memberString}\n`));

        const logEmbed = EmbedHelper.getLogEmbed(this.client.user, message.author, LogLevel.Warning)
            .setTitle(`⚠️ Last.fm Account Duplicate`)
            .setDescription(description)
            .setFooter({ text: `Please make sure they are not an alt account. When in doubt, ask staff!` });
        logChannel.send({ embeds: [logEmbed] });
    }

    async logReturningUserNote(user: User, lastFmUsername: string, isUsingDifferentLastfm: boolean): Promise<void> {
        const logChannel = await this.getLogChannel(this.env.BACKSTAGE_CHANNEL_ID);
        if (!logChannel) return;

        let description =
            `${TextHelper.userDisplay(user, true)} is a returning member.\n\n` +
            `${bold(`Last.fm Link:`)} https://last.fm/user/${lastFmUsername}`;
        if (!isUsingDifferentLastfm) description += ` (⚠️ verifying with different account)`;

        const logEmbed = EmbedHelper.getLogEmbed(this.client.user, user, LogLevel.Info)
            .setTitle(`ℹ️ Returning member`)
            .setDescription(description)
            .setFooter({ text: `Welcome back! 🎉` });
        logChannel.send({ embeds: [logEmbed] });
    }

    async logZeroPlaycountVerification(user: User, lastFmUsername: string) {
        const logChannel = await this.getLogChannel(this.env.BACKSTAGE_CHANNEL_ID);
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

    async logFlag(flag: Flag, isUnflag: boolean = false) {
        const logChannel = await this.getLogChannel(this.env.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        let description = isUnflag
            ? `🚩 ${bold('Removed flag')} ${inlineCode(flag.term)}\n`
            : `🚩 ${bold('Added flag')} ${inlineCode(flag.term)}\n`;
        if (!isUnflag) description += `📝 ${bold('Reason:')} ${flag.reason}`;
        const embed = EmbedHelper.getLogEmbed(
            flag.createdBy instanceof User ? flag.createdBy : null,
            null,
            isUnflag ? LogLevel.Info : LogLevel.Warning
        ).setDescription(description);
        await logChannel.send({ embeds: [embed] });
    }

    async logImports(actor: User, subject: User, isDeletion: boolean = false) {
        const logChannel = await this.getLogChannel(this.env.CROWNS_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description = `:bust_in_silhouette: ${bold('User:')} ${TextHelper.userDisplay(subject, true)}`;
        const embed = EmbedHelper.getLogEmbed(actor, subject, LogLevel.Info).setDescription(description);
        embed.setTitle(isDeletion ? `📉 Removed Imports Flag` : `📈 Added Imports Flag`);
        await logChannel.send({ embeds: [embed] });
    }

    async logCrownsBan(actor: User, subject: User, reason: string, message: Message, isUnban: boolean = false) {
        const logChannel = await this.getLogChannel(this.env.CROWNS_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const description =
            `:bust_in_silhouette: ${bold('User:')} ${TextHelper.userDisplay(subject, true)}` +
            `\n📝 ${bold('Reason:')} ${reason == '' ? 'No reason provided.' : reason}`;
        const embed = EmbedHelper.getLogEmbed(actor, subject, LogLevel.Info).setDescription(description);
        embed.setTitle(isUnban ? `👑 Crowns Unban` : `<:nocrown:816944519924809779> Crowns Ban`);
        embed.setURL(TextHelper.getDiscordMessageLink(message));
        await logChannel.send({ embeds: [embed] });
    }

    async logNoDiscussionTopicsAlert() {
        const logChannel = await this.getLogChannel(this.env.HELPERS_CHANNEL_ID);
        if (!logChannel) return;

        const description = `Discussions are scheduled but there are no more topics available. Please add more topics using \`${this.env.PREFIX}dtopic add\`. Automatic posting of discussions is disabled, enable it again with \`${this.env.PREFIX}dtopic auto\` once there are topics available.`;
        const embed = new EmbedBuilder()
            .setColor(EmbedHelper.orange)
            .setTitle(`⚠️ No Discussion Topics Available`)
            .setDescription(description)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    }

    async logDiscussionStillActiveAlert(discussion: IDiscussionsModel) {
        const logChannel = await this.getLogChannel(this.env.HELPERS_CHANNEL_ID);
        if (!logChannel) return;

        const description = `The previous discussion in <#${discussion.threadId}> still active and has not been closed. Please close it manually once it's not active anymore.`;
        const embed = new EmbedBuilder()
            .setColor(EmbedHelper.blue)
            .setTitle(`ℹ️ Previous Discussion Still Active`)
            .setDescription(description)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    }

    async logScrobbleCap(subject: User, actor: User, reason: string, message: Message, capRoleId?: string) {
        const logChannel = await this.getLogChannel(this.env.SELFMUTE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        let description = `:bust_in_silhouette: ${bold('User:')} ${TextHelper.userDisplay(subject, true)}`;
        if (capRoleId) description += `\n:billed_cap: ${bold('Cap:')} <@&${capRoleId}>`;
        description += `\n📝 ${bold('Reason:')} ${reason == '' ? 'No reason provided.' : reason}`;

        const embed = EmbedHelper.getLogEmbed(actor, subject, LogLevel.Info).setDescription(description);
        embed.setTitle(capRoleId ? '🚫 Scrobble Cap Set' : '☑️ Scrobble Cap Removed');
        embed.setURL(TextHelper.getDiscordMessageLink(message));
        
        await logChannel.send({ embeds: [embed] });
    }

    private async getLogChannel(channelId: string): Promise<GuildTextBasedChannel | null> {
        const logChannel = await this.channelService.getGuildChannelById(channelId);
        if (!logChannel) {
            this.logger.error(`Unable to log message to channel with Channel ID ${channelId}`);
        }
        return logChannel;
    }
}
