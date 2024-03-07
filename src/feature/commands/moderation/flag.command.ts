import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { TYPES } from '@src/types';
import * as moment from 'moment';

@injectable()
export class FlagCommand implements ICommand {
    name: string = 'flag';
    description: string =
        "Flags a term as suspicious or otherwise malicious in order to show a warning if someone' last.fm username contains it. Can be a full last.fm username or just a part of it.";
    usageHint: string = '<term to flag> <reason>';
    examples: string[] = ['haiyn big dummy', '1488 people with that in their name are nazis'];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;

    private flagsRepository: FlagsRepository;

    constructor(@inject(TYPES.FlagsRepository) flagsRepository: FlagsRepository) {
        this.flagsRepository = flagsRepository;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const term = args[0].toLowerCase();
        const reason = args.slice(1).join(' ');

        const flag = await this.flagsRepository.getFlagByTerm(term);
        if (flag) {
            return {
                isSuccessful: false,
                reason: `Flag for term ${term} already exists in database.`,
                replyToUser: `${inlineCode(term)} is already on the list of flagged terms!\nReason: '${flag.reason}' (created <t:${moment(flag.createdAt).unix()}:D> by <@!${flag.createdById}>)`,
            };
        }

        await this.flagsRepository.addFlag(term, reason, message.author!);

        return {
            isSuccessful: true,
            replyToUser: `I've successfully added ${inlineCode(term)} to the list of flagged terms.`,
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
