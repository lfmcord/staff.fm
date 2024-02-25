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
import { Verification } from '@src/feature/commands/utility/models/verification.model';
import { TextHelper } from '@src/helpers/text.helper';
import { Environment } from '@models/environment';
import { getInfo } from 'lastfm-typed/dist/interfaces/userInterface';
import moment = require('moment');
import { Flag } from '@src/feature/commands/moderation/models/flag.model';

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

    public async logDeletedMessage(
        deletedMessage: CachedMessageModel,
        author: GuildMember | null,
        actor: GuildMember | null
    ) {
        const logChannel = await this.getLogChannel(this.env.DELETED_MESSAGE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const logEmbed = new EmbedBuilder()
            .setColor(EmbedHelper.red)
            .setFooter({ text: `Message ID: ${deletedMessage.messageId}` })
            .setTimestamp();

        let description = `🗑️ Message from ${TextHelper.userDisplay(author?.user, false)} deleted `;
        if (actor) description += `by ${TextHelper.userDisplay(actor?.user, false)} `;
        description += `in <#${deletedMessage.channelId}>`;
        if (deletedMessage.contents !== '') description += `:\n${codeBlock(deletedMessage.contents)}`;

        logEmbed.setDescription(description);

        await logChannel.send({ embeds: [logEmbed], files: deletedMessage.attachments });
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
        const logChannel = await this.channelService.getGuildChannelById(this.env.USER_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const embeds: EmbedBuilder[] = [];
        const description = `${bold('Verified user')} ${inlineCode(verification.verifiedMember.user.username)} ${italic('(ID ' + verification.verifiedMember.user.id + ')')}`;
        embeds.push(
            EmbedHelper.getLogEmbed(verification.verifyingUser, verification.verifiedMember.user, LogLevel.Info)
                .setDescription(description)
                .setFields([
                    {
                        name: `Created`,
                        value: `<t:${moment(verification.verifiedMember.user.createdAt).unix()}:D> (<t:${moment(verification.verifiedMember.user.createdAt).unix()}:R>)`,
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
            embeds.push(EmbedHelper.getLastFmUserEmbed(verification.lastfmUser));
        } else {
            embeds.push(new EmbedBuilder().setTitle('No Last.fm Account'));
        }

        await logChannel.send({ embeds: embeds });
    }

    public async logStaffMailEvent(
        isOpen: boolean,
        summary: string | null,
        type: string,
        author: User | null,
        actor: User | null,
        reason: string | null,
        attachments: AttachmentBuilder[] = []
    ) {
        const logChannel = await this.channelService.getGuildChannelById(this.env.STAFFMAIL_LOG_CHANNEL_ID);
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
        if (reason) embed.setDescription(`${bold('Reason:')} ${reason}`);
        else if (!isOpen) embed.setDescription(`No reason provided.`);
        await logChannel.send({
            embeds: [embed],
            files: attachments,
        });
    }

    async logLastFmAgeAlert(message: Message, lastFmUser: getInfo) {
        const logChannel = await this.channelService.getGuildChannelById(this.env.USER_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const logEmbed = EmbedHelper.getLogEmbed(message.author, message.author, LogLevel.Warning).setDescription(
            `${TextHelper.userDisplay(message.author, false)} is trying to verify with a new Last.fm Account that is younger than 30 days: ${TextHelper.getDiscordMessageLink(message)}`
        );
        logChannel.send({ embeds: [logEmbed, EmbedHelper.getLastFmUserEmbed(lastFmUser, true)] });
    }

    async logLastFmFlagAlert(message: Message, flag: Flag) {
        const logChannel = await this.channelService.getGuildChannelById(this.env.BACKSTAGE_CHANNEL_ID);
        if (!logChannel) return;

        const logEmbed = EmbedHelper.getLogEmbed(this.client.user, message.author, LogLevel.Warning)
            .setTitle(`⚠️ Last.fm Account Flagged`)
            .setDescription(
                `${TextHelper.userDisplay(message.author, false)} is trying to verify with a Last.fm account that was flagged as suspicious or malicious by staff.\n\n` +
                    `${bold(`Last.fm Link: `)} https://last.fm/user/${TextHelper.getLastfmUsername(message.content)}\n` +
                    `${bold(`Flagged term: `)} ${inlineCode(flag.term)}\n` +
                    `${bold(`Reason: `)} ${flag.reason}`
            );
        logChannel.send({ embeds: [logEmbed] });
    }

    async logDuplicateLastFmUsername(message: Message, otherMembers: GuildMember[]) {
        const logChannel = await this.channelService.getGuildChannelById(this.env.BACKSTAGE_CHANNEL_ID);
        if (!logChannel) return;

        let description =
            `${TextHelper.userDisplay(message.author, false)} is trying to verify with a Last.fm account that is already verified and tied to a different account.\n\n` +
            `${bold(`Last.fm Link: `)} https://last.fm/user/${TextHelper.getLastfmUsername(message.content)}\n` +
            `${bold(`Other users using this last.fm username:`)}\n`;

        otherMembers.forEach((member) => (description += `- ${TextHelper.userDisplay(member.user)}\n`));

        const logEmbed = EmbedHelper.getLogEmbed(this.client.user, message.author, LogLevel.Warning)
            .setTitle(`⚠️ Last.fm Account Duplicate`)
            .setDescription(description)
            .setFooter({ text: `Please make sure they are not an alt account. When in doubt, ask staff!` });
        logChannel.send({ embeds: [logEmbed] });
    }

    private async getLogChannel(channelId: string): Promise<GuildTextBasedChannel | null> {
        const logChannel = await this.channelService.getGuildChannelById(this.env.DELETED_MESSAGE_LOG_CHANNEL_ID);
        if (!logChannel) {
            this.logger.error(`Unable to log message to channel with Channel ID ${channelId}`);
        }
        return logChannel;
    }
}
