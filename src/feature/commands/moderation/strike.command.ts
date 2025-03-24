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
import { ModerationService } from '@src/infrastructure/services/moderation.service';
import { TYPES } from '@src/types';
import { Message, inlineCode } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { Logger } from 'tslog';

@injectable()
export class StrikeCommand implements ICommand {
    name: string = 'strike';
    description: string = 'Gives someone a strike and the applicable strike punishment.';
    usageHint: string = '<user id/mention> <reason>';
    examples: string[] = ['356178941913858049 big dummy'];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;

    private loggingService: LoggingService;
    private usersRepository: UsersRepository;
    private logger: Logger<StrikeCommand>;
    private moderationService: ModerationService;
    private env: Environment;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.BotLogger) logger: Logger<StrikeCommand>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.ModerationService) moderationService: ModerationService
    ) {
        this.moderationService = moderationService;
        this.env = env;
        this.memberService = memberService;
        this.loggingService = loggingService;
        this.usersRepository = usersRepository;
        this.logger = logger;

        this.description += `Strike punishments:\n`;
        this.env.MODERATION.STRIKE_MUTE_DURATIONS_IN_HOURS.forEach((muteDuration, index) => {
            this.description += ` - ${index + 1} strike${index + 1 > 1 ? 's' : ''}: Mute (${muteDuration}h)\n`;
        });
        this.description += ` - ${this.env.MODERATION.STRIKE_MUTE_DURATIONS_IN_HOURS.length + 1} strike: Ban\n`;
        this.description += `\nStrikes expire after ${env.MODERATION.STRIKE_EXPIRATION_IN_MONTHS} months.`;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0])!;
        const member = await this.memberService.getGuildMemberFromUserId(userId);
        if (!member) {
            return {
                isSuccessful: false,
                replyToUser: `I cannot strike this user because they are not in the server.`,
            };
        }

        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (!indexedUser) {
            this.logger.info(`User ${TextHelper.userLog(member.user)} is not indexed. Indexing...`);
            await this.usersRepository.addUserWithoutVerification(userId);
        }
        const allStrikes = indexedUser?.strikes ?? [];
        const activeStrikes = StrikeHelper.getActiveStrikes(allStrikes);
        this.logger.info(
            `User ${TextHelper.userLog(member.user)} has ${activeStrikes.length} non-expired strikes. Striking...`
        );

        const muteDuration =
            activeStrikes.length <= this.env.MODERATION.STRIKE_MUTE_DURATIONS_IN_HOURS.length
                ? this.env.MODERATION.STRIKE_MUTE_DURATIONS_IN_HOURS[activeStrikes.length]
                : null;
        const reason = args.slice(1).join(' ');

        const strikeId = await this.usersRepository.addStrikeToUser(
            member.user,
            message.author,
            reason,
            this.env.MODERATION.STRIKE_EXPIRATION_IN_MONTHS
        );

        let actionTaken = 'unknown';
        let reply: string;
        let wasInformed: boolean;
        if (!muteDuration) {
            this.logger.info(
                `User ${TextHelper.userLog(member.user)} has ${activeStrikes.length} strikes, which is more than the maximum allowed (${this.env.MODERATION.STRIKE_MUTE_DURATIONS_IN_HOURS.length}). Banning...`
            );
            try {
                wasInformed = await this.moderationService.banGuildMember(
                    member,
                    message.author,
                    true,
                    {
                        content: `🔨 You've exceeded the maximum allowed number of strikes (${this.env.MODERATION.STRIKE_MUTE_DURATIONS_IN_HOURS.length}) in the Last.fm Discord and have been banned.\n**Reason:** ${reason}\n`,
                    },
                    reason,
                    false
                );
            } catch (e) {
                await this.usersRepository.removeStrikeFromUser(member.user.id, strikeId);
                return {
                    isSuccessful: false,
                    replyToUser: `I was unable to ban ${member} because they have more privileges than I do or because something broke!`,
                };
            }

            reply =
                `I've successfully banned ${inlineCode(member.user.tag)} for accumulating too many strikes.\n` +
                `-# ${TextHelper.strikeCounter(activeStrikes.length + 1, allStrikes.length + 1)}`;
            actionTaken = 'Ban';
        } else {
            this.logger.info(
                `User ${TextHelper.userLog(member.user)} has ${activeStrikes.length} strikes, handing out a mute...`
            );

            const endDate = moment().add(muteDuration, 'hours').toDate();
            let strikeMessage: string =
                `🗯️ **You've received a strike in the Last.fm Discord** and are muted until <t:${moment(endDate).unix()}:F>. ` +
                `You now have ${activeStrikes.length + 1} out of ${this.env.MODERATION.STRIKE_MUTE_DURATIONS_IN_HOURS.length} strikes.`;
            if (activeStrikes.length + 1 === this.env.MODERATION.STRIKE_MUTE_DURATIONS_IN_HOURS.length)
                strikeMessage += ` Another strike will lead to a ban.`;
            strikeMessage += `\n**Reason:** ${reason}`;
            strikeMessage +=
                `\n-# This strike will expire automatically <t:${moment().add(this.env.MODERATION.STRIKE_EXPIRATION_IN_MONTHS, 'months').unix()}:R>. ` +
                `Contact staff if you believe this strike was unjustified or would otherwise like to discuss it.`;
            wasInformed = await this.moderationService.muteGuildMember(
                member,
                message.author,
                endDate,
                {
                    content: strikeMessage,
                },
                undefined,
                false
            );
            actionTaken = `Mute (${muteDuration}h)`;
            reply =
                `🗯️ I've successfully issued a strike to ${member} with a mute (${muteDuration}h).\n` +
                `-# ${TextHelper.strikeCounter(activeStrikes.length + 1, allStrikes.length + 1)}`;
        }

        await this.loggingService.logStrike(
            member.user,
            message.author,
            reason,
            activeStrikes.length + 1,
            allStrikes.length + 1,
            actionTaken
        );

        return {
            isSuccessful: true,
            replyToUser: wasInformed ? reply : (reply += ` I was unable to inform the user of the strike.`),
        };
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(
                `No args provided for strike.`,
                `You must provide a user to strike, together with a reason!`
            );
        }
        if (args.length === 1) {
            throw new ValidationError(`No reason provided for strike.`, `You must provide a reason for the strike!`);
        }
        const reasonLength = args.slice(1).join(' ').length;
        if (reasonLength > 1500) {
            throw new ValidationError(
                `Reason too long.`,
                `The reason for the strike must be less than 2000 characters (currently: ${reasonLength}).`
            );
        }
        return Promise.resolve();
    }
}
