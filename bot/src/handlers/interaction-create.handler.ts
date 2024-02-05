import { IHandler } from '@src/handlers/models/handler.interface';
import { Logger } from 'tslog';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { ButtonInteraction, Interaction } from 'discord.js';
import container from '../../inversify.config';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';

@injectable()
export class InteractionCreateHandler implements IHandler {
    eventType = 'interactionCreate';
    private logger: Logger<InteractionCreateHandler>;
    constructor(@inject(TYPES.BotLogger) logger: Logger<InteractionCreateHandler>) {
        this.logger = logger;
    }
    async handle(interaction: Interaction) {
        const interactions = container.getAll<IInteraction>('Interaction');
        /* eslint-disable */
        const foundInteraction = interactions.find((i: IInteraction) => i.customId === (interaction as any).customId);
        if (!foundInteraction)
            throw Error(
                /* eslint-disable */
                `Could not find interaction for ID ${(interaction as any).customId} among ${interactions?.length} interactions.`
            );
        this.logger.debug(`${foundInteraction.constructor.name} is handling the interaction...`);
        await foundInteraction.manage(interaction);
    }

    private async handleButtonInteraction(interaction: ButtonInteraction) {}
}
