import { inject, injectable } from 'inversify';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';
import { ModalSubmitInteraction } from 'discord.js';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { TYPES } from '@src/types';
import { StaffMailModeEnum } from '@src/feature/staffmail/models/staff-mail-mode.enum';
import { StaffMailType } from '@src/feature/staffmail/models/staff-mail-type.enum';
import { Logger } from 'tslog';

@injectable()
export class StaffMailCreateReportInteraction implements IInteraction {
    customIds = [
        'defer-staff-mail-create-report-send-modal',
        'defer-staff-mail-create-report-sendanon-modal',
        'defer-staff-mail-create-crowns-send-modal',
        'defer-staff-mail-create-server-send-modal',
        'defer-staff-mail-create-lastfm-send-modal',
        'defer-staff-mail-create-other-send-modal',
        'defer-staff-mail-create-other-sendanon-modal',
    ];
    logger: Logger<StaffMailCreateReportInteraction>;
    staffMailRepository: StaffMailRepository;

    constructor(
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.BotLogger) logger: Logger<StaffMailCreateReportInteraction>
    ) {
        this.logger = logger;
        this.staffMailRepository = staffMailRepository;
    }

    async manage(interaction: ModalSubmitInteraction) {
        this.logger.debug(`Compiling information to create staff mail from customId ${interaction.customId}`);
        const summary = interaction.components[0].components[0].value;
        const text = interaction.components[1].components[0].value;
        const type = StaffMailType[interaction.customId.split('-')[4] as keyof typeof StaffMailType];
        const mode =
            interaction.customId.split('-')[5] == 'send' ? StaffMailModeEnum.NAMED : StaffMailModeEnum.ANONYMOUS;

        this.logger.debug(`Interaction is of type ${type} and mode ${mode}. Creating StaffMail...`);
        this.logger.trace(`Summary: ${summary}`);
        const staffMail = await this.staffMailRepository.createStaffMail(
            interaction.user,
            type,
            mode,
            summary,
            interaction.message!
        );
        await staffMail.channel!.send({
            // TODO: Make this embed prettier. Include Report type and combine outgoing/incoming with the summary text
            embeds: [EmbedHelper.getStaffMailStaffViewNewEmbed(interaction.user, interaction.user)],
        });

        this.logger.debug(`StaffMail channel is set up. Sending response to user...`);
        await interaction.message?.edit({
            components: [],
            embeds: [
                EmbedHelper.getStaffMailUserViewOutgoingEmbed(
                    interaction.user,
                    mode === StaffMailModeEnum.ANONYMOUS,
                    text,
                    summary,
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
