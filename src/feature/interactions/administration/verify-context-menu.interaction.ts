import { VerifyCommand } from '@src/feature/commands/administration/verify.command';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { IMessageContextMenuInteraction } from '@src/feature/interactions/abstractions/message-context-menu-interaction.interface';
import { CommandService } from '@src/infrastructure/services/command.service';
import container from '@src/inversify.config';
import { TYPES } from '@src/types';
import {
    ApplicationCommandType,
    ContextMenuCommandBuilder,
    GuildMember,
    MessageContextMenuCommandInteraction,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { Promise } from 'mongoose';
import { Logger } from 'tslog';

@injectable()
export class VerifyContextMenuInteraction implements IMessageContextMenuInteraction {
    data: ContextMenuCommandBuilder = new ContextMenuCommandBuilder()
        .setName('Verify User')
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
        const verifyCommand = container.getAll<ICommand>('Command').find((c) => c.name == 'verify') as VerifyCommand;
        const start = new Date().getTime();
        let result: CommandResult;
        await interaction.deferReply({ ephemeral: true });
        if (!(await this.commandService.isPermittedToRun(interaction.member as GuildMember, verifyCommand))) {
            await this.commandService.handleError(
                interaction,
                `You do not have sufficient permissions to use this command.`
            );
            return;
        }
        try {
            result = await verifyCommand.runInteraction(interaction);
        } catch (e: unknown) {
            this.logger.error(`Failed to run interaction command '${verifyCommand?.name}'`, e);
            await this.commandService.handleError(
                interaction,
                (e as ValidationError).messageToUser ? (e as ValidationError).messageToUser : undefined
            );
            return;
        }
        const end = new Date().getTime();
        await this.commandService.handleResult(interaction, result, verifyCommand.name, end - start);
    }
}
