import { TextHelper } from '@src/helpers/text.helper';
import { MutesRepository } from '@src/infrastructure/repositories/mutes.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ModerationService } from '@src/infrastructure/services/moderation.service';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import { TYPES } from '@src/types';
import { Role } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { Logger } from 'tslog';

@injectable()
export class MutesTrigger {
    private logger: Logger<MutesTrigger>;
    private memberService: MemberService;
    private mutesRepository: MutesRepository;
    private scheduleService: ScheduleService;
    private moderationService: ModerationService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<MutesTrigger>,
        @inject(TYPES.MutesRepository) mutesRepository: MutesRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ScheduleService) scheduleService: ScheduleService,
        @inject(TYPES.ModerationService) moderationService: ModerationService
    ) {
        this.moderationService = moderationService;
        this.memberService = memberService;
        this.mutesRepository = mutesRepository;
        this.logger = logger;
        this.scheduleService = scheduleService;
    }

    public async restoreMutes(): Promise<number> {
        const savedMutes = await this.mutesRepository.getAllMutes();
        let restored = 0;
        for (const mute of savedMutes) {
            const subject = await this.memberService.getGuildMemberFromUserId(mute.subjectId);
            const actor = await this.memberService.getGuildMemberFromUserId(mute.subjectId);
            if (!subject) {
                this.logger.warn(
                    `Unable to restore mute for user ${mute.subjectId} because user was not found. Deleting mute.`
                );
                await this.mutesRepository.deleteMuteByUserId(mute.subjectId);
                continue;
            }

            const unmuteMessage =
                subject.id == actor?.id
                    ? {
                          content: `🔊 Your selfmute has ended and I've unmuted you. Welcome back!`,
                      }
                    : {
                          content: `🔊 You've been unmuted.`,
                      };
            const roles: Role[] = [];
            for (const roleId of mute.roleIds) {
                const role = subject.guild.roles.cache.get(roleId);
                if (role) {
                    roles.push(role);
                }
            }
            if (mute.endsAt <= moment.utc().toDate()) {
                this.logger.warn(
                    `Mute for user ${TextHelper.userLog(subject.user)} expired at ${mute.endsAt}. Trying to unmute.`
                );
                try {
                    await this.moderationService.unmuteGuildMember(
                        subject,
                        roles,
                        actor?.user ?? undefined,
                        unmuteMessage,
                        `Mute expired while bot was offline.`
                    );
                } catch (e) {
                    this.logger.error(`Unable to unmute orphaned mute`, e);
                }
                await this.mutesRepository.deleteMuteByUserId(subject.id);
            } else {
                this.scheduleService.scheduleJob(
                    `UNMUTE_${mute.subjectId}`,
                    mute.endsAt,
                    async () =>
                        await this.moderationService.unmuteGuildMember(
                            subject,
                            roles,
                            actor?.user ?? undefined,
                            unmuteMessage,
                            `Mute duration expired.`
                        )
                );
                restored++;
            }
        }
        return restored;
    }
}
