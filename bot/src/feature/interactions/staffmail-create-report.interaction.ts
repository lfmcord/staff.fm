import { injectable } from 'inversify';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';
import { ModalSubmitInteraction } from 'discord.js';
import { EmbedHelper } from '@src/helpers/embed.helper';

@injectable()
export class StaffmailCreateReportInteraction implements IInteraction {
    customId = 'defer-staff-mail-create-report-send-modal';

    async manage(interaction: ModalSubmitInteraction) {
        await interaction.message?.edit({
            components: [],
            embeds: [
                EmbedHelper.getStaffMailEmbed(
                    interaction.user,
                    false,
                    false,
                    interaction.components[0].components[0].value
                ),
            ],
        });
        await interaction.reply({
            ephemeral: true,
            content: `I've successfully sent your report! Staff will get back to you as soon as possible.`,
        });
        return Promise.resolve();
    }
}
