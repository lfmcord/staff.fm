import { Environment } from '@models/environment';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { StrikeHelper } from '@src/helpers/strike.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ModerationService } from '@src/infrastructure/services/moderation.service';
import { TYPES } from '@src/types';
import { bold, ButtonInteraction, GuildMember, inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment/moment';
import { Error } from 'mongoose';
import { Logger } from 'tslog';

@injectable()
export class StrikeButtonInteraction implements IMessageComponentInteraction {
    customIds = ['defer-strike-ban-', 'defer-strike-mute-'];
    private logger: Logger<StrikeButtonInteraction>;
    private loggingService: LoggingService;
    private moderationService: ModerationService;
    private env: Environment;
    private memberService: MemberService;
    private usersRepository: UsersRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StrikeButtonInteraction>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.ModerationService) moderationService: ModerationService,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.loggingService = loggingService;
        this.moderationService = moderationService;
        this.env = env;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.logger = logger;
    }

    async manage(interaction: ButtonInteraction) {
        if (!interaction.channel) {
            this.logger.warn(`Interaction ID ${interaction.customId} is missing a channel.`);
            await interaction.reply({ content: 'This interaction is missing a channel.', ephemeral: true });
            return;
        }
        const values = interaction.customId.split('-');
        const action = values[2];
        this.logger.debug(
            `Interaction ID ${interaction.customId} is a strike ${action} from user ${interaction.user}.`
        );

        let reason, subject;
        try {
            const commandMessage = await this.getCommandMessage(values[3], interaction);
            reason = this.getReason(commandMessage);
            subject = await this.getSubject(commandMessage);
        } catch (e) {
            await interaction.reply({ content: (e as Error).message + 'I did not issue a strike.', ephemeral: true });
            return;
        }

        const allStrikes = await this.usersRepository.getAllStrikesOfUser(subject.id);
        const activeStrikes = StrikeHelper.getActiveStrikes(allStrikes);

        let wasInformed, reply, logReason;
        try {
            if (action === 'mute') {
                const muteDurationInHours = values[4];
                const endDate = moment().add(muteDurationInHours, 'hours').toDate();
                let strikeMessage: string =
                    `🗯️ **You've received a strike in the Last.fm Discord** and are muted until <t:${moment(endDate).unix()}:F>. ` +
                    `You now have ${activeStrikes.length + 1} out of ${this.env.MODERATION.STRIKE_MUTE_DURATIONS.size} strikes.`;
                if (activeStrikes.length + 1 === this.env.MODERATION.STRIKE_MUTE_DURATIONS.size)
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
                logReason = `Mute (${muteDurationInHours}h)`;
            } else if (action === 'ban') {
                const isAppealable = values[4] === 'true';
                wasInformed = await this.moderationService.banGuildMember(
                    subject,
                    interaction.user,
                    isAppealable,
                    {
                        content: `🔨 You've exceeded the maximum allowed number of strikes (${this.env.MODERATION.STRIKE_MUTE_DURATIONS.size}) in the Last.fm Discord and have been banned.\n**Reason:** ${reason}\n`,
                    },
                    reason,
                    false
                );
                reply = `I've successfully 🔨 ${bold('banned')} ${inlineCode(subject.user.username)} for accumulating too many strikes.\n`;
                logReason = `Ban${!isAppealable ? ' (permanent)' : ''}`;
            }
        } catch (e) {
            this.logger.error(`Failed to ${action} user ${TextHelper.userLog(subject.user)}.`, e);
            await interaction.reply({ content: `Failed to ${action} user ${subject}.`, ephemeral: true });
            return;
        }

        const logMessage = await this.loggingService.logStrike(
            subject.user,
            interaction.user,
            reason,
            activeStrikes.length + 1,
            allStrikes.length + 1,
            logReason ?? 'uknown'
        );

        await this.usersRepository.addStrikeToUser(
            subject!.user,
            interaction.user,
            reason,
            this.env.MODERATION.STRIKE_EXPIRATION_IN_MONTHS,
            logMessage ? TextHelper.getDiscordMessageLink(logMessage) : undefined
        );

        await interaction.update({
            content:
                reply +
                `${!wasInformed ? `:warning: *Could not send ${action} message to user. Do they have their DMs turned off?*` : ''}` +
                `${!logMessage ? '\n:warning: *Could not log the strike. It will not be searchable in the log channel.*' : ''}` +
                `\n-# ${TextHelper.strikeCounter(activeStrikes.length + 1, allStrikes.length + 1)}`,
            components: [],
            embeds: [],
        });
        this.logger.info(`${logReason} for ${TextHelper.userLog(subject.user)} has been processed.`);
    }

    private async getCommandMessage(commandMessageId: string, interaction: ButtonInteraction): Promise<Message> {
        const commandMessage = await interaction.channel!.messages.fetch(commandMessageId);
        this.logger.debug(commandMessage.content);
        this.logger.debug(commandMessageId);
        if (!commandMessage) {
            this.logger.warn(`Command message ID ${commandMessageId} not found.`);
            throw new Error('Command message not found.');
        }
        return commandMessage;
    }

    private getReason(message: Message): string {
        const messageContentArgs = message.content.split(' ');
        return messageContentArgs.slice(2).join(' ');
    }

    private async getSubject(message: Message): Promise<GuildMember> {
        const messageContentArgs = message.content.split(' ');
        const userId = TextHelper.getDiscordUserId(messageContentArgs[1]);
        if (!userId) {
            this.logger.warn(`User ID not found in command message ${message.id}.`);
            throw new Error('User ID not found in command message.');
        }
        const subject = await this.memberService.getGuildMemberFromUserId(userId);
        if (!subject) {
            this.logger.warn(`User with ID ${userId} not found.`);
            throw new Error(`User with ID ${userId} not found.`);
        }
        return subject;
    }
}
