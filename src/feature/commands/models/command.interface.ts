import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import {
    Interaction,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export interface ICommand {
    name: string;
    description: string;
    permissionLevel: CommandPermissionLevel;
    definition: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;

    /**
     * Runs the command.
     * @param interaction The slash command that triggered the command.\
     * @returns CommandResultModel when the command finished running.
     * @throws Error when command could not be completed.
     */
    run(interaction: Interaction): Promise<CommandResult>;

    /**
     * Validates the arguments given after a command. Throws an error if validation failed.
     * @param interaction the interaction to validate.
     * @throws Error Validation failed, error message contains message to user.
     */
    validateArgs(interaction: Interaction): Promise<void>;
}
