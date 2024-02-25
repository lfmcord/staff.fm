import { inject, injectable } from 'inversify';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';
import { ButtonInteraction } from 'discord.js';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { Environment } from '@models/environment';
import container from '../../../inversify.config';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { StaffMailCreateCommand } from '@src/feature/commands/staffmail/staff-mail-create.command';

@injectable()
export class StaffMailCreateButtonInteraction implements IInteraction {
    customIds = ['defer-staff-mail-create-button'];
    logger: Logger<StaffMailCreateButtonInteraction>;
    loggingService: LoggingService;
    staffMailRepository: StaffMailRepository;
    env: Environment;

    constructor(
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.BotLogger) logger: Logger<StaffMailCreateButtonInteraction>,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.env = env;
        this.loggingService = loggingService;
        this.logger = logger;
        this.staffMailRepository = staffMailRepository;
    }

    async manage(interaction: ButtonInteraction) {
        this.logger.debug(`Interaction ID ${interaction.customId} is a StaffMail create button interaction.`);
        const staffmailCommand = container.getAll<ICommand>('Command').find((c) => c.name === 'staffmail');
        (staffmailCommand as StaffMailCreateCommand)?.runInteraction(interaction);
    }
}
