import { Environment } from '@models/environment';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { StrikeHelper } from '@src/helpers/strike.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { MutesRepository } from '@src/infrastructure/repositories/mutes.repository';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ModerationService } from '@src/infrastructure/services/moderation.service';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import { TYPES } from '@src/types';
import { StringSelectMenuInteraction, User } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { Logger } from 'tslog';

@injectable()
export class StrikeAppealInteraction implements IMessageComponentInteraction {
    customIds = ['defer-strike-appeal'];
    private logger: Logger<StrikeAppealInteraction>;
    private scheduleService: ScheduleService;
    private loggingService: LoggingService;
    private moderationService: ModerationService;
    private mutesRepository: MutesRepository;
    private env: Environment;
    private memberService: MemberService;
    private usersRepository: UsersRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StrikeAppealInteraction>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.ScheduleService) scheduleService: ScheduleService,
        @inject(TYPES.MutesRepository) mutesRepository: MutesRepository,
        @inject(TYPES.ModerationService) moderationService: ModerationService,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.loggingService = loggingService;
        this.moderationService = moderationService;
        this.mutesRepository = mutesRepository;
        this.scheduleService = scheduleService;
        this.env = env;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.logger = logger;
    }

    async manage(interaction: StringSelectMenuInteraction) {
        const values = interaction.values[0].split('_');
        const userId = values[0];
        const strikeId = values[1];
        this.logger.debug(
            `Interaction ID ${interaction.customId} is a strike appeal from user ${userId} for strike ID ${strikeId}.`
        );
        const member = await this.memberService.getGuildMemberFromUserId(userId);
        const user = await this.memberService.fetchUser(userId);

        if (!user) {
            this.logger.warn(`User ID ${userId} not found.`);
            await interaction.update({ content: 'User not found.', components: [], embeds: [] });
            return;
        }

        const appealedStrike = await this.usersRepository.appealStrike(userId, strikeId);
        if (!appealedStrike) {
            this.logger.warn(`Failed to remove strike ID ${strikeId} from user ID ${TextHelper.userLog(user)}.`);
            await interaction.update({ content: 'Failed to set strike to appealed.', components: [], embeds: [] });
            return;
        }

        const allStrikes = await this.usersRepository.getAllStrikesOfUser(userId);
        const activeStrikes = StrikeHelper.getActiveStrikes(allStrikes);
        this.logger.debug(`User with user ID ${userId} has ${activeStrikes.length} active strikes.`);

        const activeMute = await this.mutesRepository.getMuteByUserId(userId);
        if (member) {
            if (activeMute && activeMute.actorId != activeMute.subjectId) {
                this.logger.info(`User ${TextHelper.userLog(member.user)} has an active mute, unmuting...`);
                const roles = activeMute.roleIds.map((roleId) => member.guild.roles.cache.get(roleId)!);
                await this.moderationService.unmuteGuildMember(
                    member,
                    roles,
                    interaction.member!.user as User,
                    undefined,
                    'Strike appealed.'
                );
            }
            this.logger.debug(`Sending appeal message to user ${TextHelper.userLog(member.user)}...`);
            try {
                await member.send(
                    `🗯️:x: **Your strike from <t:${moment(appealedStrike.createdAt).unix()}:d> has been voided.**\n` +
                        `You are now at ${activeStrikes.length} out of ${this.env.MODERATION.STRIKE_MUTE_DURATIONS_IN_HOURS.length} allowed strikes.`
                );
            } catch (e) {
                this.logger.warn(`Failed to send DM to user ID ${userId}.`, e);
            }
        }

        await this.loggingService.logStrikeAppeal(
            user,
            interaction.member!.user as User,
            interaction.message.content.match(/"(.*)"\?/)?.[1] ?? 'No reason provided.',
            activeStrikes.length,
            allStrikes.length
        );

        await interaction.update({
            content:
                `Strike from <t:${moment(appealedStrike.createdAt).unix()}:d> for user <@${userId}> has been set to appealed and will no longer be counted towards active strikes.` +
                `\n-# ${TextHelper.strikeCounter(activeStrikes.length, allStrikes.length)}`,
            components: [],
            embeds: [],
        });
        this.logger.info(`Appeal for ${TextHelper.userLog(user)} has been processed.`);
    }
}
