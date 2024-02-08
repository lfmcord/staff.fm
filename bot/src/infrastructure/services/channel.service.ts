import { inject, injectable } from 'inversify';
import { CategoryChannel, CategoryChildChannel, ChannelType, Client, GuildTextBasedChannel } from 'discord.js';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';

@injectable()
export class ChannelService {
    private client: Client;
    logger: Logger<ChannelService>;
    private guildId: string;
    constructor(
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.GUILD_ID) guildId: string,
        @inject(TYPES.InfrastructureLogger) logger: Logger<ChannelService>
    ) {
        this.logger = logger;
        this.guildId = guildId;
        this.client = client;
    }
    async getGuildChannelById(channelId: string): Promise<GuildTextBasedChannel | null> {
        try {
            const guild = await this.client.guilds.fetch(this.guildId);
            return (await guild.channels.fetch(channelId)) as GuildTextBasedChannel | null;
        } catch (e) {
            this.logger.warn(`Failed while trying to get guild channel for ID ${channelId}.`, e);
            return null;
        }
    }

    async getGuildCategoryById(categoryId: string): Promise<CategoryChannel | null> {
        try {
            const guild = await this.client.guilds.fetch(this.guildId);
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
        const guild = await this.client.guilds.fetch(this.guildId);
        return await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category,
        });
    }
}
