import { CommandResult } from '@models/CommandResult';
import { Message, PartialMessage } from 'discord.js';

export interface ICommand {
    name: string;
    description: string;
    usageHint: string;
    needsPrivilege: boolean;

    /**
     * Runs the command.
     * @param message The message that triggered the command.
     * @param args The list of words (separated by spaces) that were given after the command.
     * @returns CommandResultModel when the command finished running.
     * @throws Error when command could not be completed.
     */
    run(message: Message | PartialMessage, args: string[]): Promise<CommandResult>;
}
