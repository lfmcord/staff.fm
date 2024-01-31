import { inject, injectable } from 'inversify';
import { GuildMember, GuildTextBasedChannel } from 'discord.js';
import { TYPES } from '@src/types';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { CachedMessageModel } from '@src/infrastructure/repositories/models/cached-message.model';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { LogLevel } from '@src/helpers/models/LogLevel';

@injectable()
export class LoggingService {
    private deletedMessageLogChannelId: string;
    private channelService: ChannelService;
    constructor(
        @inject(TYPES.DELETED_MESSAGE_LOG_CHANNEL_ID) deletedMessageLogChannelId: string,
        @inject(TYPES.ChannelService) channelService: ChannelService
    ) {
        this.deletedMessageLogChannelId = deletedMessageLogChannelId;
        this.channelService = channelService;
    }

    public async logDeletedMessage(deletedMessage: CachedMessageModel, author: GuildMember | null) {
        const logChannel = await this.getLogChannel(this.deletedMessageLogChannelId);
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

    private async getLogChannel(channelId: string): Promise<GuildTextBasedChannel> {
        const logChannel = await this.channelService.getGuildChannelById(this.deletedMessageLogChannelId);
        if (!logChannel) {
            throw Error(`Unable to log message to channel with Channel ID ${channelId}`);
        }
        return logChannel;
    }
}
