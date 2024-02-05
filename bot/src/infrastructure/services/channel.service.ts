import { inject, injectable } from 'inversify';
import { CategoryChannel, CategoryChildChannel, ChannelType, Client, GuildTextBasedChannel } from 'discord.js';
import { TYPES } from '@src/types';

@injectable()
export class ChannelService {
    private client: Client;
    private guildId: string;
    constructor(@inject(TYPES.Client) client: Client, @inject(TYPES.GUILD_ID) guildId: string) {
        this.guildId = guildId;
        this.client = client;
    }
    async getGuildChannelById(channelId: string): Promise<GuildTextBasedChannel | null> {
        const guild = await this.client.guilds.fetch(this.guildId);
        return (await guild.channels.fetch(channelId)) as GuildTextBasedChannel | null;
    }

    async getGuildCategoryById(categoryId: string): Promise<CategoryChannel | null> {
        const guild = await this.client.guilds.fetch(this.guildId);
        return (await guild.channels.fetch(categoryId)) as CategoryChannel | null;
    }

    async findGuildChannelInCategory(
        category: CategoryChannel,
        channelName: string
    ): Promise<CategoryChildChannel | null> {
        return category.children.cache.find((c) => c.name == channelName) ?? null;
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
