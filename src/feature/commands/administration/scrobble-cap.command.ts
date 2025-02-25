import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { findValueInMap } from '@src/helpers/map.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { IUserModel, UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { Logger } from 'tslog';

@injectable()
export class ScrobbleCapCommand implements ICommand {
    name: string = 'scrobblecap';
    description: string =
        'Gets, sets or removes a maximum scrobble role cap for a user. If a user has a scrobble role cap set, they cannot update themselves higher than that cap.';
    usageHint: string = '<user ID/mention> | set <user ID/mention> <scrobble role number> | unset <user ID/mention>';
    examples: string[] = ['356178941913858049', 'set 356178941913858049 300000', 'set @haiyn 150000', 'unset'];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = ['cap'];
    isUsableInDms = false;
    isUsableInServer = true;

    private env: Environment;
    private usersRepository: UsersRepository;
    private loggingService: LoggingService;
    private logger: Logger<ScrobbleCapCommand>;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.BotLogger) logger: Logger<ScrobbleCapCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.env = env;
        this.loggingService = loggingService;
        this.logger = logger;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.description += `\nAvailable scrobble caps are: ${[...this.env.ROLES.SCROBBLE_MILESTONES.keys()].join(',')}.`;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const userId =
            args[0] != 'set' && args[0] != 'unset'
                ? TextHelper.getDiscordUserId(args[0])
                : TextHelper.getDiscordUserId(args[1]);
        if (!userId) throw new ValidationError('Invalid user ID.', `I couldn't find a valid Discord user ID.`);
        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (indexedUser == null) {
            return {
                isSuccessful: false,
                replyToUser: `I can't find any information on this user. Please index them with \`${this.env.CORE.PREFIX}link ${userId} [last.fm username]\`.`,
            };
        }

        let result: CommandResult;
        switch (args[0]) {
            case 'set':
                result = await this.setScrobbleCap(indexedUser, message, parseInt(args[2]), args.slice(3).join(' '));
                break;
            case 'unset':
                result = await this.unsetScrobbleCap(indexedUser, message, args.slice(2).join(' '));
                break;
            default:
                result = await this.getScrobbleCap(indexedUser);
                break;
        }

        return result;
    }

    async validateArgs(args: string[]): Promise<void> {
        if (args.length < 1) {
            throw new ValidationError(
                `Expected >1 argument, got ${args.length}.`,
                'You must either specify a user ID, or use the set/unset subcommands.'
            );
        }

        if (args[0] == 'set') {
            if (args.length < 4) {
                throw new ValidationError(
                    `Expected >3 arguments, got ${args.length}.`,
                    'You must specify a user ID, a scrobble number cap and a reason.'
                );
            }

            if (!TextHelper.isDiscordUser(args[1]))
                throw new ValidationError('Invalid user ID.', `\`${args[1]}\` is not a valid Discord user ID.`);

            if (!this.env.ROLES.SCROBBLE_MILESTONES.has(parseInt(args[2])))
                throw new ValidationError(
                    'Invalid scrobble role number.',
                    `\`${args[2]}\` is not a valid scrobble role number. Available scrobble caps are: ${[
                        ...this.env.ROLES.SCROBBLE_MILESTONES.keys(),
                    ].join(', ')}.`
                );
        } else if (args[0] == 'unset') {
            if (args.length < 3) {
                throw new ValidationError(
                    `Expected >2 arguments, got ${args.length}.`,
                    'You must specify a user ID and a reason for the removal of the cap.'
                );
            }

            if (!TextHelper.isDiscordUser(args[1]))
                throw new ValidationError('Invalid user ID.', `\`${args[1]}\` is not a valid Discord user ID.`);
        } else {
            if (!TextHelper.isDiscordUser(args[0]))
                throw new ValidationError('Invalid user ID.', `\`${args[0]}\` is not a valid Discord user ID.`);
        }
    }

    async getScrobbleCap(indexedUser: IUserModel): Promise<CommandResult> {
        if (!indexedUser.scrobbleCap)
            return {
                isSuccessful: true,
                replyToUser: `This user has no scrobble cap set.`,
            };
        const scrobbleRoleNumber = findValueInMap(
            this.env.ROLES.SCROBBLE_MILESTONES,
            indexedUser.scrobbleCap.roleId
        ) as number;
        if (!scrobbleRoleNumber) {
            throw new Error(`Scrobble role number not found for role ID ${indexedUser.scrobbleCap!.roleId}.`);
        }
        return {
            isSuccessful: true,
            replyToUser: indexedUser.scrobbleCap
                ? `🚫 <@!${indexedUser.userId}> has a scrobble cap set at ${TextHelper.numberWithCommas(scrobbleRoleNumber)} scrobbles on <t:${moment(indexedUser.scrobbleCap.setOn).unix()}:d> by <@!${indexedUser.scrobbleCap.setBy}>: ${indexedUser.scrobbleCap.reason}.`
                : 'This user has no scrobble cap set.',
        };
    }

    async setScrobbleCap(
        indexedUser: IUserModel,
        message: Message,
        cap: number,
        reason: string
    ): Promise<CommandResult> {
        if (indexedUser.scrobbleCap) {
            const scrobbleRoleNumber = findValueInMap(
                this.env.ROLES.SCROBBLE_MILESTONES,
                indexedUser.scrobbleCap.roleId
            ) as number;
            return {
                isSuccessful: false,
                replyToUser:
                    `🚫 <@!${indexedUser.userId}> already has a scrobble cap set at ${TextHelper.numberWithCommas(scrobbleRoleNumber)} scrobbles on <t:${moment(indexedUser.scrobbleCap.setOn).unix()}:d> by <@!${indexedUser.scrobbleCap.setBy}>: ${indexedUser.scrobbleCap.reason}.` +
                    `\nPlease unset it first with \`${this.env.CORE.PREFIX}scrobblecap unset ${indexedUser.userId}\`.`,
            };
        }

        const discordUser = await this.memberService.fetchUser(indexedUser.userId);
        if (!discordUser)
            return {
                isSuccessful: false,
                replyToUser: `Cannot find user with user ID ${indexedUser.userId}.`,
            };

        this.logger.info(`Setting scrobble cap of user ${indexedUser.userId}.`);
        const scrobbleRoleId = this.env.ROLES.SCROBBLE_MILESTONES.get(cap);
        if (!scrobbleRoleId) throw new Error(`Scrobble role ID not found for role number ${cap}.`);
        await this.usersRepository.addScrobbleCapToUser(indexedUser.userId, message.author.id, scrobbleRoleId, reason);
        await this.loggingService.logScrobbleCap(discordUser, message.author, reason, message, scrobbleRoleId);

        return {
            isSuccessful: true,
            replyToUser: `🚫 I've set the scrobble cap of <@!${indexedUser.userId}> to ${TextHelper.numberWithCommas(cap)} scrobbles. Reason: ${reason}.`,
        };
    }

    async unsetScrobbleCap(indexedUser: IUserModel, message: Message, reason: string): Promise<CommandResult> {
        if (!indexedUser.scrobbleCap) {
            return {
                isSuccessful: false,
                replyToUser: `This user has no scrobble cap set.`,
            };
        }

        const discordUser = await this.memberService.fetchUser(indexedUser.userId);
        if (!discordUser)
            return {
                isSuccessful: false,
                replyToUser: `Cannot find user with user ID ${indexedUser.userId}.`,
            };

        this.logger.info(`Removing scrobble cap from user ${indexedUser.userId}.`);
        await this.usersRepository.removeScrobbleCapFromUser(indexedUser.userId);
        await this.loggingService.logScrobbleCap(discordUser, message.author, reason, message);

        return {
            isSuccessful: true,
            replyToUser: `☑️ I've removed the scrobble cap from <@!${indexedUser.userId}>. Reason: ${reason}.`,
        };
    }
}
