import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } from 'discord.js';
import { IMessageContextMenuInteraction } from '@src/feature/interactions/abstractions/message-context-menu-interaction.interface';
import { Promise } from 'mongoose';
import container from '@src/inversify.config';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { Logger } from 'tslog';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { CommandService } from '@src/infrastructure/services/command.service';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { StaffMailReportCommand } from '@src/feature/commands/staffmail/staff-mail-report.command';

@injectable()
export class StaffMailReportInteraction implements IMessageContextMenuInteraction {
    data: ContextMenuCommandBuilder = new ContextMenuCommandBuilder()
        .setName('Report Message')
        .setType(ApplicationCommandType.Message);
    logger: Logger<ContextMenuCommandBuilder>;
    commandService: CommandService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<ContextMenuCommandBuilder>,
        @inject(TYPES.CommandService) commandService: CommandService
    ) {
        this.commandService = commandService;
        this.logger = logger;
    }

    async manage(interaction: MessageContextMenuCommandInteraction): Promise<void> {
        const reportCommand = container
            .getAll<ICommand>('Command')
            .find((c) => c.name == 'report') as StaffMailReportCommand;
        const start = new Date().getTime();
        let result: CommandResult;
        await interaction.deferReply({ ephemeral: true });
        try {
            result = await reportCommand.runInteraction(interaction);
        } catch (e: unknown) {
            this.logger.error(`Failed to run interaction command '${reportCommand?.name}'`, e);
            await this.commandService.handleCommandErrorForInteraction(
                interaction,
                (e as ValidationError).messageToUser ? (e as ValidationError).messageToUser : undefined
            );
            return;
        }
        const end = new Date().getTime();
        await this.commandService.handleCommandResultForInteraction(
            interaction,
            result,
            reportCommand.name,
            end - start
        );
    }
}
