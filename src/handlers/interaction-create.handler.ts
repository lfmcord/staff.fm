import { IHandler } from '@src/handlers/models/handler.interface';
import { Logger } from 'tslog';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { Interaction, MessageComponentInteraction } from 'discord.js';
import container from '../inversify.config';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';

@injectable()
export class InteractionCreateHandler implements IHandler {
    eventType = 'interactionCreate';
    private logger: Logger<InteractionCreateHandler>;
    constructor(@inject(TYPES.BotLogger) logger: Logger<InteractionCreateHandler>) {
        this.logger = logger;
    }
    async handle(interaction: MessageComponentInteraction) {
        if (!interaction.customId || !interaction.customId.startsWith('defer')) {
            this.logger.debug(
                `Interaction with customId '${interaction.customId}' is not a deferred interaction and will be handled elsewhere.`
            );
            return;
        }
        const interactions = container.getAll<IInteraction>('Interaction');
        const foundInteraction = interactions.find((i: IInteraction) => i.customIds.includes(interaction.customId));
        if (!foundInteraction)
            throw Error(
                `Could not find interaction for ID ${interaction.customId} among ${interactions?.length} interactions.`
            );
        this.logger.debug(`${foundInteraction.constructor.name} is handling the interaction...`);
        await foundInteraction.manage(interaction as unknown as Interaction);
    }
}
