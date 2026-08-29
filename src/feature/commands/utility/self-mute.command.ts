import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { ComponentHelper } from '@src/helpers/component.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ModerationService } from '@src/infrastructure/services/moderation.service';
import { TYPES } from '@src/types';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ChatInputCommandInteraction,
    inlineCode, InteractionContextType,
    SlashCommandBuilder,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { unitOfTime } from 'moment';
import { Logger } from 'tslog';

@injectable()
export class SelfMuteCommand implements ICommand {
    name: string = 'selfmute';
    description: string = 'Mutes yourself for a set duration.';
    permissionLevel = CommandPermissionLevel.User;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild)
        .addNumberOption((option) => option.setName("minutes").setDescription("The number of minutes to mute yourself for."))
        .addNumberOption((option) => option.setName("hours").setDescription("The number of hours to mute yourself for."))
        .addNumberOption((option) => option.setName("days").setDescription("The number of days to mute yourself for."))
        .addNumberOption((option) => option.setName("weeks").setDescription("The number of weeks to mute yourself for."));

    private moderationService: ModerationService;
    private env: Environment;
    private logger: Logger<SelfMuteCommand>;
    private memberService: MemberService;
    private usersRepository: UsersRepository;

    constructor(
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.BotLogger) logger: Logger<SelfMuteCommand>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ModerationService) moderationService: ModerationService,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository
    ) {
        this.moderationService = moderationService;
        this.env = env;
        this.logger = logger;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
    }

    async validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        const minutes = interaction.options.getNumber("minutes");
        const hours = interaction.options.getNumber("hours");
        const days = interaction.options.getNumber("days");
        const weeks = interaction.options.getNumber("weeks");

        if (!minutes && !hours && !days && !weeks) {
            throw new ValidationError(
                "No duration provided.",
                "You must provide a duration for your selfmute. Use the options `minutes`, `hours`, `days`, or `weeks`."
            );
        }

        if(minutes && minutes < 5) {
            throw new ValidationError(
                "Duration too short.",
                "Your selfmute has to be at least 5 minutes long."
            );
        }

        // Make sure selfmute is not longer than 4 weeks
        const totalDurationInMinutes = (minutes || 0) + (hours || 0) * 60 + (days || 0) * 1440 + (weeks || 0) * 10080;
        if (totalDurationInMinutes > 40320) {
            throw new ValidationError(
                "Duration too long.",
                "Your selfmute cannot be longer than 4 weeks."
            );
        }
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const minutes = interaction.options.getNumber("minutes");
        const hours = interaction.options.getNumber("hours");
        const days = interaction.options.getNumber("days");
        const weeks = interaction.options.getNumber("weeks");

        const totalDurationInMinutes = (minutes || 0) + (hours || 0) * 60 + (days || 0) * 1440 + (weeks || 0) * 10080;

        this.logger.info(`Creating new selfmute for user ${TextHelper.userLog(interaction.user!)} for ${totalDurationInMinutes} minutes...`);
        const now = moment.utc();
        const endDateUtc = now.add(totalDurationInMinutes, 'minutes');
        const member = await this.memberService.getGuildMemberFromUserId(interaction.user!.id);
        if (!member) throw Error(`Cannot find user with user ID ${interaction.user!.id}. Has the user left the guild?`);
        const user = await this.usersRepository.getUserByUserId(member.id);

        let muteMessage = `🔇 You've requested a self mute. It will automatically expire at <t:${endDateUtc.unix()}:f> (<t:${endDateUtc.unix()}:R>).`;
        if (!user?.strictSelfmute)
            muteMessage += `You can prematurely end it by using the button below or using the ${inlineCode('/unmute')} command here.`;

        try {
            await this.moderationService.muteGuildMember(
                member,
                member.user,
                endDateUtc.toDate(),
                {
                    content: muteMessage,
                    components: user?.strictSelfmute
                        ? []
                        : [new ActionRowBuilder<ButtonBuilder>().addComponents(ComponentHelper.endSelfmuteButton())],
                },
                { content: `🔊 Your selfmute has ended and I've unmuted you. Welcome back!` }
            );
        } catch (e) {
            return {
                isSuccessful: false,
                reason: (e as Error).message,
                replyToUser: {
                    content: `I cannot mute you because you have more privileges than I do or because my role is lower than the muted role!`,
                },
            };
        }

        return {
            isSuccessful: true,
        };
    }
}
