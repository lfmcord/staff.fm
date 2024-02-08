import { injectable } from 'inversify';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';
import { ModalSubmitInteraction } from 'discord.js';

@injectable()
export class EventCreateModalInteraction implements IInteraction {
    customId = 'defer-event-create';

    async manage(interaction: ModalSubmitInteraction) {
        interaction.reply({ ephemeral: true, content: `I've successfully submitted` });
        return Promise.resolve();
    }
}
