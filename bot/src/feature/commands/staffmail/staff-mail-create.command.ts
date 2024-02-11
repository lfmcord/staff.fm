import {
    ActionRowBuilder,
    bold,
    ButtonBuilder,
    ButtonInteraction,
    Client,
    inlineCode,
    Interaction,
    Message,
    MessageEditOptions,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { ComponentHelper } from '@src/helpers/component.helper';
import { InteractionIds } from '@src/feature/interactions/models/interaction-ids';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { StaffMailType } from '@src/feature/staffmail/models/staff-mail-type.enum';

@injectable()
export class StaffMailCreateCommand implements ICommand {
    name: string = 'staffmail';
    description: string = 'Creates a new staff mail message. Only usable in DMs.';
    usageHint: string = '';
    examples: string[] = ['', ''];
    permissionLevel = CommandPermissionLevel.User;
    aliases = [];
    isUsableInDms = true;
    isUsableInServer = false;

    private logger: Logger<StaffMailCreateCommand>;
    private client: Client;

    constructor(@inject(TYPES.BotLogger) logger: Logger<StaffMailCreateCommand>, @inject(TYPES.Client) client: Client) {
        this.client = client;
        this.logger = logger;
    }

    public async run(message: Message): Promise<CommandResult> {
        this.logger.info(`New staff mail message received.`);
        await this.createNewStaffMail(message);
        return {};
    }

    public validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }

    // TODO: This method sucks, improve it!
    private async createNewStaffMail(message: Message): Promise<void> {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(InteractionIds.StaffMailCreateType)
            .setPlaceholder(`What can staff help you with?`)
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Reporting a user or message')
                    .setDescription('Report a user or a message breaking a rule.')
                    .setEmoji('⚠️')
                    .setValue(StaffMailType[StaffMailType.report]),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Crowns Game')
                    .setDescription(
                        'Support surrounding the crowns game (crowns bans, opting back in, false crowns,...)'
                    )
                    .setEmoji('👑')
                    .setValue(StaffMailType[StaffMailType.crowns]),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Question/Suggestion about the server')
                    .setDescription('Questions or suggestions regarding the Last.fm Discord.')
                    .setEmoji('❔')
                    .setValue(StaffMailType[StaffMailType.server]),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Question about Last.fm')
                    .setDescription('Questions about the last.fm website and scrobbling.')
                    .setEmoji('<:lastfmred:900551196023083048>')
                    .setValue(StaffMailType[StaffMailType.lastfm]),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Other')
                    .setDescription("Other matters that don't fall under any of the other categories.")
                    .setEmoji('🃏')
                    .setValue(StaffMailType[StaffMailType.other])
            );

        const createMessageEmbed = EmbedHelper.getStaffMailCreateEmbed(this.client).setDescription(
            `Hello! Looks like you are trying to send a message to the Lastcord Staff team.\n\n${bold('Please select below what you need help with.')}`
        );

        const createMessage = await message.channel.send({
            embeds: [createMessageEmbed],
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(selectMenu),
                new ActionRowBuilder<ButtonBuilder>().setComponents(
                    ComponentHelper.cancelButton('staff-mail-create-cancel')
                ),
            ],
        });

        let typeMailSelection: StringSelectMenuInteraction | ButtonInteraction;
        const collectorFilter = (interaction: Interaction) => interaction.user.id === message.author.id;
        try {
            typeMailSelection = (await createMessage.awaitMessageComponent({
                filter: collectorFilter,
                time: 60_000,
            })) as StringSelectMenuInteraction | ButtonInteraction;
        } catch (e) {
            await createMessage.edit({
                content: 'Sending a Timed out after 60 seconds',
                components: [],
            });
            return;
        }

        await typeMailSelection.update({});
        if (typeMailSelection instanceof StringSelectMenuInteraction)
            await createMessage.edit(this.getMessageOptionsByMenuSelection(typeMailSelection.values[0]));
        else {
            await createMessage.edit({
                content: `You've cancelled the process of messaging staff. If you'd like to message after all, simply type ${inlineCode(`==staffmail`)} here.`,
                components: [],
                embeds: [],
            });
            return;
        }

        let sendInteraction: ButtonInteraction;
        try {
            sendInteraction = (await createMessage.awaitMessageComponent({
                filter: collectorFilter,
                time: 60_000,
            })) as ButtonInteraction;
        } catch (e) {
            await createMessage.edit({
                content: 'Sending a Timed out after 60 seconds',
                components: [],
            });
            return;
        }

        // TODO: Implement modals for all staffmail types
        const modal = new ModalBuilder()
            .setCustomId('defer-staff-mail-create-report-send-modal')
            .setTitle('Sending a report');

        const reportSummaryInput = new TextInputBuilder()
            .setCustomId('staff-mail-create-report-send-modal-summary')
            .setLabel('A short summary about your report')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(64);
        const reportTextInput = new TextInputBuilder()
            .setCustomId('staff-mail-create-report-send-modal-text')
            .setLabel("What you'd like to report")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(2048);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reportSummaryInput));
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reportTextInput));
        await sendInteraction.showModal(modal);
    }

    private getMessageOptionsByMenuSelection(selection: string): MessageEditOptions {
        const embed = EmbedHelper.getStaffMailCreateEmbed(this.client);
        let messageCreateOptions: MessageEditOptions = { embeds: [embed] };
        this.logger.info(`Received staff mail create type selection value of '${selection}'`);
        switch (selection) {
            case 'report':
                messageCreateOptions = {
                    embeds: [
                        embed
                            .setDescription(
                                `💡 When reporting a user or a message, it's always helpful to include a message link with your report.\n\n` +
                                    ` Please choose below if you want to send the report with your name or anonymously.`
                            )
                            .setTitle('⚠️ StaffMail - Report'),
                    ],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().setComponents(
                            ComponentHelper.sendButton(InteractionIds.StaffMailCreateReportSend),
                            ComponentHelper.sendAnonButton(InteractionIds.StaffMailCreateReportSendAnon)
                        ),
                    ],
                };
                break;
            // TODO: Implement cases
            case 'crowns': // TODO: Add another submenu for crowns?
            case 'server':
            case 'lastfm': // TODO: Add hint that we are not official last.fm support + link to support forums
            case 'other':
        }
        return messageCreateOptions;
    }
}
