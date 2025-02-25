import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { StaffMailType } from '@src/feature/interactions/models/staff-mail-type';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TYPES } from '@src/types';
import {
    ButtonInteraction,
    Client,
    inlineCode,
    Interaction,
    InteractionReplyOptions,
    Message,
    StringSelectMenuInteraction,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

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

    async runInteraction(interaction: ButtonInteraction) {
        this.logger.info(`New staff mail create interaction received.`);
        await this.createNewStaffMailEphemeral(interaction);
    }

    public validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }

    private async createNewStaffMail(message: Message): Promise<void> {
        const createMessage: Message = await message.channel.send(EmbedHelper.getStaffMailCreateEmbed());

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

        // Setting the detail view for the chosen category
        if (categorySelection instanceof ButtonInteraction) return;
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

            if (crownsSubmenuSelection instanceof ButtonInteraction) return;
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
    }

    private async createNewStaffMailEphemeral(interaction: ButtonInteraction) {
        const replyOptions = EmbedHelper.getStaffMailCreateEmbed() as InteractionReplyOptions;
        replyOptions.ephemeral = true;
        replyOptions.fetchReply = true;
        const createMessage = await interaction.reply(replyOptions);

        // Handling the category selection menu
        let categorySelection: StringSelectMenuInteraction | ButtonInteraction;
        const collectorFilter = (interaction: Interaction) => interaction.user.id === interaction.user.id;

        try {
            categorySelection = (await createMessage.awaitMessageComponent({
                filter: collectorFilter,
                time: 120_000,
            })) as StringSelectMenuInteraction | ButtonInteraction;
        } catch (e) {
            await this.timeout(interaction);
            return;
        }

        // Setting the detail view for the chosen category
        if (categorySelection instanceof ButtonInteraction) return;
        await categorySelection.update({});
        const category: string = (categorySelection as StringSelectMenuInteraction).values[0];
        this.logger.debug(`User has selected a category (${category}). Proceeding to next menu.`);
        const response = EmbedHelper.getStaffMailCategoryEmbed(category) as InteractionReplyOptions;
        response.ephemeral = true;
        response.fetchReply = true;
        await interaction.editReply(response);

        // Crowns has a submenu, get the response for it.
        if (category === StaffMailType.Crowns) {
            let crownsSubmenuSelection: StringSelectMenuInteraction | ButtonInteraction;
            try {
                crownsSubmenuSelection = (await createMessage.awaitMessageComponent({
                    filter: collectorFilter,
                    time: 120_000,
                })) as StringSelectMenuInteraction | ButtonInteraction;
            } catch (e) {
                await this.timeout(interaction);
                return;
            }

            if (crownsSubmenuSelection instanceof ButtonInteraction) return;

            await crownsSubmenuSelection.update({});
            const crownsSubcategory: string = (crownsSubmenuSelection as StringSelectMenuInteraction).values[0];
            this.logger.debug(`User has selected a crowns sub-category (${crownsSubcategory}). Showing send button.`);
            const response = EmbedHelper.getStaffMailCrownsSubcategoryEmbed(
                crownsSubcategory
            ) as InteractionReplyOptions;
            response.ephemeral = true;
            response.fetchReply = true;
            await interaction.editReply(response);
        }

        // User gets a selection of send buttons (named and anon as optional)
        let sendInteraction: ButtonInteraction;
        try {
            sendInteraction = (await createMessage.awaitMessageComponent({
                filter: collectorFilter,
                time: 120_000,
            })) as ButtonInteraction;
        } catch (e) {
            await this.timeout(interaction);
            return;
        }
    }

    private async timeout(message: Message | ButtonInteraction) {
        this.logger.info(`Staff mail creation has timed out.`);
        const content = {
            content: `Request timed out after 2 minutes. If you'd still like to message, simply type ${inlineCode(`${this.env.CORE.PREFIX}${this.name}`)} here.`,
            components: [],
            embeds: [],
        };
        if (message instanceof Message) await message.edit(content);
        else await message.editReply(content);
    }
}
