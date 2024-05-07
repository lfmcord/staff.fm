import { MessageComponentInteraction } from 'discord.js';

export interface IMessageComponentInteraction {
    customIds: string[];
    manage(interaction: MessageComponentInteraction): Promise<void>;
}
