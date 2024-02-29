import { inject, injectable } from 'inversify';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';
import { ButtonInteraction } from 'discord.js';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import container from '../../inversify.config';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { StaffMailCreateCommand } from '@src/feature/commands/staffmail/staff-mail-create.command';

@injectable()
export class StaffMailCreateButtonInteraction implements IInteraction {
    customIds = ['defer-staff-mail-create-button'];
    logger: Logger<StaffMailCreateButtonInteraction>;

    constructor(@inject(TYPES.BotLogger) logger: Logger<StaffMailCreateButtonInteraction>) {
        this.logger = logger;
    }

    async manage(interaction: ButtonInteraction) {
        this.logger.debug(`Interaction ID ${interaction.customId} is a StaffMail create button interaction.`);
        const staffmailCommand = container.getAll<ICommand>('Command').find((c) => c.name === 'staffmail');
        (staffmailCommand as StaffMailCreateCommand)?.runInteraction(interaction);
    }
}
