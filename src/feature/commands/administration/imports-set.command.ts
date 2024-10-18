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
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';

@injectable()
export class ImportsSetCommand implements ICommand {
    name: string = 'setimports';
    description: string = 'Flags that a user has imported.';
    usageHint: string = '[user mention/ID]';
    examples: string[] = ['@haiyn'];
    permissionLevel = CommandPermissionLevel.Helper;
    aliases = ['addimports', 'flagimports'];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<ImportsSetCommand>;
    private usersRepository: UsersRepository;
    private loggingService: LoggingService;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<ImportsSetCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.usersRepository = usersRepository;
        this.logger = logger;
        this.loggingService = loggingService;
        this.memberService = memberService;
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(`No args provided for setimports.`, `You must provide a Discord user!`);
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
            this.logger.info(`Setimports command for user ID ${userId} cannot run because user is not in DB.`);
            return {
                isSuccessful: false,
                replyToUser: `I have no information on this user. Please index them first by running \`>>verify ${userId} [last.fm username]\`.`,
            };
        }
        let replyToUser = `I've flagged <@!${foundUser.userId}> for imports.`;

        if (foundUser.importsFlagDate) {
            replyToUser = `This user was already flagged for imports on <t:${moment(foundUser.importsFlagDate).unix()}:f>.`;
        } else {
            await this.usersRepository.addImportsFlagDateToUser(foundUser.userId);
            const member = await this.memberService.getGuildMemberFromUserId(foundUser.userId);
            if (!member) {
                replyToUser += ` It seems like this user has left the server.`;
            } else {
                await this.loggingService.logImports(message.author, member?.user);
            }
        }

        return {
            isSuccessful: true,
            replyToUser: replyToUser,
        };
    }
}
