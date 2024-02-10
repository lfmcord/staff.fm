import { ButtonBuilder, ButtonStyle } from 'discord.js';

export class ComponentHelper {
    public static cancelButton = (customId: string) =>
        new ButtonBuilder().setCustomId(customId).setLabel('Cancel').setStyle(ButtonStyle.Danger);

    public static sendButton = (customId: string) =>
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('Send')
            .setStyle(ButtonStyle.Success)
            .setEmoji({ name: '✉️' });
    public static sendAnonButton = (customId: string) =>
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('Send anonymously')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji({ name: '🕵️' });
}
