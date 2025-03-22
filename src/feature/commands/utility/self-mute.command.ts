import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { ComponentHelper } from '@src/helpers/component.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ModerationService } from '@src/infrastructure/services/moderation.service';
import { TYPES } from '@src/types';
import { ActionRowBuilder, ButtonBuilder, inlineCode, Message, PartialMessage } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { unitOfTime } from 'moment';
import { Logger } from 'tslog';

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

    private moderationService: ModerationService;
    private env: Environment;
    private logger: Logger<SelfMuteCommand>;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.BotLogger) logger: Logger<SelfMuteCommand>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ModerationService) moderationService: ModerationService
    ) {
        this.moderationService = moderationService;
        this.env = env;
        this.logger = logger;
        this.memberService = memberService;
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

        try {
            await this.moderationService.muteGuildMember(
                member,
                member,
                endDateUtc.toDate(),
                {
                    content: `🔇 You've requested a self mute. It will automatically expire at <t:${endDateUtc.unix()}:f> (<t:${endDateUtc.unix()}:R>). You can prematurely end it by using the button below or sending me ${inlineCode(this.env.CORE.PREFIX + 'unmute')} here.`,
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(ComponentHelper.endSelfmuteButton()),
                    ],
                },
                { content: `🔊 Your selfmute has ended and I've unmuted you. Welcome back!` }
            );
        } catch (e) {
            return {
                isSuccessful: false,
                reason: (e as Error).message,
                replyToUser: `I cannot mute you because you have more privileges than I do or because my role is lower than the muted role!`,
            };
        }

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
}
