import { inject, injectable } from 'inversify';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { ButtonInteraction } from 'discord.js';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { Interactions } from '@src/feature/interactions/models/interactions';
import { ComponentHelper } from '@src/helpers/component.helper';

@injectable()
export class StaffMailCreateInteraction implements IMessageComponentInteraction {
    customIds = [
        Interactions.StaffMail.SendReportButton,
        Interactions.StaffMail.SendAnonReportButton,
        Interactions.StaffMail.ContactStaffButton,
        Interactions.StaffMail.ContactStaffAnonButton,
    ];
    logger: Logger<StaffMailCreateInteraction>;

    constructor(@inject(TYPES.BotLogger) logger: Logger<StaffMailCreateInteraction>) {
        this.logger = logger;
    }

    async manage(interaction: ButtonInteraction) {
        this.logger.debug(`Trying to show modal for report type: ${interaction.customId}.`);
        const modal = ComponentHelper.staffMailCreateModal(interaction.customId);
        await interaction.showModal(modal);
    }
}
