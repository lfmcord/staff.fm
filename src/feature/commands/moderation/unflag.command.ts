import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { TYPES } from '@src/types';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TextHelper } from '@src/helpers/text.helper';

@injectable()
export class UnflagCommand implements ICommand {
    name: string = 'unflag';
    description: string = 'Deletes a flagged term.';
    usageHint: string = '';
    examples: string[] = [];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = ['deleteflag', 'removeflag'];
    isUsableInDms = false;
    isUsableInServer = true;

    private flagsRepository: FlagsRepository;

    constructor(@inject(TYPES.FlagsRepository) flagsRepository: FlagsRepository) {
        this.flagsRepository = flagsRepository;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const deletedCount = await this.flagsRepository.deleteFlagsByTerms(args);

        return {
            isSuccessful: true,
            replyToUser: `I've removed ${deletedCount} ${TextHelper.pluralize('flag', deletedCount)}.`,
        };
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(
                new Error(`args are 0.`),
                `You have to provide one or more flagged term to remove!`
            );
        }
        return Promise.resolve();
    }
}
