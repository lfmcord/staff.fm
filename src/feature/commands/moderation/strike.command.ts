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
import {
    ActionRowBuilder, bold,
    ButtonBuilder, ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction, GuildMember, inlineCode, Message, PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { Error } from 'mongoose';
import * as moment from 'moment';

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
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption((option) =>
            option.setName('user').setDescription('The discord user to strike').setRequired(true)
        )
        .addStringOption((option) =>
            option.setName('reason').setDescription('The reason for the strike').setRequired(true)
        )
        .addBooleanOption((option) =>
            option.setName('nomute').setDescription('Does not hand out a mute with the strike')
        );

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
        for (let i = 0; i < this.env.MODERATION.STRIKE_MUTE_DURATIONS.length -1; i++) {
            this.description += ` - ${i + 1} strike${i + 1 > 1 ? 's' : ''}: Mute (${this.env.MODERATION.STRIKE_MUTE_DURATIONS[i]}h)\n`;
        }
        this.description += ` - ${this.env.MODERATION.STRIKE_MUTE_DURATIONS.length + 1} strike: Ban\n`;
        this.description += `\nStrikes expire after ${env.MODERATION.STRIKE_EXPIRATION_IN_MONTHS} months.`;
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        if(!interaction.deferred) await interaction.deferReply()
        const userId = interaction.options.getUser('user')!.id;
        const subject = await this.memberService.getGuildMemberFromUserId(userId);
        if (!subject) {
            return {
                isSuccessful: false,
                replyToUser: { content: `I cannot strike this user because they are not in the server.` },
            };
        }

        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (!indexedUser) {
            this.logger.info(`User ${TextHelper.userLog(subject.user)} is not indexed. Indexing...`);
            await this.usersRepository.addUserWithoutVerification(userId);
        }

        const allStrikes = indexedUser?.strikes ?? [];
        const activeStrikes = StrikeHelper.getActiveStrikes(allStrikes);
        this.logger.info(
            `User ${TextHelper.userLog(subject.user)} has ${activeStrikes.length} non-expired strikes.`
        );

        const reason = interaction.options.getString('reason')!;

        let wasInformed, reply, logReason;
        try {
            if (interaction.options.getBoolean('nomute')) {
                if (activeStrikes.length >= this.env.MODERATION.STRIKE_MUTE_DURATIONS.length) {
                    return {
                        isSuccessful: false,
                        replyToUser: {
                            content: `User ${subject} has ${activeStrikes.length} strikes, which is the maximum (${this.env.MODERATION.STRIKE_MUTE_DURATIONS.length}). You cannot issue a strike without a mute.`,
                        }

                    };
                }

                let strikeMessage: string =
                    `🗯️ **You've received a strike in the Last.fm Discord**. ` +
                    `You now have ${activeStrikes.length + 1} out of ${this.env.MODERATION.STRIKE_MUTE_DURATIONS.length + 1} strikes.`;
                if (activeStrikes.length + 1 === this.env.MODERATION.STRIKE_MUTE_DURATIONS.length)
                    strikeMessage += ` Another strike will lead to a ban.`;
                strikeMessage += `\n**Reason:** ${reason}`;
                strikeMessage +=
                    `\n-# This strike will expire automatically <t:${moment().add(this.env.MODERATION.STRIKE_EXPIRATION_IN_MONTHS, 'months').unix()}:R>. ` +
                    `Contact staff if you believe this strike was unjustified or would otherwise like to discuss it.`;
                try {
                    wasInformed = await subject.send({ content: strikeMessage });
                } catch (e) {
                    this.logger.warn(`Failed to send strike DM to user ${TextHelper.userLog(subject.user)}.`, e);
                }
                reply = `🗯️ I've successfully issued a strike to ${subject} without a mute.`;
                logReason = `no action`;
            } else if (activeStrikes.length < this.env.MODERATION.STRIKE_MUTE_DURATIONS.length) {
                const muteDurationInHours = this.env.MODERATION.STRIKE_MUTE_DURATIONS[activeStrikes.length];
                const endDate = moment().add(muteDurationInHours, 'hours').toDate();
                let strikeMessage: string =
                    `🗯️ **You've received a strike in the Last.fm Discord** and are muted until <t:${moment(endDate).unix()}:F>. ` +
                    `You now have ${activeStrikes.length + 1} out of ${this.env.MODERATION.STRIKE_MUTE_DURATIONS.length + 1} strikes.`;
                if (activeStrikes.length + 1 === this.env.MODERATION.STRIKE_MUTE_DURATIONS.length)
                    strikeMessage += ` Another strike will lead to a ban.`;
                strikeMessage += `\n**Reason:** ${reason}`;
                strikeMessage +=
                    `\n-# This strike will expire automatically <t:${moment().add(this.env.MODERATION.STRIKE_EXPIRATION_IN_MONTHS, 'months').unix()}:R>. ` +
                    `Contact staff if you believe this strike was unjustified or would otherwise like to discuss it.`;
                wasInformed = await this.moderationService.muteGuildMember(
                    subject,
                    interaction.user,
                    endDate,
                    {
                        content: strikeMessage,
                    },
                    undefined,
                    false
                );
                reply = `🗯️ I've successfully issued a strike to ${subject} with a mute (${muteDurationInHours}h).`;
                logReason = `a mute (${muteDurationInHours}h)`;
            } else {
                wasInformed = await this.moderationService.banGuildMember(
                    subject,
                    interaction.user,
                    {
                        content: `🔨 You've reached the maximum allowed number of strikes (${this.env.MODERATION.STRIKE_MUTE_DURATIONS.length + 1}) in the Last.fm Discord and have been banned.\n**Reason:** ${reason}\n`,
                    },
                    reason,
                    false
                );
                reply = `I've successfully 🔨 ${bold('banned')} ${inlineCode(subject.user.username)} for accumulating too many strikes.\n`;
                logReason = `a ban`;
            }
        } catch (e) {
                this.logger.error(`Failed to strike user ${TextHelper.userLog(subject.user)}.`, e);
                return {
                    isSuccessful: false,
                    reason: `Failed to strike user: ${e}.`,
                    replyToUser : { content: `Failed to strike user ${TextHelper.userDisplay(subject.user)}.` }
                };
            }

        const logMessage = await this.loggingService.logStrike(
            subject.user,
            interaction.user,
            reason,
            activeStrikes.length + 1,
            allStrikes.length + 1,
            logReason ?? 'uknown'
        );

        const now = moment();
        await this.usersRepository.addStrikeToUser(
            subject!.user,
            interaction.user,
            reason,
            now.toDate(),
            now.add(this.env.MODERATION.STRIKE_EXPIRATION_IN_MONTHS, 'months').toDate(),
            logMessage ? TextHelper.getDiscordMessageLink(logMessage) : undefined
        );

        this.logger.info(`${logReason} for ${TextHelper.userLog(subject.user)} has been processed.`);

        return {
            isSuccessful: true,
            replyToUser: {  content:
                    reply +
                    `${!wasInformed ? `\n:warning: *Could not send strike message to user. Do they have their DMs turned off?*` : ''}` +
                    `${!logMessage ? '\n:warning: *Could not log the strike. It will not be searchable in the log channel.*' : ''}` +
                    `\n-# ${TextHelper.strikeCounter(activeStrikes.length + 1, allStrikes.length + 1)}`,
                components: [],
                embeds: [],
            },
        }
    }

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        const reasonLength = interaction.options.getString('reason')!.length;
        if (reasonLength > 1500) {
            throw new ValidationError(
                `Reason too long.`,
                `The reason for the strike must be less than 2000 characters (currently: ${reasonLength}).`
            );
        }
        return Promise.resolve();
    }
}
