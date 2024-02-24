import { inject, injectable } from 'inversify';
import {
    AttachmentBuilder,
    bold,
    Client,
    EmbedBuilder,
    GuildMember,
    GuildTextBasedChannel,
    inlineCode,
    italic,
    User,
} from 'discord.js';
import { TYPES } from '@src/types';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { CachedMessageModel } from '@src/infrastructure/repositories/models/cached-message.model';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { LogLevel } from '@src/helpers/models/LogLevel';
import { SelfMute } from '@src/feature/commands/utility/models/self-mute.model';
import { Logger } from 'tslog';
import moment = require('moment');
import { Verification } from '@src/feature/commands/utility/models/verification.model';
import { CountryCodeHelper } from '@src/helpers/country-code.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { Environment } from '@models/environment';

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

    public async logDeletedMessage(deletedMessage: CachedMessageModel, author: GuildMember | null) {
        const logChannel = await this.getLogChannel(this.env.DELETED_MESSAGE_LOG_CHANNEL_ID);
        if (!logChannel) return;

        const logMessage = EmbedHelper.getLogEmbed(
            author?.user ?? deletedMessage.userId,
            null,
            LogLevel.Failure
        ).setTitle(`🗑️ Message Deleted`);

        const fields = [];
        fields.push({
            name: 'Author',
            value: `<@${deletedMessage.userId}>`,
            inline: true,
        });
        fields.push({
            name: 'Channel',
            value: `<#${deletedMessage.channelId}>`,
            inline: true,
        });
        if (deletedMessage.contents !== '')
            fields.push({
                name: 'Contents',
                value: deletedMessage.contents,
                inline: false,
            });
        logMessage.setFields(fields);

        await logChannel.send({ embeds: [logMessage], files: deletedMessage.attachments });
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
                        name: `📝  Note`,
                        value: `${verification.verificationMessage?.content ?? 'Manual Verification'}`,
                    },
                    {
                        name: `Created`,
                        value: `<t:${moment(verification.verifiedMember.user.createdAt).unix()}:D> (<t:${moment(verification.verifiedMember.user.createdAt).unix()}:R>)`,
                    },
                ])
        );

        if (verification.lastfmUser) {
            embeds.push(
                new EmbedBuilder()
                    .setTitle('Last.fm Account')
                    .setURL(verification.lastfmUser.url)
                    .setFields([
                        {
                            name: 'Username',
                            value: verification.lastfmUser.name,
                            inline: true,
                        },
                        {
                            name: 'Real name',
                            value: verification.lastfmUser.realname,
                            inline: true,
                        },
                        {
                            name: 'Scrobble Count',
                            value: verification.lastfmUser.playcount.toString(),
                            inline: false,
                        },
                        {
                            name: 'Country',
                            value:
                                `:flag_${CountryCodeHelper.getTwoLetterIsoCountryCode(verification.lastfmUser.country)?.toLowerCase()}: ` +
                                verification.lastfmUser.country,
                            inline: true,
                        },
                        {
                            name: 'Created',
                            value: `<t:${verification.lastfmUser.registered}:D> (<t:${verification.lastfmUser.registered}:R>)`,
                            inline: true,
                        },
                    ])
                    .setThumbnail(verification.lastfmUser.image.find((i) => i.size === 'extralarge')?.url ?? null)
                    .setColor(EmbedHelper.blue)
                    .setTimestamp()
            );
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

    private async getLogChannel(channelId: string): Promise<GuildTextBasedChannel | null> {
        const logChannel = await this.channelService.getGuildChannelById(this.env.DELETED_MESSAGE_LOG_CHANNEL_ID);
        if (!logChannel) {
            this.logger.error(`Unable to log message to channel with Channel ID ${channelId}`);
        }
        return logChannel;
    }
}
