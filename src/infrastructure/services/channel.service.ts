import { inject, injectable } from 'inversify';
import { Client, GuildTextBasedChannel } from 'discord.js';
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
}
