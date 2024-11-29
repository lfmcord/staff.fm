import { inject, injectable } from 'inversify';
import {
    CategoryChannel,
    CategoryChildChannel,
    ChannelType,
    Client,
    GuildTextBasedChannel,
    Message,
    MessageResolvable,
    TextBasedChannel,
    TextChannel,
    ThreadChannel,
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

    async getGuildThreadById(channelId: string, threadId: string): Promise<ThreadChannel | null> {
        const guild = await this.client.guilds.fetch(this.environment.GUILD_ID);
        const channel = await guild.channels.fetch(channelId);
        try {
            const thread = await (channel as TextChannel).threads.fetch(threadId);
            return !thread || !thread.isThread() ? null : (thread as ThreadChannel);
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

    async getMessageFromChannelByMessageId(messageId: string, channel: TextBasedChannel): Promise<Message | null> {
        try {
            const message = await channel.messages.fetch(messageId as MessageResolvable);
            return message ?? null;
        } catch (e) {
            this.logger.warn(`Could not fetch message with message ID ${messageId} from channel with ID ${channel.id}`);
            return null;
        }
    }

    async getGuildTextChannelById(id: string) {
        const guild = await this.client.guilds.fetch(this.environment.GUILD_ID);
        return await guild.channels.fetch(id);
    }
}
