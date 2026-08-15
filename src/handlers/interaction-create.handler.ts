import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { IMessageContextMenuInteraction } from '@src/feature/interactions/abstractions/message-context-menu-interaction.interface';
import { IModalSubmitInteraction } from '@src/feature/interactions/abstractions/modal-submit-interaction.interface';
import { IHandler } from '@src/handlers/models/handler.interface';
import { CommandService } from '@src/infrastructure/services/command.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import {
    ChatInputCommandInteraction,
    inlineCode,
    Interaction,
    MessageComponentInteraction,
    MessageContextMenuCommandInteraction,
    ModalSubmitInteraction, StringSelectMenuInteraction,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import container from '../inversify.config';
import { Interactions } from '@src/feature/interactions/models/interactions';
import {
    IStringSelectMenuInteraction
} from '@src/feature/interactions/abstractions/string-select-menu-interaction.interface';

@injectable()
export class InteractionCreateHandler implements IHandler {
    eventType = 'interactionCreate';
    private logger: Logger<InteractionCreateHandler>;
    private memberService: MemberService;
    private commandService: CommandService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<InteractionCreateHandler>,
        @inject(TYPES.CommandService) commandService: CommandService,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.memberService = memberService;
        this.commandService = commandService;
        this.logger = logger;
    }

    async handle(interaction: Interaction) {
        if (interaction.isMessageContextMenuCommand()) {
            await this.handleMessageContextMenuCommandInteraction(interaction as MessageContextMenuCommandInteraction);
        } else if (interaction.isMessageComponent()) {
            await this.handleMessageComponentInteraction(interaction as MessageComponentInteraction);
        } else if (interaction.isModalSubmit()) {
            await this.handleModalSubmitInteraction(interaction as ModalSubmitInteraction);
        } else if (interaction.isChatInputCommand()) {
            await this.handleChatInputCommand(interaction as ChatInputCommandInteraction);
        } else if (interaction.isStringSelectMenu()) {
            await this.handleStringSelectMenuInteraction(interaction as StringSelectMenuInteraction);
        } else {
            this.logger.warn(`No handler for interaction type ${interaction.type} with ID ${interaction.id}`);
        }
    }

    private async handleMessageContextMenuCommandInteraction(
        interaction: MessageContextMenuCommandInteraction
    ): Promise<void> {
        const interactions = container.getAll<IMessageContextMenuInteraction>('MessageContextMenuInteraction');
        const foundInteraction = interactions.find(
            (i: IMessageContextMenuInteraction) => i.data.name === interaction.commandName
        );
        if (!foundInteraction) {
            this.logger.error(
                `Could not find message context menu interaction for name ${interaction.commandName} among ${interactions?.length} message context menu interactions.`
            );
            return;
        }

        this.logger.debug(`${foundInteraction.constructor.name} is handling the message context menu  interaction...`);
        await foundInteraction.manage(interaction);
    }

    private async handleMessageComponentInteraction(interaction: MessageComponentInteraction) {
        if (interaction.customId === Interactions.CancelButton) {
            await interaction.update({ content: `Cancelled.`, embeds: [], components: [] });
            return;
        }
        const interactions = container.getAll<IMessageComponentInteraction>('MessageComponentInteraction');
        const foundInteraction = interactions.find(
            (i: IMessageComponentInteraction) =>
                i.customIds.includes(interaction.customId) ||
                i.customIds.some((id) => interaction.customId.startsWith(id))
        );
        if (!foundInteraction) {
            this.logger.error(
                `Could not find message component interaction for ID ${interaction.customId} among ${interactions?.length} message component interactions.`
            );
            return;
        }

        this.logger.debug(`${foundInteraction.constructor.name} is handling the message component interaction...`);
        await foundInteraction.manage(interaction);
    }

    private async handleModalSubmitInteraction(interaction: ModalSubmitInteraction) {
        const interactions = container.getAll<IModalSubmitInteraction>('ModalSubmitInteraction');
        const foundInteraction = interactions.find((i: IModalSubmitInteraction) =>
            i.customIds.includes(interaction.customId)
        );
        if (!foundInteraction) {
            this.logger.error(
                `Could not find modal submit interaction for ID ${interaction.customId} among ${interactions?.length} modal submit interactions.`
            );
            return;
        }

        this.logger.debug(`${foundInteraction.constructor.name} is handling the modal submit interaction...`);
        await foundInteraction.manage(interaction);
    }

    private async handleChatInputCommand(interaction: ChatInputCommandInteraction) {
        // Resolve command
        const command = await this.resolveCommand(interaction);
        if (!command) return;

        // Check permissions
        if (!interaction.member) {
            await this.commandService.handleError(interaction, "I don't know who's trying to run this command");
        }
        const member = await this.memberService.getGuildMemberFromUserId(interaction.member!.user.id);
        if (!(await this.commandService.isPermittedToRun(member!, command))) {
            await this.commandService.handleError(
                interaction,
                `You do not have sufficient permissions to use this command.`
            );
            return;
        }

        // Run command
        const start = new Date().getTime();
        let result: CommandResult;
        try {
            this.logger.info(`Validating arguments for command ${command.name}...`);
            await command.validateArgs(interaction);
            this.logger.info(`Running command ${command.name}...`);
            result = await command.run(interaction);
        } catch (error) {
            if (error instanceof ValidationError) {
                this.logger.info(`Command validation failed: ${error.internalMessage}`);
                await this.commandService.handleError(
                    interaction,
                    error.messageToUser
                );
                return;
            }
            this.logger.error(`Failed to run command '${command?.name}'`, error);
            await this.commandService.handleError(interaction); // TODO: Log with correlation ID (bubble down from BotLogger?) and add ID here. https://tslog.js.org/#/?id=settings
            return;
        }
        const end = new Date().getTime();

        // Handle result
        await this.commandService.handleResult(interaction, result, command.name, end - start);
    }

    private async handleStringSelectMenuInteraction(interaction: StringSelectMenuInteraction) {
        const interactions = container.getAll<IStringSelectMenuInteraction>('StringSelectMenuInteraction');
        const foundInteraction = interactions.find(
            (i: IStringSelectMenuInteraction) =>
                i.customIds.includes(interaction.customId) ||
                i.customIds.some((id) => interaction.customId.startsWith(id))
        );
        if (!foundInteraction) {
            this.logger.error(
                `Could not find string select menu interaction for ID ${interaction.customId} among ${interactions?.length} string select menu interactions.`
            );
            return;
        }

        this.logger.debug(`${foundInteraction.constructor.name} is handling the string select menu interaction...`);
        await foundInteraction.manage(interaction);
    }

    private async resolveCommand(interaction: ChatInputCommandInteraction): Promise<ICommand | null> {
        const commandName = interaction.commandName;
        this.logger.debug(`Matching command for command name '${commandName}'...`);
        const commands: ICommand[] = container.getAll('Command');
        const command = commands.find((c) => c.name == commandName) as ICommand | null;

        if (!command) {
            this.logger.debug(`Could not find a command for name ${commandName}`);
            await this.commandService.handleError(
                interaction,
                `I could not find a command called '${commandName}'. ` + `Use \`/help\` to see a list of all commands.`
            );
            return null;
        }

        return command;
    }
}
