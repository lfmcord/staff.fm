import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { StrikeHelper } from '@src/helpers/strike.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment/moment';
import { Logger } from 'tslog';

@injectable()
export class StrikesManageCommand implements ICommand {
    name: string = 'smanage';
    description: string =
        'Manage strikes.\n' +
        'Operations:\n' +
        '-`add`: Silently add a strike to a user. They will not be informed or muted.\n' +
        '-`remove`: Silently remove a strike from a user. They will not be informed or unmuted.\n' +
        '-`transfer`: Tansfer strikes from the first mentioned user to the second. Existing strikes will be overwritten.\n';
    usageHint: string = 'add  | remove | transfer';
    examples: string[] = [
        'add @haiyn reason for strike',
        'remove @haiyn reason for manual removal',
        'transfer @haiyn @altofhaiyn',
    ];
    permissionLevel = CommandPermissionLevel.Moderator;
    operations = ['add', 'remove', 'transfer'];
    aliases = ['strikemanage', 'strikesmanage'];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<StrikesManageCommand>;
    private memberService: MemberService;
    private usersRepository: UsersRepository;
    private environment: Environment;
    private loggingService: LoggingService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StrikesManageCommand>,
        @inject(TYPES.ENVIRONMENT) environment: Environment,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.logger = logger;
        this.environment = environment;
        this.loggingService = loggingService;
    }

    validateArgs(args: string[]): Promise<void> {
        // Check if the first argument is a valid operation
        if (args[0] && !this.operations.includes(args[0])) {
            throw new ValidationError(
                `Operation type ${args[0]} not valid for strikemanage.`,
                `You must provide a one of the following operation types: ${this.operations.join(', ')}`
            );
        }

        return Promise.resolve();
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        let result: CommandResult;
        switch (args[0]) {
            case this.operations[0]:
                result = await this.addStrike(message, args);
                break;
            case this.operations[1]:
                result = await this.removeStrike(message, args);
                break;
            case this.operations[2]:
                result = await this.transferStrikes(message, args);
                break;
            default:
                throw new ValidationError(
                    `Operation type ${args[0]} not valid.`,
                    `You must provide a one of the following operation types: ${this.operations.join(', ')}`
                );
        }

        return result;
    }

    async addStrike(message: Message, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[1])!;
        const member = await this.memberService.getGuildMemberFromUserId(userId);
        if (!member) {
            return {
                isSuccessful: false,
                replyToUser: `I cannot strike this user because they are not in the server.`,
            };
        }
        const reason = args.slice(2).join(' ');

        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (!indexedUser) {
            this.logger.info(`User ${TextHelper.userLog(member.user)} is not indexed. Indexing...`);
            await this.usersRepository.addUserWithoutVerification(userId);
        }
        const activeStrikes = StrikeHelper.getActiveStrikes(indexedUser?.strikes ?? []);

        const logMessage = await this.loggingService.logStrike(
            member.user,
            message.author,
            reason,
            activeStrikes.length + 1,
            indexedUser?.strikes ? indexedUser.strikes.length + 1 : 1,
            'Manual'
        );

        const now = moment();
        await this.usersRepository.addStrikeToUser(
            member.user,
            message.author,
            reason,
            now.toDate(),
            now.add(this.environment.MODERATION.STRIKE_EXPIRATION_IN_MONTHS, 'months').toDate(),
            logMessage ? TextHelper.getDiscordMessageLink(logMessage) : undefined
        );

        return {
            isSuccessful: true,
            replyToUser: `I've added a strike to ${TextHelper.userLog(member.user)} for reason: ${reason}`,
        };
    }

    async removeStrike(message: Message, args: string[]): Promise<CommandResult> {
        return {
            isSuccessful: false,
            replyToUser: `strikemanage remove is not implemented yet.`,
        };

        // const userId = TextHelper.getDiscordUserId(args[0])!;
        // const member = await this.memberService.getGuildMemberFromUserId(userId);
        // if (!member) {
        //     return {
        //         isSuccessful: false,
        //         replyToUser: `I cannot remove a strike from this user because they are not in the server.`,
        //     };
        // }
        // const reason = args.slice(1).join(' ');
        //
        // const indexedUser = await this.usersRepository.getUserByUserId(userId);
        // if (!indexedUser || indexedUser.strikes?.length === 0) {
        //     return {
        //         isSuccessful: false,
        //         replyToUser: `I cannot remove a strike from this user because they have no strikes.`,
        //     };
        // }
        // const activeStrikes = StrikeHelper.getActiveStrikes(indexedUser?.strikes ?? []);
        //
        // TODO: Implement strike remove selection
        //
        // await this.usersRepository.removeStrikeFromUser(member.user, message.author, reason);
        //
        // const logMessage = await this.loggingService.logStrikeRemove(
        //     member.user,
        //     message.author,
        //     reason,
        //     activeStrikes.length - 1,
        //     indexedUser?.strikes ? indexedUser.strikes.length - 1 : 0
        // );
        //
        // return {
        //     isSuccessful: true,
        //     replyToUser: `I've removed a strike from ${TextHelper.userLog(member.user)} for reason: ${reason}`,
        // };
    }

    async transferStrikes(message: Message, args: string[]): Promise<CommandResult> {
        const sourceUserId = TextHelper.getDiscordUserId(args[1])!;
        const targetUserId = TextHelper.getDiscordUserId(args[2])!;
        if (!sourceUserId || !targetUserId) {
            throw new ValidationError(
                `${args[1]} and/or ${args[2]} are not a valid user ID`,
                `You must provide two valid Discord users.`
            );
        }
        const sourceUser = await this.memberService.fetchUser(sourceUserId);
        const targetMember = await this.memberService.getGuildMemberFromUserId(targetUserId);

        if (!targetMember) {
            return {
                isSuccessful: false,
                replyToUser: `I cannot transfer strikes to <@!${targetUserId}> because they are not in the server.`,
            };
        }

        const indexedSourceUser = await this.usersRepository.getUserByUserId(sourceUserId);
        const indexedTargetUser = await this.usersRepository.getUserByUserId(targetUserId);

        if (!indexedSourceUser || indexedSourceUser.strikes?.length === 0) {
            return {
                isSuccessful: false,
                replyToUser: `I cannot transfer strikes from <@!${sourceUserId}> because they have no strikes.`,
            };
        }
        if (!indexedTargetUser) {
            this.logger.info(`User ${targetUserId} is not indexed. Indexing...`);
            await this.usersRepository.addUserWithoutVerification(targetUserId);
        }

        const overwrittenStrikes = indexedTargetUser?.strikes?.length ?? 0;
        if (overwrittenStrikes > 0) {
            for (const strike of indexedTargetUser!.strikes!) {
                await this.usersRepository.removeStrikeFromUser(targetUserId, strike._id);
                await this.loggingService.logStrikeRemove(
                    targetMember.user,
                    message.author,
                    `Removed due to transfer from ${sourceUser ? TextHelper.userDisplay(sourceUser) : sourceUserId}`
                );
            }
        }

        let activeCount = 0;
        let inactiveCount = 0;
        for (const strike of indexedSourceUser.strikes!) {
            await this.usersRepository.addStrikeToUser(
                targetMember.user,
                message.author,
                strike.reason,
                strike.createdAt,
                strike.expiresOn,
                strike.strikeLogLink
            );
            if (strike.expiresOn && strike.expiresOn > new Date()) {
                activeCount++;
            } else {
                inactiveCount++;
            }
            await this.loggingService.logStrike(
                targetMember.user,
                message.author,
                strike.reason + ` (transferred from ${sourceUser ? TextHelper.userDisplay(sourceUser) : sourceUserId})`,
                activeCount,
                activeCount + inactiveCount,
                'Manual'
            );
        }

        let reply = `I've transferred ${indexedSourceUser.strikes!.length} strikes from ${sourceUser ? TextHelper.userLog(sourceUser) : sourceUserId} to ${TextHelper.userLog(targetMember.user)}.`;
        if (overwrittenStrikes > 0) {
            reply += ` ${overwrittenStrikes} strikes from ${TextHelper.userLog(targetMember.user)} were overwritten.`;
        }
        return {
            isSuccessful: true,
            replyToUser: reply,
        };
    }
}
