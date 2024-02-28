import { inject, injectable } from 'inversify';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';
import { ButtonInteraction } from 'discord.js';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { ComponentHelper } from '@src/helpers/component.helper';
import { StaffMailCustomIds } from '@src/feature/interactions/models/staff-mail-custom-ids';
import { StaffMailType } from '@src/feature/interactions/models/staff-mail-type';

@injectable()
export class StaffMailCreateUrgentReportButtonInteraction implements IInteraction {
    customIds = [
        `defer-staff-mail-create-${StaffMailType.UrgentReport}-button`,
        `defer-staff-mail-create-${StaffMailType.UrgentReport}-button-anon`,
    ];
    logger: Logger<StaffMailCreateUrgentReportButtonInteraction>;

    constructor(@inject(TYPES.BotLogger) logger: Logger<StaffMailCreateUrgentReportButtonInteraction>) {
        this.logger = logger;
    }

    async manage(interaction: ButtonInteraction) {
        this.logger.debug(`New urgent report button interaction.`);
        const modal = ComponentHelper.staffMailCreateModal(StaffMailCustomIds.UrgentReportSendButton);
        await interaction.showModal(modal);
    }
}
