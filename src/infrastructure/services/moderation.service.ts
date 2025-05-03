import { Environment } from '@models/environment';
import { TextHelper } from '@src/helpers/text.helper';
import { MutesRepository } from '@src/infrastructure/repositories/mutes.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import { TYPES } from '@src/types';
import { Client, GuildMember, MessageCreateOptions, Role, User } from 'discord.js';
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
        actor: User,
        endDate: Date,
        muteMessage?: MessageCreateOptions,
        unmuteMessage?: MessageCreateOptions,
        shouldLog = true
    ): Promise<boolean> {
        this.logger.info(
            `Trying to mute user ${TextHelper.userLog(subject.user)} (by ${TextHelper.userLog(actor)}) until ${endDate.toISOString()}...`
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
        await subject.roles.remove(roles);
        await subject.roles.add(mutedRole);

        this.logger.debug(`Removed ${roles.length} roles from user ${TextHelper.userLog(subject.user)}.`);

        this.scheduleService.scheduleJob(`UNMUTE_${subject.id}`, endDate, async () => {
            await this.unmuteGuildMember(subject, roles, this.client.user!, unmuteMessage, `Mute duration expired.`);
        });

        await this.mutesRepository.deleteMuteByUserId(subject.user.id);
        await this.mutesRepository.createMute(subject.user, actor, endDate, roles);
        this.logger.info(`Muted user ${TextHelper.userLog(subject.user)} until ${endDate.toISOString()}.`);

        if (shouldLog) await this.loggingService.logMute(actor, subject.user, endDate, muteMessage?.content);

        if (muteMessage) {
            try {
                this.logger.debug(`Sending mute message to user ${TextHelper.userLog(subject.user)}.`);
                await subject.send(muteMessage);
                this.logger.info(`Sent mute message to user ${TextHelper.userLog(subject.user)}.`);
                return true;
            } catch (e) {
                this.logger.warn(`Could not send mute message to user.`, e);
                return false;
            }
        }
        return false;
    }

    async unmuteGuildMember(
        subject: GuildMember,
        rolesToRestore: Role[],
        actor?: User,
        unmuteMessage?: MessageCreateOptions,
        reason?: string,
        shouldLog = true
    ) {
        this.logger.info(
            `Unmuting user ${TextHelper.userLog(subject.user)} (by ${actor ? TextHelper.userLog(actor) : 'unknown'})...`
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
            `Unmuted user ${TextHelper.userLog(subject.user)} (by ${actor ? TextHelper.userLog(actor) : 'unknown'}).`
        );

        if (shouldLog) await this.loggingService.logUnmute(subject.user, actor, reason);

        if (unmuteMessage) {
            try {
                this.logger.debug(`Sending unmute message to user ${TextHelper.userLog(subject.user)}.`);
                await subject.send(unmuteMessage);
                this.logger.info(`Sent unmute message to user ${TextHelper.userLog(subject.user)}.`);
            } catch (e) {
                this.logger.warn(`Could not send unmute message to user.`, e);
            }
        }
    }

    async banGuildMember(
        subject: GuildMember,
        actor: User,
        isAppealable: boolean,
        banMessage?: MessageCreateOptions,
        reason?: string,
        shouldLog = true
    ): Promise<boolean> {
        let wasInformed = false;
        if (banMessage) {
            if (isAppealable)
                banMessage.content += `\n-# Unless stated otherwise in the reason above, you are able to appeal your ban by joining the ban appeal server at <https://discord.gg/2WwNFyhq5n>`;
            try {
                await subject.send(banMessage);
            } catch (e) {
                this.logger.warn(`Could not send ban message to user ${TextHelper.userLog(subject.user)}.`, e);
            }
            this.logger.info(`Sent ban message to user ${TextHelper.userLog(subject.user)}.`);
            wasInformed = true;
        }

        try {
            await subject.ban({ reason: reason ?? 'No reason provided.' });
        } catch (e) {
            this.logger.warn(`Could not ban user ${TextHelper.userLog(subject.user)}.`, e);
            throw Error(`Could not ban user.`);
        }

        if (shouldLog) await this.loggingService.logBan(actor, subject.user, reason);

        return wasInformed;
    }
}
