import { injectable } from 'inversify';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';
import { ModalSubmitInteraction } from 'discord.js';
import { EmbedHelper } from '@src/helpers/embed.helper';

@injectable()
export class StaffmailCreateReportInteraction implements IInteraction {
    // TODO: Make this reusable for all staffmails?
    customId = 'defer-staff-mail-create-report-send-modal';

    async manage(interaction: ModalSubmitInteraction) {
        const summary = interaction.components[0].components[0].value;
        const text = interaction.components[1].components[0].value;

        // TODO: Create new staff mail in repository
        // TODO: Send message to new staff mail channel
        await interaction.message?.edit({
            components: [],
            // TODO: Make this embed prettier. Include Report type and combine outgoing/incoming with the summary text
            embeds: [EmbedHelper.getStaffMailEmbed(interaction.user, false, false, text).setTitle(summary)],
        });
        interaction.message?.pin();
        await interaction.reply({
            ephemeral: true,
            content: `I've successfully sent your report! Staff will get back to you as soon as possible. I've also pinned the message. Check your pins to see all your open StaffMails!`,
        });
        return Promise.resolve();
    }
}
