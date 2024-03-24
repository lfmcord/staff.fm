import { inject, injectable } from 'inversify';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';
import { ButtonInteraction } from 'discord.js';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { StaffMailCustomIds } from '@src/feature/interactions/models/staff-mail-custom-ids';
import { ComponentHelper } from '@src/helpers/component.helper';

@injectable()
export class StaffMailCreateModalShowInteraction implements IInteraction {
    customIds = [
        StaffMailCustomIds.ReportSendButton,
        StaffMailCustomIds.ReportSendAnonButton,
        StaffMailCustomIds.CrownsReportSendButton,
        StaffMailCustomIds.CrownsFalseCrownSendButton,
        StaffMailCustomIds.CrownsBanInquirySendButton,
        StaffMailCustomIds.CrownsOtherSendButton,
        StaffMailCustomIds.ServerSendButton,
        StaffMailCustomIds.LastfmSendButton,
        StaffMailCustomIds.OtherSendButton,
        StaffMailCustomIds.OtherSendAnonButton,
        StaffMailCustomIds.UrgentReportSendButton,
        StaffMailCustomIds.UrgentReportSendAnonButton,
    ];
    logger: Logger<StaffMailCreateModalShowInteraction>;

    constructor(@inject(TYPES.BotLogger) logger: Logger<StaffMailCreateModalShowInteraction>) {
        this.logger = logger;
    }

    async manage(interaction: ButtonInteraction) {
        this.logger.debug(`Menus finished, trying to show modal for report type: ${interaction.customId}.`);
        const modal = ComponentHelper.staffMailCreateModal(interaction.customId);
        await interaction.showModal(modal);
    }
}