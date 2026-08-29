import { Environment } from '@models/environment';
import { IModalSubmitInteraction } from '@src/feature/interactions/abstractions/modal-submit-interaction.interface';
import { Interactions } from '@src/feature/interactions/models/interactions';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { EmbedBuilder, GuildMember, ModalSubmitInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import container from '@src/inversify.config';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { StaffMailCreateCommand } from '@src/feature/commands/staffmail/staff-mail-create.command';

@injectable()
export class StaffMailSubmitInteraction implements IModalSubmitInteraction {
    customIds = [
        Interactions.StaffMail.CreateModal.Submit,
        Interactions.StaffMail.CreateModal.SubmitAnonymous,
    ];
    logger: Logger<StaffMailSubmitInteraction>;
    memberService: MemberService;
    usersRepository: UsersRepository;
    loggingService: LoggingService;
    staffMailRepository: StaffMailRepository;
    env: Environment;

    constructor(
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.BotLogger) logger: Logger<StaffMailSubmitInteraction>,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.env = env;
        this.loggingService = loggingService;
        this.logger = logger;
        this.staffMailRepository = staffMailRepository;
    }

    async manage(interaction: ModalSubmitInteraction) {
        if (!interaction.deferred)
            await interaction.deferReply({
                flags: 'Ephemeral',
            });

        this.logger.debug(`Interaction ID ${interaction.customId} is a StaffMail create button interaction.`);
        const staffmailCommand = container.getAll<ICommand>('Command').find((c) => c.name === 'staffmail');
        (staffmailCommand as StaffMailCreateCommand)?.runInteraction(interaction);
    }
}
