import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { Interactions } from '@src/feature/interactions/models/interactions';
import { ComponentHelper } from '@src/helpers/component.helper';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TYPES } from '@src/types';
import {
    ActionRowBuilder,
    bold,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder, InteractionContextType, PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { inject, injectable } from 'inversify';

@injectable()
export class StaffMailManagementCommand implements ICommand {
    name: string = 'staffmailmanagement';
    description: string = 'Creates a staff mail management post with interactive buttons.';
    permissionLevel = CommandPermissionLevel.Administrator;
    definition = new SlashCommandBuilder()
        .setName(this.name).setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .setContexts(InteractionContextType.Guild);

    private env: Environment;

    constructor(@inject(TYPES.ENVIRONMENT) env: Environment) {
        this.env = env;
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        if (!interaction.channel?.isSendable()) {
            return {
                isSuccessful: false,
                replyToUser: {
                    content: `I cannot send messages in this channel!`,
                },
            };
        }

        interaction.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('📯 Contacting Discord Staff')
                    .setColor(EmbedHelper.blue)
                    .setDescription(
                        `If you wish to **contact the Discord server staff team about a general matter pertaining to the server** that isn't urgent, please use one of the following ways to reach out:\n` +
                            `- ${bold('Use the button below')} to select what you would like to talk about.\n` +
                            `- If your issue is sensitive or pertaining to a staff member, please DM an <@&${this.env.ROLES.ADMIN_ROLE_IDS[0]}>.\n\n` +
                            `Contacting staff through any of these means will start a conversation in our Direct Messages. Nobody but you and the staff team are able to see them. You are able to choose to remain anonymous as well.`
                    ),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    ComponentHelper.sendButton(Interactions.StaffMail.ContactStaffButton),
                    ComponentHelper.sendAnonButton(Interactions.StaffMail.ContactStaffAnonButton)
                ),
            ],
        });
        interaction.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle(':fire_engine: Reporting Something')
                    .setColor(EmbedHelper.red)
                    .setDescription(
                        `If you have a report of someone breaking rules or another situation that requires ${bold("Staff's immediate attention")}, use one of these ways:\n\n` +
                            `- **Use the button belows**\n` +
                            `- ${bold('Right-click a message and select Apps -> Report Message')} to quickly report a message.\n` +
                            `- If it is an urgent matter, feel free to **use the <@&${this.env.ROLES.MODERATOR_ROLE_IDS[0]}> and <@&${this.env.ROLES.ADMIN_ROLE_IDS[0]}> ping!**\n\n` +
                            `-# 💡 Hint: Including message links, screenshots or user names/IDs helps staff to resolve the issue faster. You can close and reopen the report menu without losing progress.`
                    ),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    ComponentHelper.reportButton(Interactions.StaffMail.SendReportButton),
                    ComponentHelper.reportAnonButton(Interactions.StaffMail.SendAnonReportButton)
                ),
            ],
        });
        return {
            isSuccessful: true,
        };
    }

    validateArgs(_: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }
}
