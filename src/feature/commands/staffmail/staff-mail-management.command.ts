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
import { StaffMailCustomIds } from '@src/feature/interactions/models/staff-mail-custom-ids';
import { ComponentHelper } from '@src/helpers/component.helper';

@injectable()
export class StaffMailManagementCommand implements ICommand {
    name: string = 'staffmailmanagement';
    description: string =
        'Creates a staff mail management post where you can anonymously send a message to staff or open a ticket with them.';
    usageHint: string = '';
    examples: string[] = [];
    permissionLevel = CommandPermissionLevel.Administrator;
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
            .setLabel('Contact Discord Staff')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ name: '✉️' });
        message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('📯 Contacting Discord Staff')
                    .setColor(EmbedHelper.blue)
                    .setDescription(
                        `If you wish to **contact the Discord server staff team about a general matter pertaining to the server** that isn't urgent, please use one of the following ways to reach out:\n` +
                            `- ${bold('Use the button below')} or DM me ${inlineCode(this.env.PREFIX + 'staffmail')} to select what you would like to talk about.\n` +
                            `- If your issue is sensitive or pertaining to a staff member, please DM an <@&${this.env.ADMIN_ROLE_IDS[0]}>.\n\n` +
                            `Contacting staff through any of these means will start a conversation in our Direct Messages. Nobody but you and the staff team are able to see them. You are able to choose to remain anonymous as well.`
                    ),
            ],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(createButton)],
        });
        message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle(':fire_engine: Reporting Something')
                    .setColor(EmbedHelper.red)
                    .setDescription(
                        `If you have a report of someone breaking rules or another situation that requires ${bold("Staff's immediate attention")}, use one of these ways:\n\n` +
                            `- **Use the button below or DM me ${inlineCode(this.env.PREFIX + 'report')}!**\n` +
                            `- ${bold('Right-click a message and select Apps -> Report Message')} to quickly report a message.\n` +
                            `- If it is an urgent matter, feel free to **use the <@&${this.env.MODERATOR_ROLE_IDS[0]}> and <@&${this.env.ADMIN_ROLE_IDS[0]}> ping!**\n\n` +
                            `-# 💡 Hint: Including message links, screenshots or user names/IDs helps staff to resolve the issue faster. You can close and reopen the report menu without losing progress.`
                    ),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    ComponentHelper.reportButton(StaffMailCustomIds.InServerReportSendButton),
                    ComponentHelper.reportAnonButton(StaffMailCustomIds.InServerReportSendAnonButton)
                ),
            ],
        });
        return {
            isSuccessful: true,
        };
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}
