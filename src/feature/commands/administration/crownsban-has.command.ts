import { inject, injectable } from 'inversify';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { Logger } from 'tslog';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { TYPES } from '@src/types';
import { bold, Message } from 'discord.js';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TextHelper } from '@src/helpers/text.helper';
import moment = require('moment');
import { MemberService } from '@src/infrastructure/services/member.service';

@injectable()
export class CrownsBanHasCommand implements ICommand {
    name: string = 'hascrownsban';
    description: string = 'Shows if the provided user has been banned from the crowns game.';
    usageHint: string = '[user mention/ID]';
    examples: string[] = ['@haiyn'];
    permissionLevel = CommandPermissionLevel.Helper;
    aliases = ['crownsban', 'iscrownsbanned'];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<CrownsBanHasCommand>;
    private usersRepository: UsersRepository;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<CrownsBanHasCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.usersRepository = usersRepository;
        this.logger = logger;
        this.memberService = memberService;
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(`No args provided for crownsbanhas.`, `You must provide a Discord user!`);
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
            this.logger.info(`crownsbanhas command for user ID ${userId} cannot run because user is not in DB.`);
            return {
                isSuccessful: false,
                replyToUser: `I have no information on this user. Please index them first by running \`>>verify ${userId} [last.fm username]\`.`,
            };
        }

        let replyToUser = '👑 This user is not crowns banned.';
        if (foundUser.crownsBan != null) {
            const actor = await this.memberService.getGuildMemberFromUserId(foundUser.crownsBan.bannedById);
            replyToUser = `<:nocrown:816944519924809779> This user has been crowns banned on <t:${moment(foundUser.crownsBan.bannedOn).unix()}:f> by ${TextHelper.userDisplay(actor?.user, false)}.`;
            replyToUser += `\n📝 ${bold('Reason:')} ${foundUser.crownsBan.reason ? foundUser.crownsBan.reason : 'No reason provided. Check the logs to find the reason.'}`;
        }

        return {
            isSuccessful: true,
            replyToUser: replyToUser,
        };
    }
}
