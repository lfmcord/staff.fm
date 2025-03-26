import { Environment } from '@models/environment';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { StrikeHelper } from '@src/helpers/strike.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ModerationService } from '@src/infrastructure/services/moderation.service';
import { TYPES } from '@src/types';
import { ButtonInteraction, inlineCode } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class StrikeBanButtonInteraction implements IMessageComponentInteraction {
    customIds = ['defer-strike-ban-'];
    private logger: Logger<StrikeBanButtonInteraction>;
    private loggingService: LoggingService;
    private moderationService: ModerationService;
    private env: Environment;
    private memberService: MemberService;
    private usersRepository: UsersRepository;

    // TODO: interactions arent triggering
    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StrikeBanButtonInteraction>,
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
        const isAppealable = values[4] === 'true';
        this.logger.debug(
            `Interaction ID ${interaction.customId} is a strike ban from user ${interaction.user} and message ID ${commandMessageId}.`
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

        let wasInformed;
        try {
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
        } catch (e) {
            this.logger.error(`Failed to ban user ${TextHelper.userLog(subject.user)}.`, e);
            await interaction.reply({ content: `Failed to ban user ${subject}.`, ephemeral: true });
            return;
        }

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
            `Ban${!isAppealable ? ' (permanent)' : ''}`
        );

        await interaction.update({
            content:
                `I've successfully banned ${inlineCode(subject.user.username)} for accumulating too many strikes.\n` +
                `${!wasInformed ? ' :warning: *Could not send strike message to user. Do they have their DMs turned off?*' : ''}\n` +
                `-# ${TextHelper.strikeCounter(activeStrikes.length + 1, allStrikes.length + 1)}`,
            components: [],
            embeds: [],
        });
        this.logger.info(`Stike (ban) for ${TextHelper.userLog(subject.user)} has been processed.`);
    }
}
