import { injectable } from 'inversify';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';
import { ActionRowBuilder, ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

@injectable()
export class EventCreateInteraction implements IInteraction {
    customId = 'defer-event-create';

    async manage(interaction: ButtonInteraction) {
        const modal = new ModalBuilder().setCustomId('event-create-modal').setTitle('Create Event');

        const eventNameInput = new TextInputBuilder()
            .setCustomId('event-create-modal-name')
            .setLabel('Event Name:')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(250);

        const eventDescriptionInput = new TextInputBuilder()
            .setCustomId('event-create-modal-description')
            .setLabel('Event Description:')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(2000);

        const eventTime = new TextInputBuilder()
            .setCustomId('event-create-modal-time')
            .setLabel('Event Time (YYYY-MM-DD HH:MM):')
            .setStyle(TextInputStyle.Short);

        const eventRecurring = new TextInputBuilder()
            .setCustomId('event-create-modal-recurring')
            .setLabel('Recurring Event (optional):')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const inputs = [eventNameInput, eventDescriptionInput, eventTime, eventRecurring];
        for (const input of inputs) {
            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        }

        await interaction.showModal(modal);

        return Promise.resolve();
    }
}
