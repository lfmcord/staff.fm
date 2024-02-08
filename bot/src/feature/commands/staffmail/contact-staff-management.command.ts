import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import {
    ActionRowBuilder,
    bold,
    ButtonBuilder,
    ButtonStyle,
    Client,
    EmbedBuilder,
    Message,
    PartialMessage,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { TYPES } from '@src/types';

@injectable()
export class ContactStaffManagementCommand implements ICommand {
    name: string = 'contactstaffmanagement';
    description: string =
        'Creates a staff mail/ticket management post where you can anonymously send a message to staff or open a ticket with them.';
    usageHint: string = '';
    client: Client;
    examples: string[] = [];
    permissionLevel = CommandPermissionLevel.Staff;
    aliases = ['contactstaffmanage'];

    constructor(@inject(TYPES.Client) client: Client) {
        this.client = client;
    }

    async run(message: Message | PartialMessage): Promise<CommandResult> {
        const ticketButton = new ButtonBuilder()
            .setCustomId('staff-contact-ticket-create')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ name: '📫' });
        const staffmailButton = new ButtonBuilder()
            .setCustomId('staff-contact-staffmail-create')
            .setLabel('Anonymous Message')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji({ name: '🕵️' });
        message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Create a ticket')
                    .setDescription(
                        'Click the button below to open a ticket with staff for matters like questions about the server, crowns game issues or when reporting rule violations. '
                    ),
            ],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(ticketButton)],
        });
        message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Message Staff anonymously')
                    .setDescription(
                        `If you have a sensitive matter where you feel more comfortable to message staff without revealing your name to them, please use this button. Your name will not show up for the staff team when using this option.\n\n⚠️ ${bold('Note:')} Please create a ticket instead if your matter requires us to know your name!`
                    ),
            ],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(staffmailButton)],
        });
        return {
            isSuccessful: true,
        };
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}
