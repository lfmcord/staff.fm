import { inject, injectable } from 'inversify';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { Logger } from 'tslog';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TextHelper } from '@src/helpers/text.helper';
import moment = require('moment');

@injectable()
export class ImportsHasCommand implements ICommand {
    name: string = 'hasimports';
    description: string = 'Shows if the provided user has been flagged for importing before.';
    usageHint: string = '[user mention/ID]';
    examples: string[] = ['@haiyn'];
    permissionLevel = CommandPermissionLevel.Helper;
    aliases = ['imports', 'isimporting'];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<ImportsHasCommand>;
    private usersRepository: UsersRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<ImportsHasCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository
    ) {
        this.usersRepository = usersRepository;
        this.logger = logger;
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(`No args provided for hasimports.`, `You must provide a Discord user!`);
        }
        return Promise.resolve();
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0]);
        if (!userId) {
            return {
                isSuccessful: false,
                replyToUser: "I cannot recognize the argument you've provided as a Discord user.",
            };
        }
        const foundUser = await this.usersRepository.getUserByUserId(userId);
        if (!foundUser) {
            this.logger.info(`Hasimports command for user ID ${userId} cannot run because user is not in DB.`);
            return {
                isSuccessful: false,
                replyToUser: `I have no information on this user. Please index them first by running \`>>verify ${userId} [last.fm username]\`.`,
            };
        }

        return {
            isSuccessful: true,
            replyToUser:
                foundUser.importsFlagDate != null
                    ? `This user has been flagged for imports on <t:${moment(foundUser.importsFlagDate).unix()}:f>.`
                    : 'This user has not been flagged for imports.',
        };
    }
}
