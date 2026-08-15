import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { TextHelper } from '@src/helpers/text.helper';
import { ChatInputCommandInteraction, Message, PartialMessage, SlashCommandBuilder } from 'discord.js';
import { injectable } from 'inversify';

@injectable()
export class PingCommand implements ICommand {
    name: string = 'ping';
    description: string = 'Checks if the bot is up.';
    permissionLevel = CommandPermissionLevel.User;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const start = new Date().getTime();
        await interaction.reply({
            content: 'Pinging...',
        });
        const end = new Date().getTime();
        await interaction.editReply(`I\'m alive! 😌 Latency is ${end - start} ms.`);

        return {
            isSuccessful: true,
        };
    }

    validateArgs(_: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }
}
