import { ICommand } from '@src/feature/commands/models/command.interface';
import { SelfMuteUnmuteCommand } from '@src/feature/commands/utility/self-mute-unmute.command';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import container from '@src/inversify.config';
import { TYPES } from '@src/types';
import { ButtonInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class EndSelfmuteButtonInteraction implements IMessageComponentInteraction {
    customIds = ['defer-end-selfmute'];
    logger: Logger<EndSelfmuteButtonInteraction>;

    constructor(@inject(TYPES.BotLogger) logger: Logger<EndSelfmuteButtonInteraction>) {
        this.logger = logger;
    }

    async manage(interaction: ButtonInteraction) {
        this.logger.debug(`Interaction ID ${interaction.customId} is a end selfmute button interaction.`);
        const selfmuteUnmuteCommand = container.getAll<ICommand>('Command').find((c) => c.name === 'unmute');
        (selfmuteUnmuteCommand as SelfMuteUnmuteCommand)?.runInteraction(interaction);
    }
}
