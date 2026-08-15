import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { StrikeHelper } from '@src/helpers/strike.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { ChatInputCommandInteraction, Message, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment/moment';
import { Logger } from 'tslog';

@injectable()
export class StrikesManageCommand implements ICommand {
    name: string = 'smanage';
    description: string = 'Manage strikes.'
    permissionLevel = CommandPermissionLevel.Moderator;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption((option) =>
            option.setName('user').setDescription('The discord user to check').setRequired(true)
        );

    private logger: Logger<StrikesManageCommand>;
    private memberService: MemberService;
    private usersRepository: UsersRepository;
    private environment: Environment;
    private loggingService: LoggingService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StrikesManageCommand>,
        @inject(TYPES.ENVIRONMENT) environment: Environment,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.logger = logger;
        this.environment = environment;
        this.loggingService = loggingService;
    }

    async validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
    }

    // TODO: Implement remove strike functionality
    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        let result: CommandResult;

        return {
            isSuccessful: false,
            replyToUser: { content: `strikemanage is not implemented yet.` },
        };
    }
}
