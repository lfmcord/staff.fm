import { inject, injectable } from 'inversify';
import { bold, Client, EmbedBuilder, GuildMember, GuildTextBasedChannel, inlineCode, italic } from 'discord.js';
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

@injectable()
export class LoggingService {
    private deletedMessageLogChannelId: string;
    private userLogChannelId: string;
    private selfmuteLogChannelId: string;
    private client: Client;
    private channelService: ChannelService;
    private logger: Logger<LoggingService>;

    constructor(
        @inject(TYPES.DELETED_MESSAGE_LOG_CHANNEL_ID) deletedMessageLogChannelId: string,
        @inject(TYPES.SELFMUTE_LOG_CHANNEL_ID) selfmuteLogChannelId: string,
        @inject(TYPES.USER_LOG_CHANNEL_ID) userLogChannelId: string,
        @inject(TYPES.ChannelService) channelService: ChannelService,
        @inject(TYPES.BotLogger) logger: Logger<LoggingService>,
        @inject(TYPES.Client) client: Client
    ) {
        this.userLogChannelId = userLogChannelId;
        this.selfmuteLogChannelId = selfmuteLogChannelId;
        this.client = client;
        this.logger = logger;
        this.deletedMessageLogChannelId = deletedMessageLogChannelId;
        this.channelService = channelService;
    }

    public async logDeletedMessage(deletedMessage: CachedMessageModel, author: GuildMember | null) {
        const logChannel = await this.getLogChannel(this.deletedMessageLogChannelId);
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
        const logChannel = await this.getLogChannel(this.selfmuteLogChannelId);
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
        const logChannel = await this.channelService.getGuildChannelById(this.userLogChannelId);
        if (!logChannel) return;

        const embeds: EmbedBuilder[] = [];
        const description =
            `${bold('Verified user')} ${inlineCode(verification.verifiedMember.user.username)} ${italic('(ID ' + verification.verifiedMember.user.id + ')')}\n\n` +
            `📝 ${bold('Note:')} ${verification.verificationMessage.content}`;
        embeds.push(
            EmbedHelper.getLogEmbed(
                verification.verifyingUser,
                verification.verifiedMember.user,
                LogLevel.Info
            ).setDescription(description)
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

    private async getLogChannel(channelId: string): Promise<GuildTextBasedChannel | null> {
        const logChannel = await this.channelService.getGuildChannelById(this.deletedMessageLogChannelId);
        if (!logChannel) {
            this.logger.error(`Unable to log message to channel with Channel ID ${channelId}`);
        }
        return logChannel;
    }
}
