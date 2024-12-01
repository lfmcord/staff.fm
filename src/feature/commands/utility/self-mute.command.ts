import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { inlineCode, Message, PartialMessage } from 'discord.js';
import { inject, injectable } from 'inversify';
import { unitOfTime } from 'moment';
import { SelfMutesRepository } from '@src/infrastructure/repositories/self-mutes.repository';
import { TYPES } from '@src/types';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import { Logger } from 'tslog';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { TextHelper } from '@src/helpers/text.helper';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { Environment } from '@models/environment';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import * as moment from 'moment';
import { SelfMute } from '@src/feature/commands/utility/models/self-mute.model';

@injectable()
export class SelfMuteCommand implements ICommand {
    name: string = 'selfmute';
    description: string = 'Mutes yourself for a set duration.';
    usageHint: string = '<duration><unit(m/d/h/w)>';
    examples: string[] = ['10m', '12h', '1d', '2w'];
    permissionLevel = CommandPermissionLevel.User;
    aliases = ['sm'];
    isUsableInDms = true;
    isUsableInServer = true;

    private selfMutesRepository: SelfMutesRepository;
    private scheduleService: ScheduleService;
    private env: Environment;
    private loggingService: LoggingService;
    private logger: Logger<SelfMuteCommand>;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.BotLogger) logger: Logger<SelfMuteCommand>,
        @inject(TYPES.SelfMutesRepository) selfMutesRepository: SelfMutesRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ScheduleService) scheduleService: ScheduleService,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.env = env;
        this.loggingService = loggingService;
        this.logger = logger;
        this.scheduleService = scheduleService;
        this.memberService = memberService;
        this.selfMutesRepository = selfMutesRepository;
    }

    async run(message: Message | PartialMessage, args: string[]): Promise<CommandResult> {
        const amount = args[0].match(/[1-9][0-9]{0,2}/)?.pop();
        const unit = args[0].match(/([mhdw])/)?.pop();
        if (!amount || !unit) {
            throw Error(`Unable to parse duration '${args[0]}'`);
        }
        if (parseInt(amount) < 5 && unit == 'm') {
            throw new ValidationError('Duration too short.', 'Your selfmute has to be at least 5 minutes long.');
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
            await this.memberService.muteGuildMember(
                member,
                `🔇 You've requested a self mute. It will automatically expire at <t:${endDateUtc.unix()}:f> (<t:${endDateUtc.unix()}:R>). You can prematurely end it by sending me ${inlineCode(this.env.PREFIX + 'unmute')} here.`,
                true
            );
            this.scheduleService.scheduleJob(
                `UNMUTE_${member.id}`,
                selfMute.endsAt,
                async () => await this.endSelfMute(selfMute)
            );
        } catch (e) {
            return {
                isSuccessful: false,
                reason: (e as Error).message,
                replyToUser: `I cannot mute you because you have more privileges than I do or because my role is lower than the muted role!`,
            };
        }

        await this.loggingService.logSelfmute(selfMute, amount + unit);

        return {
            isSuccessful: true,
        };
    }

    async validateArgs(args: string[]): Promise<void> {
        if (args.length == 0) {
            throw new ValidationError('0 args provided.', 'You have to give me a duration you want to be muted for!');
        }
        if (args.length > 1) {
            throw new ValidationError('More than 1 args provided.', 'You have to give me only one duration.');
        }
        const match = args[0].match(/[1-9][0-9]{0,2}([mhdw])/);
        if (match == null) {
            throw new ValidationError(
                `${args[0]} is not a recognizable time duration`,
                'Please give me a valid duration (m, h, d, w)!'
            );
        }
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
                    await this.endSelfMute(sm);
                } catch (e) {
                    this.logger.error(`Unable to unmute orphaned selfmute`, e);
                }
                await this.selfMutesRepository.deleteSelfMute(sm);
            } else {
                this.scheduleService.scheduleJob(
                    `UNMUTE_${sm.member.id}`,
                    sm.endsAt,
                    async () => await this.endSelfMute(sm)
                );
                restored++;
            }
        }
        return restored;
    }

    public async endSelfMute(selfMute: SelfMute) {
        this.logger.info(`Ending self mute for ${TextHelper.userLog(selfMute.member.user)}...`);
        await this.memberService.unmuteGuildMember(
            selfMute.member,
            selfMute.roles,
            `🔊 Your selfmute has ended and I've unmuted you. Welcome back!`,
            true
        );
        await this.selfMutesRepository.deleteSelfMute(selfMute);
        await this.loggingService.logSelfmute(selfMute);
        this.logger.info(`Ended self mute for ${TextHelper.userLog(selfMute.member.user)}...`);
    }
}
