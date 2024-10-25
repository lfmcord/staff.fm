import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { TYPES } from '@src/types';
import * as moment from 'moment';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { Flag } from '@src/feature/commands/moderation/models/flag.model';
import { TextHelper } from '@src/helpers/text.helper';

@injectable()
export class FlagCommand implements ICommand {
    name: string = 'flag';
    description: string =
        'Flags a term as suspicious or otherwise malicious in order to show a warning if someone posts in the verification channel. Can be a full or partial last.fm username, discord username/displayname or a discord user ID.';
    usageHint: string = '<term to flag> <reason>';
    examples: string[] = [
        'haiyn big dummy',
        '1488 people with that in their name are nazis',
        '356178941913858049 unresolved business with staff',
    ];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = [];
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
        const flag: Flag = {
            term: args[0].toLowerCase(),
            reason: args.slice(1).join(' '),
            createdBy: message.author,
            createdAt: moment.utc().toDate(),
        };

        const existingFlag = await this.flagsRepository.getFlagByTerm(flag.term);
        if (existingFlag) {
            return {
                isSuccessful: false,
                reason: `Flag for term ${flag.term} already exists in database.`,
                replyToUser: `${inlineCode(flag.term)} is already on the list of flagged terms!\nReason: '${flag.reason}' (created <t:${moment(flag.createdAt).unix()}:D> by ${TextHelper.userDisplay(flag.createdBy)})`,
            };
        }

        await this.flagsRepository.addFlag(flag);

        await this.loggingService.logFlag(flag);

        return {
            isSuccessful: true,
            replyToUser: `I've successfully added ${inlineCode(flag.term)} to the list of flagged terms.`,
        };
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(
                `No args provided for flag.`,
                `You must provide a term to flag, together with a reason!`
            );
        }
        if (args.length === 1) {
            throw new ValidationError(`No reason provided for flag.`, `You must provide a reason for the flag!`);
        }
        return Promise.resolve();
    }
}
