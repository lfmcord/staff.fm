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
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';

@injectable()
export class CrownsCommand implements ICommand {
    name: string = 'crowns';
    description: string =
        'Adds or removes a crowns ban flag for a user. This should usually be done with the !crowns ban command.';
    usageHint: string = '[ban/unban] [user mention/ID] [reason]';
    examples: string[] = ['ban @haiyn sleep scrobbling or something', 'unban @haiyn nvm they good :)'];
    permissionLevel = CommandPermissionLevel.Helper;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<CrownsCommand>;
    private usersRepository: UsersRepository;
    private loggingService: LoggingService;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<CrownsCommand>,
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
        if (args.length < 2) {
            throw new ValidationError(
                `No args provided for crowns.`,
                `You must provide an operation type, Discord user and a reason!`
            );
        }
        if (args.length == 2) {
            throw new ValidationError(`No reason provided, args length 2.`, `You must provide a reason!`);
        }
        if (args[0] !== 'ban' && args[0] !== 'unban') {
            throw new ValidationError(
                `Operation type is ${args[0]} and not recognized.`,
                `The operation type must be either ban or unban!`
            );
        }
        return Promise.resolve();
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const isBan = args[0] == 'ban';
        const userId = TextHelper.getDiscordUserId(args[1]);
        if (!userId) {
            return {
                isSuccessful: false,
                replyToUser: "I cannot recognize the argument you've provided as a Discord user.",
            };
        }
        const foundUser = await this.usersRepository.getUserByUserId(userId);
        if (!foundUser) {
            this.logger.info(`crowns command for user ID ${userId} cannot run because user is not in DB.`);
            return {
                isSuccessful: false,
                replyToUser: `I have no information on this user. Please index them first by running \`>>verify ${userId} [last.fm username]\`.`,
            };
        }

        const hasCrownsBan = foundUser.crownsBan != null;
        const reason = args.slice(2).join();
        let replyToUser;
        if (isBan) {
            if (hasCrownsBan) replyToUser = `This user already has a crowns ban flag.`;
            else {
                this.logger.info(`Command is new crowns ban request, adding crowns ban to DB.`);
                await this.usersRepository.addCrownBanToUser(message.author.id, foundUser.userId, reason);
                replyToUser = `<:nocrown:816944519924809779> I've added the crowns ban flag to <@!${foundUser.userId}>.\n-# Please note that this does not mean they are banned from the WK crowns game. For that, use the WhoKnows command.`;
            }
        } else {
            if (hasCrownsBan) {
                this.logger.info(`Command is new crowns unban request, removing crowns ban from DB.`);
                await this.usersRepository.removeCrownsBanFromUser(message.author.id);
                replyToUser = `👑 I've removed the crowns ban flag from <@!${foundUser.userId}>.\n-# Please note that this does not mean they can participate in the crowns game again. For that, use the WhoKnows command.`;
            } else replyToUser = `This user has no crowns ban flag.`;
        }

        const member = await this.memberService.getGuildMemberFromUserId(foundUser.userId);
        if (!member) {
            replyToUser += ` It seems like this user has left the server.`;
        } else {
            await this.loggingService.logCrownsBan(message.author, member?.user, reason, message, !isBan);
        }

        return {
            isSuccessful: true,
            replyToUser: replyToUser,
        };
    }
}
