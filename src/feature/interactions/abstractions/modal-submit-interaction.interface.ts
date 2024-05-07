import { ModalSubmitInteraction } from 'discord.js';

export interface IModalSubmitInteraction {
    customIds: string[];
    manage(interaction: ModalSubmitInteraction): Promise<void>;
}
