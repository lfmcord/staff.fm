import { StringSelectMenuInteraction } from 'discord.js';

export interface IStringSelectMenuInteraction {
    customIds: string[];
    manage(interaction: StringSelectMenuInteraction): Promise<void>;
}
