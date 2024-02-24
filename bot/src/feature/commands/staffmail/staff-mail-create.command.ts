import { ButtonInteraction, Client, inlineCode, Interaction, Message, StringSelectMenuInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { ComponentHelper } from '@src/helpers/component.helper';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { StaffMailType } from '@src/feature/interactions/models/staff-mail-type';
import { StaffMailCustomIds } from '@src/feature/interactions/models/staff-mail-custom-ids';
import { Environment } from '@models/environment';

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
    private env: Environment;
    private client: Client;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StaffMailCreateCommand>,
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.env = env;
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

    private async createNewStaffMail(message: Message): Promise<void> {
        const createMessage = await message.channel.send(EmbedHelper.getStaffMailCreateEmbed());

        // Handling the category selection menu
        let categorySelection: StringSelectMenuInteraction | ButtonInteraction;
        const collectorFilter = (interaction: Interaction) => interaction.user.id === message.author.id;
        try {
            categorySelection = (await createMessage.awaitMessageComponent({
                filter: collectorFilter,
                time: 120_000,
            })) as StringSelectMenuInteraction | ButtonInteraction;
        } catch (e) {
            await this.timeout(createMessage);
            return;
        }

        if (categorySelection instanceof ButtonInteraction) {
            await this.cancel(createMessage);
            return;
        }

        // Setting the detail view for the chosen category
        await categorySelection.update({});
        const category: string = (categorySelection as StringSelectMenuInteraction).values[0];
        this.logger.debug(`User has selected a category (${category}). Proceeding to next menu.`);
        await createMessage.edit(EmbedHelper.getStaffMailCategoryEmbed(category));

        // Crowns has a submenu, get the response for it.
        if (category === StaffMailType.Crowns) {
            let crownsSubmenuSelection: StringSelectMenuInteraction | ButtonInteraction;
            try {
                crownsSubmenuSelection = (await createMessage.awaitMessageComponent({
                    filter: collectorFilter,
                    time: 120_000,
                })) as StringSelectMenuInteraction | ButtonInteraction;
            } catch (e) {
                await this.timeout(createMessage);
                return;
            }

            if (crownsSubmenuSelection instanceof ButtonInteraction) {
                await this.cancel(createMessage);
                return;
            }

            await crownsSubmenuSelection.update({});
            const crownsSubcategory: string = (crownsSubmenuSelection as StringSelectMenuInteraction).values[0];
            this.logger.debug(`User has selected a crowns sub-category (${crownsSubcategory}). Showing send button.`);
            await createMessage.edit(EmbedHelper.getStaffMailCrownsSubcategoryEmbed(crownsSubcategory));
        }

        // User gets a selection of send buttons (named and anon as optional)
        let sendInteraction: ButtonInteraction;
        try {
            sendInteraction = (await createMessage.awaitMessageComponent({
                filter: collectorFilter,
                time: 120_000,
            })) as ButtonInteraction;
        } catch (e) {
            await this.timeout(createMessage);
            return;
        }

        if (sendInteraction.customId === StaffMailCustomIds.CancelButton) {
            await this.cancel(createMessage);
            await sendInteraction.update({});
            return;
        }

        // Show the modal according to the chosen send button
        this.logger.debug(`Menus finished, trying to show modal for report type: ${sendInteraction.customId}.`);
        const modal = ComponentHelper.staffMailCreateModal(sendInteraction.customId);
        await sendInteraction.showModal(modal);
    }

    private async cancel(message: Message) {
        this.logger.info(`User has cancelled sending a staff mail.`);
        await message.edit({
            content: `You've cancelled the process of messaging staff. If you'd like to message after all, simply type ${inlineCode(`${this.env.PREFIX}${this.name}`)} here.`,
            components: [],
            embeds: [],
        });
    }

    private async timeout(message: Message) {
        this.logger.info(`Staff mail creation has timed out.`);
        await message.edit({
            content: `Request timed out after 2 minutes. If you'd still like to message, simply type ${inlineCode(`${this.env.PREFIX}${this.name}`)} here.`,
            components: [],
            embeds: [],
        });
    }
}
