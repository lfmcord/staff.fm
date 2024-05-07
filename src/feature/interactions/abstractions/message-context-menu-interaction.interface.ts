import { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction } from 'discord.js';

export interface IMessageContextMenuInteraction {
    data: ContextMenuCommandBuilder;
    manage(interaction: MessageContextMenuCommandInteraction): Promise<void>;
}
