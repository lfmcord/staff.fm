import { inject, injectable } from 'inversify';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { Logger } from 'tslog';
import { IUserModel, UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TextHelper } from '@src/helpers/text.helper';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import moment = require('moment');

@injectable()
export class ImportsCommand implements ICommand {
    name: string = 'imports';
    description: string =
        "Managed importing flags on a user. Use set/unset if you want to add or remove the flag. Use with only a user to see if they're flagged";
    usageHint: string = '[(optional) set/unset] [user mention/ID]';
    examples: string[] = ['@haiyn', 'set @haiyn', 'unset @haiyn'];
    permissionLevel = CommandPermissionLevel.Helper;
    aliases = ['import'];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<ImportsCommand>;
    private usersRepository: UsersRepository;
    private loggingService: LoggingService;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<ImportsCommand>,
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
        if (args.length < 1) {
            throw new ValidationError(
                `No args provided for imports.`,
                `You must provide an operation type (set/unset) and Discord user!`
            );
        }
        return Promise.resolve();
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        let userId = TextHelper.getDiscordUserId(args[0]);
        let operationType = null;
        if (args[0] == 'set' || args[0] == 'unset') {
            operationType = args[0];
            userId = TextHelper.getDiscordUserId(args[1]);
        }
        if (!userId) {
            return {
                isSuccessful: false,
                replyToUser: "I cannot recognize the argument you've provided as a Discord user.",
            };
        }
        const foundUser = await this.usersRepository.getUserByUserId(userId);
        if (!foundUser) {
            this.logger.info(`imports command for user ID ${userId} cannot run because user is not in DB.`);
            return {
                isSuccessful: false,
                replyToUser: `I have no information on this user. Please index them first by running \`>>verify ${userId} [last.fm username]\`.`,
            };
        }

        let replyToUser;
        switch (operationType) {
            case 'set':
                replyToUser = await this.setImports(foundUser, message);
                break;
            case 'unset':
                replyToUser = await this.unsetImports(foundUser, message);
                break;
            default:
                replyToUser = await this.showImports(foundUser);
        }

        return {
            isSuccessful: true,
            replyToUser: replyToUser,
        };
    }

    private async setImports(indexedUser: IUserModel, message: Message): Promise<string> {
        let replyToUser = `📈 I've added the imports flag to <@${indexedUser.userId}>.`;
        if (indexedUser.importsFlagDate == null) {
            await this.usersRepository.addImportsFlagDateToUser(indexedUser.userId);
            const user = await this.memberService.fetchUser(indexedUser.userId);
            if (!user) {
                replyToUser += ` It seems like this user has left the server.`;
            } else {
                await this.loggingService.logImports(message.author, user, false);
            }
        } else {
            replyToUser = `<@${indexedUser.userId}> already has an import flag from <t:${moment(indexedUser.importsFlagDate).unix()}:d>.`;
        }

        return replyToUser;
    }

    private async unsetImports(indexedUser: IUserModel, message: Message): Promise<string> {
        let replyToUser = `📉 I've removed the imports flag from <@${indexedUser.userId}>.`;
        if (indexedUser.importsFlagDate) {
            await this.usersRepository.removeImportsFlagDateFromUser(indexedUser.userId);
            const user = await this.memberService.fetchUser(indexedUser.userId);
            if (!user) {
                replyToUser += ` It seems like this user has left the server.`;
            } else {
                await this.loggingService.logImports(message.author, user, true);
            }
        } else {
            replyToUser = `<@${indexedUser.userId}> has no import flag.`;
        }

        return replyToUser;
    }

    private async showImports(indexedUser: IUserModel): Promise<string> {
        return indexedUser.importsFlagDate != null
            ? `<@${indexedUser.userId}> has been flagged for imports on <t:${moment(indexedUser.importsFlagDate).unix()}:d>.`
            : `<@${indexedUser.userId}> has not been flagged for imports.`;
    }
}
