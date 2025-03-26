import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { ComponentHelper } from '@src/helpers/component.helper';
import { StrikeHelper } from '@src/helpers/strike.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ModerationService } from '@src/infrastructure/services/moderation.service';
import { TYPES } from '@src/types';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
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
        this.env.MODERATION.STRIKE_MUTE_DURATIONS.forEach((muteDurations, index) => {
            this.description += ` - ${index + 1} strike${index + 1 > 1 ? 's' : ''}: Mute (${muteDurations.join('h, ')}h)\n`;
        });
        this.description += ` - ${this.env.MODERATION.STRIKE_MUTE_DURATIONS.size + 1} strike: Ban\n`;
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
            `User ${TextHelper.userLog(member.user)} has ${activeStrikes.length} non-expired strikes. Showing information...`
        );

        const muteDurations =
            activeStrikes.length <= this.env.MODERATION.STRIKE_MUTE_DURATIONS.size
                ? this.env.MODERATION.STRIKE_MUTE_DURATIONS.get(activeStrikes.length)
                : null;

        if (!muteDurations) {
            this.logger.info(
                `User ${TextHelper.userLog(member.user)} has ${activeStrikes.length} strikes, which is more than the maximum allowed (${this.env.MODERATION.STRIKE_MUTE_DURATIONS.size}). Showing ban dialogue...`
            );
            await message.reply({
                content:
                    `User ${member} has ${activeStrikes.length} strikes, which is more than the maximum allowed (${this.env.MODERATION.STRIKE_MUTE_DURATIONS.size}). Proceed with ban?\n` +
                    `-# ${TextHelper.strikeCounter(activeStrikes.length + 1, allStrikes.length + 1)}`,
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents([
                        ComponentHelper.strikeBanButton(message.id, true),
                        ComponentHelper.strikeBanButton(message.id, false),
                        ComponentHelper.cancelButton('defer-cancel', ButtonStyle.Secondary),
                    ]),
                ],
            });
            return {};
        }
        this.logger.info(
            `User ${TextHelper.userLog(member.user)} has ${activeStrikes.length} strikes, handing out a mute...`
        );

        await message.reply({
            content:
                `User ${member} has ${activeStrikes.length} out of ${this.env.MODERATION.STRIKE_MUTE_DURATIONS.size} strikes. Proceed with mute?\n` +
                `-# ${TextHelper.strikeCounter(activeStrikes.length + 1, allStrikes.length + 1)}`,
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    muteDurations!
                        .map((muteDuration) => ComponentHelper.strikeMuteButton(message.id, muteDuration))
                        .concat([ComponentHelper.cancelButton('defer-cancel', ButtonStyle.Secondary)])
                ),
            ],
        });

        return {};
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
