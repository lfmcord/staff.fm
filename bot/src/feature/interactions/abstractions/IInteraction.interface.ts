import { Interaction } from 'discord.js';

export interface IInteraction {
    customIds: string[];
    manage(interaction: Interaction): Promise<void>;
}
