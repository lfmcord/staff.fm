import { inject, injectable } from 'inversify';
import {
    CategoryChannel,
    CategoryChildChannel,
    ChannelType,
    Client,
    GuildTextBasedChannel,
    Message,
    MessageResolvable,
    MessageType,
    TextBasedChannel,
    User,
} from 'discord.js';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { Environment } from '@models/environment';

@injectable()
export class ChannelService {
    private client: Client;
    logger: Logger<ChannelService>;
    private environment: Environment;
    constructor(
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.ENVIRONMENT) environment: Environment,
        @inject(TYPES.InfrastructureLogger) logger: Logger<ChannelService>
    ) {
        this.logger = logger;
        this.environment = environment;
        this.client = client;
    }
    async getGuildChannelById(channelId: string): Promise<GuildTextBasedChannel | null> {
        try {
            const guild = await this.client.guilds.fetch(this.environment.GUILD_ID);
            return (await guild.channels.fetch(channelId)) as GuildTextBasedChannel | null;
        } catch (e) {
            this.logger.warn(`Failed while trying to get guild channel for ID ${channelId}.`, e);
            return null;
        }
    }

    async getGuildCategoryById(categoryId: string): Promise<CategoryChannel | null> {
        try {
            const guild = await this.client.guilds.fetch(this.environment.GUILD_ID);
            return (await guild.channels.fetch(categoryId)) as CategoryChannel | null;
        } catch (e) {
            this.logger.warn(`Failed while trying to get guild category for ID ${categoryId}.`, e);
            return null;
        }
    }

    async findGuildChannelInCategory(
        category: CategoryChannel,
        channelName: string
    ): Promise<CategoryChildChannel | null> {
        try {
            return category.children.cache.find((c) => c.name == channelName) ?? null;
        } catch (e) {
            this.logger.warn(
                `Failed while trying to find channel with name '${channelName}' in category '${category.name}'.`,
                e
            );
            return null;
        }
    }

    async createGuildTextChannelInCategory(
        channelName: string,
        category: CategoryChannel
    ): Promise<GuildTextBasedChannel> {
        const guild = await this.client.guilds.fetch(this.environment.GUILD_ID);
        return await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category,
        });
    }

    async pinNewStaffMailMessageInDmChannel(message: Message, oldMessageId: string | null, recipient: User) {
        try {
            if (oldMessageId)
                await (await recipient.dmChannel?.messages.fetch(oldMessageId as MessageResolvable))?.unpin();
            await message.pin();
            await recipient.dmChannel?.messages.cache
                .filter((m: Message) => (m.type = MessageType.ChannelPinnedMessage))
                .last()
                ?.delete();
        } catch (e) {
            this.logger.warn(`Failed to manage pins for staffmail DM channel ${recipient.dmChannel?.id}`, e);
            recipient.dmChannel?.send(
                `😟 I couldn't update the pins with the newest message! But worry not, you can still reply as usual.`
            );
        }
    }

    async getMessageFromChannelByMessageId(messageId: string, channel: TextBasedChannel): Promise<Message | null> {
        try {
            const message = await channel.messages.fetch(messageId as MessageResolvable);
            return message ?? null;
        } catch (e) {
            this.logger.warn(`Could not fetch message with message ID ${messageId} from channel with ID ${channel.id}`);
            return null;
        }
    }
}
