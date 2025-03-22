import { Environment } from '@models/environment';
import { TextHelper } from '@src/helpers/text.helper';
import { MutesRepository } from '@src/infrastructure/repositories/mutes.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import { TYPES } from '@src/types';
import { Client, GuildMember, MessageCreateOptions, Role } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class ModerationService {
    private client: Client;
    private scheduleService: ScheduleService;
    private loggingService: LoggingService;
    private mutesRepository: MutesRepository;
    private memberService: MemberService;
    private logger: Logger<ModerationService>;
    private env: Environment;

    constructor(
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.ScheduleService) scheduleService: ScheduleService,
        @inject(TYPES.InfrastructureLogger) logger: Logger<ModerationService>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.MutesRepository) mutesRepository: MutesRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.loggingService = loggingService;
        this.mutesRepository = mutesRepository;
        this.memberService = memberService;
        this.logger = logger;
        this.env = env;
        this.scheduleService = scheduleService;
        this.client = client;
    }

    async muteGuildMember(
        subject: GuildMember,
        actor: GuildMember,
        endDate: Date,
        muteMessage?: MessageCreateOptions,
        unmuteMessage?: MessageCreateOptions,
        shouldLog = true
    ): Promise<void> {
        this.logger.info(
            `Trying to mute user ${TextHelper.userLog(subject.user)} (by ${TextHelper.userLog(actor.user)}) until ${endDate.toISOString()}...`
        );
        const isSelfmute = actor.id === subject.id;
        const highestUserRole = await this.memberService.getHighestRoleFromGuildMember(subject);
        const botMember = await this.memberService.getGuildMemberFromUserId(this.client.user!.id);
        const highestBotRole = await this.memberService.getHighestRoleFromGuildMember(botMember!);
        const muteRoleId = isSelfmute ? this.env.ROLES.SELFMUTED_ROLE_ID : this.env.ROLES.MUTED_ROLE_ID;
        const mutedRole = await (await this.client.guilds.fetch(this.env.CORE.GUILD_ID)).roles.fetch(muteRoleId);
        if (highestUserRole.comparePositionTo(highestBotRole) > 0) {
            throw Error(`Cannot mute a member with a role higher than the bot role.`);
        }
        if (!mutedRole) {
            throw Error(`Cannot find muted role with role ID ${muteRoleId}`);
        }
        if (mutedRole!.comparePositionTo(highestBotRole) > 0) {
            throw Error(`Cannot assign the muted role because it is higher than the bot role.`);
        }

        const roles = await this.memberService.getRolesFromGuildMember(subject);
        roles.forEach((r) => r.comparePositionTo(botMember!.roles.highest));
        await subject.roles.add(mutedRole);
        await subject.roles.remove(roles);

        this.logger.debug(`Removed ${roles.length} roles from user ${TextHelper.userLog(subject.user)}.`);

        this.scheduleService.scheduleJob(`UNMUTE_${subject.id}`, endDate, async () => {
            await this.unmuteGuildMember(subject, roles, actor, unmuteMessage, `Mute duration expired.`);
        });

        await this.mutesRepository.createMute(subject.user, actor.user, endDate, roles);
        this.logger.info(`Muted user ${TextHelper.userLog(subject.user)} until ${endDate.toISOString()}.`);

        if (shouldLog) await this.loggingService.logMute(actor.user, subject.user, endDate, muteMessage?.content);

        if (muteMessage) {
            try {
                this.logger.debug(`Sending mute message to user ${TextHelper.userLog(subject.user)}.`);
                await subject.send(muteMessage);
            } catch (e) {
                this.logger.warn(`Could not send mute message to user.`, e);
            }
        }
    }

    async unmuteGuildMember(
        subject: GuildMember,
        rolesToRestore: Role[],
        actor?: GuildMember,
        unmuteMessage?: MessageCreateOptions,
        reason?: string,
        shouldLog = true
    ) {
        this.logger.info(
            `Unmuting user ${TextHelper.userLog(subject.user)} (by ${actor ? TextHelper.userLog(actor.user) : 'unknown'})...`
        );
        const isSelfmute = actor?.id === subject.id;
        const mutedRole = isSelfmute ? this.env.ROLES.SELFMUTED_ROLE_ID : this.env.ROLES.MUTED_ROLE_ID;
        await subject.roles.remove(mutedRole);
        rolesToRestore.forEach((r) => (r.name !== '@everyone' ? subject.roles.add(r) : ''));

        const jobName = `UNMUTE_${subject.id}`;
        if (this.scheduleService.jobExists(jobName)) {
            this.scheduleService.cancelJob(jobName);
        }

        await this.mutesRepository.deleteMuteByUserId(subject.user.id);
        this.logger.info(
            `Unmuted user ${TextHelper.userLog(subject.user)} (by ${actor ? TextHelper.userLog(actor.user) : 'unknown'}).`
        );

        if (shouldLog) await this.loggingService.logUnmute(subject.user, actor?.user, reason);

        if (unmuteMessage) {
            try {
                this.logger.debug(`Sending unmute message to user ${TextHelper.userLog(subject.user)}.`);
                await subject.send(unmuteMessage);
            } catch (e) {
                this.logger.warn(`Could not send unmute message to user.`, e);
            }
        }
    }
}
