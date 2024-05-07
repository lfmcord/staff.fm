import {
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    MessageContextMenuCommandInteraction,
    GuildMember,
} from 'discord.js';
import { IMessageContextMenuInteraction } from '@src/feature/interactions/abstractions/message-context-menu-interaction.interface';
import { Promise } from 'mongoose';
import container from '@src/inversify.config';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { VerifyCommand } from '@src/feature/commands/utility/verify.command';
import { Logger } from 'tslog';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { CommandService } from '@src/infrastructure/services/command.service';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { CommandResult } from '@src/feature/commands/models/command-result.model';

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
            await this.commandService.handleCommandErrorForInteraction(
                interaction,
                `You do not have sufficient permissions to use this command.`
            );
            return;
        }
        try {
            result = await verifyCommand.run(interaction.targetMessage, [
                interaction.targetMessage.author.id,
                interaction.targetMessage.content,
            ]);
        } catch (e: unknown) {
            this.logger.error(`Failed to run interaction command '${verifyCommand?.name}'`, e);
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
            verifyCommand.name,
            end - start
        );
    }
}
