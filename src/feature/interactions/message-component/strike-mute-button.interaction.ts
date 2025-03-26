import { Environment } from '@models/environment';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { StrikeHelper } from '@src/helpers/strike.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ModerationService } from '@src/infrastructure/services/moderation.service';
import { TYPES } from '@src/types';
import { ButtonInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { Logger } from 'tslog';

@injectable()
export class StrikeMuteButtonInteraction implements IMessageComponentInteraction {
    customIds = ['defer-strike-mute-'];
    private logger: Logger<StrikeMuteButtonInteraction>;
    private loggingService: LoggingService;
    private moderationService: ModerationService;
    private env: Environment;
    private memberService: MemberService;
    private usersRepository: UsersRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StrikeMuteButtonInteraction>,
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
        const values = interaction.customId[0].split('_');
        const commandMessageId = values[3];
        const muteDurationInHours = values[4];
        this.logger.debug(
            `Interaction ID ${interaction.customId} is a strike appeal from user ${interaction.user} and message ID ${commandMessageId} for ${muteDurationInHours} hours.`
        );

        const commandMessage = await interaction.channel!.messages.fetch(commandMessageId);
        if (!commandMessage) {
            this.logger.warn(`Command message ID ${commandMessageId} not found.`);
            await interaction.reply({ content: 'Command message not found.', ephemeral: true });
            return;
        }
        const messageContentArgs = commandMessage.content.split(' ');
        const userId = TextHelper.getDiscordUserId(messageContentArgs[1]);
        if (!userId) {
            this.logger.warn(`User ID not found in command message ${commandMessageId}.`);
            await interaction.reply({ content: 'User ID not found in command message.', ephemeral: true });
            return;
        }
        const reason = messageContentArgs.slice(2).join(' ');
        const subject = await this.memberService.getGuildMemberFromUserId(userId);
        if (!subject) {
            this.logger.warn(`User ID ${userId} not found.`);
            await interaction.reply({ content: `User with ID ${userId} not found.`, ephemeral: true });
            return;
        }

        const allStrikes = await this.usersRepository.getAllStrikesOfUser(userId);
        const activeStrikes = StrikeHelper.getActiveStrikes(allStrikes);

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
        const wasInformed = await this.moderationService.muteGuildMember(
            subject,
            interaction.user,
            endDate,
            {
                content: strikeMessage,
            },
            undefined,
            false
        );

        await this.usersRepository.addStrikeToUser(
            subject!.user,
            interaction.user,
            reason,
            this.env.MODERATION.STRIKE_EXPIRATION_IN_MONTHS
        );

        await this.loggingService.logStrike(
            subject.user,
            interaction.user,
            reason,
            activeStrikes.length + 1,
            allStrikes.length + 1,
            `Mute (${muteDurationInHours}h)`
        );

        await interaction.update({
            content:
                `🗯️ I've successfully issued a strike to ${subject} with a mute (${muteDurationInHours}h).` +
                `${!wasInformed ? ' :warning: *Could not send strike message to user. Do they have their DMs turned off?*' : ''}\n` +
                `-# ${TextHelper.strikeCounter(activeStrikes.length + 1, allStrikes.length + 1)}`,
            components: [],
            embeds: [],
        });
        this.logger.info(`Stike (mute) for ${TextHelper.userLog(subject.user)} has been processed.`);
    }
}
