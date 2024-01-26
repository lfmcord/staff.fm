import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Message, PartialMessage } from 'discord.js';

export interface ICommand {
    name: string;
    description: string;
    usageHint: string;
    examples: string[];
    needsPrivilege: boolean;
    aliases: string[];

    /**
     * Runs the command.
     * @param message The message that triggered the command.
     * @param args The list of words (separated by spaces) that were given after the command.
     * @returns CommandResultModel when the command finished running.
     * @throws Error when command could not be completed.
     */
    run(message: Message | PartialMessage, args: string[]): Promise<CommandResult>;

    /**
     * Validates the arguments given after a command. Throws an error if validation failed.
     * @param args the arguments to validate.
     * @throws Error Validation failed, error message contains message to user.
     */
    validateArgs(args: string[]): Promise<void>;
}
