import { inject, injectable } from 'inversify';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';
import { EmbedBuilder, ModalSubmitInteraction } from 'discord.js';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { TYPES } from '@src/types';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { Logger } from 'tslog';
import { StaffMailCustomIds } from '@src/feature/interactions/models/staff-mail-custom-ids';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { Environment } from '@models/environment';
import container from '../../../inversify.config';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { WhoisCommand } from '@src/feature/commands/utility/whois.command';

@injectable()
export class StaffMailCreateModalSubmitInteraction implements IInteraction {
    customIds = [
        'defer-' + StaffMailCustomIds.ReportSendButton + '-modal',
        'defer-' + StaffMailCustomIds.ReportSendAnonButton + '-modal',
        'defer-' + StaffMailCustomIds.CrownsReportSendButton + '-modal',
        'defer-' + StaffMailCustomIds.CrownsFalseCrownSendButton + '-modal',
        'defer-' + StaffMailCustomIds.CrownsBanInquirySendButton + '-modal',
        'defer-' + StaffMailCustomIds.CrownsOtherSendButton + '-modal',
        'defer-' + StaffMailCustomIds.ServerSendButton + '-modal',
        'defer-' + StaffMailCustomIds.LastfmSendButton + '-modal',
        'defer-' + StaffMailCustomIds.OtherSendButton + '-modal',
        'defer-' + StaffMailCustomIds.OtherSendAnonButton + '-modal',
        'defer-' + StaffMailCustomIds.UrgentReportSendButton + '-modal',
        'defer-' + StaffMailCustomIds.UrgentReportSendAnonButton + '-modal',
    ];
    logger: Logger<StaffMailCreateModalSubmitInteraction>;
    loggingService: LoggingService;
    staffMailRepository: StaffMailRepository;
    env: Environment;

    constructor(
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.BotLogger) logger: Logger<StaffMailCreateModalSubmitInteraction>,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.env = env;
        this.loggingService = loggingService;
        this.logger = logger;
        this.staffMailRepository = staffMailRepository;
    }

    async manage(interaction: ModalSubmitInteraction) {
        this.logger.debug(`Compiling information to create staff mail from customId ${interaction.customId}`);
        const isCrownsModal = interaction.customId.includes('crowns');
        const isUrgent = interaction.customId.includes('urgent');
        const category = isCrownsModal
            ? interaction.customId.split('-')[4] + '-' + interaction.customId.split('-')[5]
            : interaction.customId.split('-')[4];
        const isAnonymous = interaction.customId.includes('anon');
        const mode = isAnonymous ? StaffMailModeEnum.ANONYMOUS : StaffMailModeEnum.NAMED;
        const humanReadableCategory = EmbedHelper.getHumanReadableStaffMailType(category);

        // crowns and urgent reports don't require a user summary
        const summary = isCrownsModal || isUrgent ? null : interaction.components[0].components[0].value;
        const text =
            isCrownsModal || isUrgent
                ? interaction.components[0].components[0].value
                : interaction.components[1].components[0].value;

        this.logger.debug(`Interaction is of category ${category} and mode ${mode}. Creating StaffMail...`);
        this.logger.trace(`Summary: ${summary}`);
        const staffMailChannel = await this.staffMailRepository.createStaffMailChannel(interaction.user, mode);

        let rolePings = '';
        this.env.STAFFMAIL_PING_ROLE_IDS.forEach((id) => (rolePings += `<@&${id}> `));
        const embeds: EmbedBuilder[] = [];
        embeds.push(
            EmbedHelper.getStaffMailStaffViewNewEmbed(
                isAnonymous ? null : interaction.user,
                isAnonymous ? null : interaction.user,
                category,
                summary
            )
        );
        if (!isAnonymous)
            (
                await (
                    container.getAll<ICommand>('Command').find((c) => c.name == 'whois') as WhoisCommand
                ).getEmbedsByDiscordUserId(interaction.user.id)
            ).forEach((e) => embeds.push(e));

        embeds.push(EmbedHelper.getStaffMailStaffViewIncomingEmbed(isAnonymous ? null : interaction.user, text));
        await staffMailChannel!.send({
            content: `${rolePings}New StaffMail: ${humanReadableCategory}`,
            embeds: embeds,
        });

        this.logger.debug(`StaffMail channel is set up. Sending response to user...`);
        const openedStaffMailMessage = await interaction.user.send({
            components: [],
            embeds: [
                EmbedHelper.getStaffMailOpenEmbed(false),
                EmbedHelper.getStaffMailUserViewOutgoingEmbed(
                    interaction.user,
                    mode === StaffMailModeEnum.ANONYMOUS,
                    text,
                    isCrownsModal ? null : summary,
                    category
                ),
            ],
        });
        openedStaffMailMessage?.pin();
        await this.staffMailRepository.createStaffMail(
            interaction.user,
            category,
            mode,
            summary,
            openedStaffMailMessage,
            staffMailChannel
        );
        await interaction.reply({
            ephemeral: true,
            content: `I've successfully sent your report! Staff will get back to you as soon as possible. I've also pinned the message in our direct messages. Check the pins in our DM chanel to see all your open StaffMails!`,
        });

        await this.loggingService.logStaffMailEvent(
            true,
            isCrownsModal ? null : summary,
            category,
            mode === StaffMailModeEnum.NAMED ? interaction.user : null,
            mode === StaffMailModeEnum.NAMED ? interaction.user : null,
            null
        );
    }
}
