import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    Client,
    EmbedBuilder,
    Message,
    PartialMessage,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { TYPES } from '@src/types';

@injectable()
export class EventManagementCommand implements ICommand {
    name: string = 'eventmanagement';
    description: string = 'Creates an event management post where you can manage events from.';
    usageHint: string = '';
    client: Client;
    examples: string[] = [];
    permissionLevel = CommandPermissionLevel.Staff;
    aliases = ['eventmanage'];

    constructor(@inject(TYPES.Client) client: Client) {
        this.client = client;
    }

    async run(message: Message | PartialMessage): Promise<CommandResult> {
        const createButton = new ButtonBuilder()
            .setCustomId('defer-event-create')
            .setLabel('Create Event')
            .setStyle(ButtonStyle.Primary);
        const createMenu = new ChannelSelectMenuBuilder().setMinValues(1).setMaxValues(1).setCustomId('event-create');
        message.channel.send({
            embeds: [new EmbedBuilder().setTitle('Create Events').setDescription('Click the button to create events')],
            components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(createMenu)],
        });
        return {
            isSuccessful: true,
        };
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}
