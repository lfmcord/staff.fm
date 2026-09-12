import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { TYPES } from '@src/types';
import { ButtonInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class CancelButtonInteraction implements IMessageComponentInteraction {
    customIds = ['defer-cancel'];
    logger: Logger<CancelButtonInteraction>;

    constructor(@inject(TYPES.BotLogger) logger: Logger<CancelButtonInteraction>) {
        this.logger = logger;
    }

    async manage(interaction: ButtonInteraction) {
        this.logger.debug(`Cancelling message for interaction ID ${interaction.customId}.`);
        try {
            await interaction.message.edit({ content: 'Cancelled.', components: [], embeds: [] });
            await interaction.update({});
        } catch (e) {
            this.logger.warn(`Failed to cancel message for interaction ID ${interaction.customId}.`);
            await interaction.update({});
        }
    }
}
