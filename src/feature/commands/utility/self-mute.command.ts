import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { inlineCode, Message, PartialMessage } from 'discord.js';
import { inject, injectable } from 'inversify';
import { unitOfTime } from 'moment';
import { SelfMutesRepository } from '@src/infrastructure/repositories/self-mutes.repository';
import { TYPES } from '@src/types';
import { MemberService } from '@src/infrastructure/services/member.service';
import { SelfMute } from '@src/feature/commands/utility/models/self-mute.model';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import { Logger } from 'tslog';
import moment = require('moment');
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { TextHelper } from '@src/helpers/text.helper';
import { LoggingService } from '@src/infrastructure/services/logging.service';

@injectable()
export class SelfMuteCommand implements ICommand {
    name: string = 'selfmute';
    description: string = 'Mutes yourself for a set duration.';
    usageHint: string = '<duration><unit(m/d/h/w)>';
    examples: string[] = ['10m', '12h', '1d', '2w'];
    permissionLevel = CommandPermissionLevel.User;
    aliases = ['sm'];

    private selfMutesRepository: SelfMutesRepository;
    private scheduleService: ScheduleService;
    @inject(TYPES.LoggingService) private loggingService: LoggingService;
    private prefix: string;
    private logger: Logger<SelfMuteCommand>;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.PREFIX) prefix: string,
        @inject(TYPES.BotLogger) logger: Logger<SelfMuteCommand>,
        @inject(TYPES.SelfMutesRepository) selfMutesRepository: SelfMutesRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ScheduleService) scheduleService: ScheduleService,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.loggingService = loggingService;
        this.prefix = prefix;
        this.logger = logger;
        this.scheduleService = scheduleService;
        this.memberService = memberService;
        this.selfMutesRepository = selfMutesRepository;
    }

    async run(message: Message | PartialMessage, args: string[]): Promise<CommandResult> {
        const amount = args[0].match(/[1-9][0-9]{0,2}/)?.pop();
        const unit = args[0].match(/([smhdw])/)?.pop();
        if (!amount || !unit) {
            throw Error(`Unable to parse duration '${args[0]}'`);
        }
        this.logger.info(`Creating new selfmute for user ${TextHelper.userLog(message.author!)}...`);
        const now = moment.utc();
        const endDateUtc = now.add(amount, unit as unitOfTime.DurationConstructor);
        const member = await this.memberService.getGuildMemberFromUserId(message.author!.id);
        if (!member) throw Error(`Cannot find user with user ID ${message.author!.id}. Has the user left the guild?`);
        const roles = await this.memberService.getRolesFromGuildMember(member);

        const selfMute = {
            member: member,
            createdAt: now.toDate(),
            endsAt: endDateUtc.toDate(),
            roles: roles,
        };

        await this.selfMutesRepository.createSelfMute(member.user, selfMute.createdAt, selfMute.endsAt, roles);

        try {
            await this.memberService.muteGuildMember(member);
        } catch (e) {
            return {
                isSuccessful: false,
                reason: (e as Error).message,
                replyToUser: `I cannot mute you because you have more privileges than I do or because my role is lower than the muted role!`,
            };
        }

        this.scheduleService.scheduleJob(
            `SELFMUTE_${member.id}`,
            selfMute.endsAt,
            async () => await this.unmuteMember(selfMute)
        );

        await message.author?.send(
            `🔇 You've requested a self mute. It will automatically expire at <t:${endDateUtc.unix()}:f> (<t:${endDateUtc.unix()}:R>). You can prematurely end it by sending me ${inlineCode(this.prefix + 'unmute')} here.`
        );

        await this.loggingService.logSelfmute(selfMute, amount + unit);

        return {
            isSuccessful: true,
        };
    }

    async validateArgs(args: string[]): Promise<void> {
        if (args.length == 0) {
            throw Error('You have to give me a duration you want to be muted for!');
        }
        if (args.length > 1) {
            throw Error('You have to give me only one duration.');
        }
        const match = args[0].match(/[1-9][0-9]{0,2}([mhdw])/);
        if (match == null) {
            throw Error('Please give me a valid duration (m, h, d, w)!');
        }
    }

    async unmuteMember(selfMute: SelfMute) {
        this.logger.debug(
            `Selfmute duration expired. Trying to unmute user ${selfMute.member.user.username} (ID: ${selfMute.member.user.id}). Roles to restore: ${selfMute.roles.map((r) => r.name)}`
        );
        try {
            await this.memberService.unmuteGuildMember(selfMute.member, selfMute.roles);
            await this.selfMutesRepository.deleteSelfMute(selfMute);
        } catch (e) {
            this.logger.error(
                `Cannot unmute user ${selfMute.member.user.username} (ID: ${selfMute.member.user.id}).`,
                e
            );
            return;
        }
        const isPremature = selfMute.endsAt > moment().utc().toDate();

        await this.loggingService.logSelfmute(selfMute);

        if (!isPremature) {
            await selfMute.member.send(`🔊 Your selfmute has expired and I've unmuted you. Welcome back!`);
        }

        this.logger.info(
            `Selfmute for user ${selfMute.member.user.username} (ID: ${selfMute.member.user.id}) has expired and user was unmuted.`
        );
    }

    public async restoreSelfMutes(): Promise<number> {
        const savedSelfMutes = await this.selfMutesRepository.getAllSelfMutes();
        let restored = 0;
        for (const sm of savedSelfMutes) {
            if (sm.endsAt <= moment.utc().toDate()) {
                this.logger.warn(
                    `Selfmute for user ${TextHelper.userLog(sm.member.user)} expired at ${sm.endsAt}. Trying to unmute.`
                );
                try {
                    await this.unmuteMember(sm);
                } catch (e) {
                    this.logger.error(`Unable to unmute orphaned selfmute`, e);
                }
                await this.selfMutesRepository.deleteSelfMute(sm);
            } else {
                this.scheduleService.scheduleJob(
                    `SELFMUTE_${sm.member.id}`,
                    sm.endsAt,
                    async () => await this.unmuteMember(sm)
                );
                restored++;
            }
        }
        return restored;
    }
}
