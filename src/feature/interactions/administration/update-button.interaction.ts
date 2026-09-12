import { ICommand } from '@src/feature/commands/models/command.interface';
import { UpdateCommand } from '@src/feature/commands/utility/update.command';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import container from '@src/inversify.config';
import { TYPES } from '@src/types';
import { ButtonInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class UpdateButtonInteraction implements IMessageComponentInteraction {
    customIds = ['defer-update-scrobbles'];
    logger: Logger<UpdateButtonInteraction>;

    constructor(@inject(TYPES.BotLogger) logger: Logger<UpdateButtonInteraction>) {
        this.logger = logger;
    }

    async manage(interaction: ButtonInteraction) {
        const updateCommand = container.getAll<ICommand>('Command').find((c) => c.name === 'update');
        (updateCommand as UpdateCommand)?.runInteraction(interaction);
    }
}
