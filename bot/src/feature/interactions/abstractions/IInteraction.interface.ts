import { Interaction } from 'discord.js';

export interface IInteraction {
    customId: string;
    manage(interaction: Interaction): Promise<void>;
}
