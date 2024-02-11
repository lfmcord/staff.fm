import { inject, injectable } from 'inversify';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';
import { ModalSubmitInteraction } from 'discord.js';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { TYPES } from '@src/types';
import { StaffMailModeEnum } from '@src/feature/staffmail/models/staff-mail-mode.enum';
import { Logger } from 'tslog';
import { StaffMailCustomIds } from '@src/feature/interactions/models/staff-mail-custom-ids';

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
    ];
    logger: Logger<StaffMailCreateModalSubmitInteraction>;
    staffMailRepository: StaffMailRepository;

    constructor(
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.BotLogger) logger: Logger<StaffMailCreateModalSubmitInteraction>
    ) {
        this.logger = logger;
        this.staffMailRepository = staffMailRepository;
    }

    async manage(interaction: ModalSubmitInteraction) {
        this.logger.debug(`Compiling information to create staff mail from customId ${interaction.customId}`);
        const isCrownsModal = interaction.customId.includes('crowns');
        const category = isCrownsModal
            ? interaction.customId.split('-')[4] + '-' + interaction.customId.split('-')[5]
            : interaction.customId.split('-')[4];
        const isAnonymous = interaction.customId.includes('anon');
        const mode = isAnonymous ? StaffMailModeEnum.ANONYMOUS : StaffMailModeEnum.NAMED;
        const humanReadableCategory = EmbedHelper.getHumanReadableStaffMailType(category);
        const summary = isCrownsModal ? null : interaction.components[0].components[0].value;
        const text = isCrownsModal
            ? interaction.components[0].components[0].value
            : interaction.components[1].components[0].value;

        this.logger.debug(`Interaction is of category ${category} and mode ${mode}. Creating StaffMail...`);
        this.logger.trace(`Summary: ${summary}`);
        const staffMail = await this.staffMailRepository.createStaffMail(
            interaction.user,
            category,
            mode,
            summary,
            interaction.message!
        );
        await staffMail.channel!.send({
            content: `New StaffMail: ${humanReadableCategory}`, // TODO Staff ping
            embeds: [
                EmbedHelper.getStaffMailStaffViewNewEmbed(
                    isAnonymous ? null : interaction.user,
                    isAnonymous ? null : interaction.user,
                    category,
                    summary
                ),
                EmbedHelper.getStaffMailStaffViewIncomingEmbed(isAnonymous ? null : interaction.user, text),
            ],
        });

        this.logger.debug(`StaffMail channel is set up. Sending response to user...`);
        await interaction.message?.edit({
            components: [],
            embeds: [
                EmbedHelper.getStaffMailOpenEmbed,
                EmbedHelper.getStaffMailUserViewOutgoingEmbed(
                    interaction.user,
                    mode === StaffMailModeEnum.ANONYMOUS,
                    text,
                    isCrownsModal ? null : summary,
                    staffMail.type
                ),
            ],
        });
        interaction.message?.pin();
        await interaction.reply({
            ephemeral: true,
            content: `I've successfully sent your report! Staff will get back to you as soon as possible. I've also pinned the message. Check your pins to see all your open StaffMails!`,
        });
    }
}
