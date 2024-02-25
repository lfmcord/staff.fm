import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import {
    ActionRowBuilder,
    bold,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    inlineCode,
    Message,
    PartialMessage,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { TYPES } from '@src/types';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { Environment } from '@models/environment';

@injectable()
export class StaffMailManagementCommand implements ICommand {
    name: string = 'staffmailmanagement';
    description: string =
        'Creates a staff mail management post where you can anonymously send a message to staff or open a ticket with them.';
    usageHint: string = '';
    examples: string[] = [];
    permissionLevel = CommandPermissionLevel.Staff;
    aliases = ['staffmailmanage', 'staffmailmenu'];
    isUsableInDms = false;
    isUsableInServer = true;

    private env: Environment;

    constructor(@inject(TYPES.ENVIRONMENT) env: Environment) {
        this.env = env;
    }

    async run(message: Message | PartialMessage): Promise<CommandResult> {
        const createButton = new ButtonBuilder()
            .setCustomId('defer-staff-mail-create-button')
            .setLabel('Send a message')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ name: '📫' });
        message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('How to contact staff')
                    .setColor(EmbedHelper.blue)
                    .setDescription(
                        `If you wish to contact the staff team, ${bold('please use the button below')}. You can also simply DM me ${inlineCode(this.env.PREFIX + 'staffmail')} to start the process!` +
                            `\n\nSending a message to staff will start a conversation in our Direct Messages. Nobody but you and the staff team are able to see them.\n\n` +
                            `If it is an urgent matter, feel free to use the <@&${this.env.STAFF_ROLE_IDS[0]}> ping!`
                    ),
            ],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(createButton)],
        });
        return {
            isSuccessful: true,
        };
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}
