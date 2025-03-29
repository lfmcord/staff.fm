import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { IMessageContextMenuInteraction } from '@src/feature/interactions/abstractions/message-context-menu-interaction.interface';
import { IModalSubmitInteraction } from '@src/feature/interactions/abstractions/modal-submit-interaction.interface';
import { IHandler } from '@src/handlers/models/handler.interface';
import { TYPES } from '@src/types';
import {
    Interaction,
    MessageComponentInteraction,
    MessageContextMenuCommandInteraction,
    ModalSubmitInteraction,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import container from '../inversify.config';

@injectable()
export class InteractionCreateHandler implements IHandler {
    eventType = 'interactionCreate';
    private logger: Logger<InteractionCreateHandler>;

    constructor(@inject(TYPES.BotLogger) logger: Logger<InteractionCreateHandler>) {
        this.logger = logger;
    }

    async handle(interaction: Interaction) {
        if (interaction.isMessageContextMenuCommand()) {
            await this.handleMessageContextMenuCommandInteraction(interaction as MessageContextMenuCommandInteraction);
        } else if (interaction.isMessageComponent()) {
            await this.handleMessageComponentInteraction(interaction as MessageComponentInteraction);
        } else if (interaction.isModalSubmit()) {
            await this.handleModalSubmitInteraction(interaction as ModalSubmitInteraction);
        } else {
            this.logger.warn(`No handler for interaction type ${interaction.type} with ID ${interaction.id}`);
        }
    }

    private async handleMessageContextMenuCommandInteraction(
        interaction: MessageContextMenuCommandInteraction
    ): Promise<void> {
        const interactions = container.getAll<IMessageContextMenuInteraction>('MessageContextMenuInteraction');
        const foundInteraction = interactions.find(
            (i: IMessageContextMenuInteraction) => i.data.name === interaction.commandName
        );
        if (!foundInteraction) {
            this.logger.error(
                `Could not find message context menu interaction for name ${interaction.commandName} among ${interactions?.length} message context menu interactions.`
            );
            return;
        }

        this.logger.debug(`${foundInteraction.constructor.name} is handling the message context menu  interaction...`);
        await foundInteraction.manage(interaction);
    }

    private async handleMessageComponentInteraction(interaction: MessageComponentInteraction) {
        if (!interaction.customId || !interaction.customId.startsWith('defer')) {
            if (
                interaction.customId === 'cancel' &&
                !interaction.deferred &&
                !interaction.replied &&
                interaction.isRepliable()
            ) {
                await interaction.update({ content: `Cancelled.`, embeds: [], components: [] });
            }
            this.logger.debug(
                `Interaction with customId '${interaction.customId}' is not a deferred interaction and will be handled elsewhere.`
            );
            return;
        }
        const interactions = container.getAll<IMessageComponentInteraction>('MessageComponentInteraction');
        const foundInteraction = interactions.find(
            (i: IMessageComponentInteraction) =>
                i.customIds.includes(interaction.customId) ||
                i.customIds.some((id) => interaction.customId.startsWith(id))
        );
        if (!foundInteraction) {
            this.logger.error(
                `Could not find message component interaction for ID ${interaction.customId} among ${interactions?.length} message component interactions.`
            );
            return;
        }

        this.logger.debug(`${foundInteraction.constructor.name} is handling the message component interaction...`);
        await foundInteraction.manage(interaction);
    }

    private async handleModalSubmitInteraction(interaction: ModalSubmitInteraction) {
        const interactions = container.getAll<IModalSubmitInteraction>('ModalSubmitInteraction');
        const foundInteraction = interactions.find((i: IModalSubmitInteraction) =>
            i.customIds.includes(interaction.customId)
        );
        if (!foundInteraction) {
            this.logger.error(
                `Could not find modal submit interaction for ID ${interaction.customId} among ${interactions?.length} modal submit interactions.`
            );
            return;
        }

        this.logger.debug(`${foundInteraction.constructor.name} is handling the modal submit interaction...`);
        await foundInteraction.manage(interaction);
    }
}
