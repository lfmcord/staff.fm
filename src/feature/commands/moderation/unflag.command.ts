import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TextHelper } from '@src/helpers/text.helper';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { TYPES } from '@src/types';
import { inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';

@injectable()
export class UnflagCommand implements ICommand {
    name: string = 'unflag';
    description: string = 'Deletes one or multiple flagged terms. Separate flags to delete with a space.';
    usageHint: string = '';
    examples: string[] = [];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = ['deleteflag', 'removeflag'];
    isUsableInDms = false;
    isUsableInServer = true;
    loggingService: LoggingService;

    private flagsRepository: FlagsRepository;

    constructor(
        @inject(TYPES.FlagsRepository) flagsRepository: FlagsRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.loggingService = loggingService;
        this.flagsRepository = flagsRepository;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const entriesToDelete = await this.flagsRepository.getFlagsByTerms(args);

        if (entriesToDelete.length === 0) {
            return {
                isSuccessful: false,
                replyToUser: `None of the terms you gave me are flagged.`,
            };
        }

        await this.flagsRepository.deleteFlagsByTerms(args);

        for (const entry of entriesToDelete) {
            await this.loggingService.logFlag(message.author, entry, true);
        }

        return {
            isSuccessful: true,
            replyToUser: `I've removed the following ${TextHelper.pluralize('flag', entriesToDelete.length)}: ${entriesToDelete.map((s) => inlineCode(s.term)).join(', ')}.`,
        };
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(`args length is 0.`, `You have to provide one or more flagged term to remove!`);
        }
        return Promise.resolve();
    }
}
