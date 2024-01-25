import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Client, inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import container from '@src/inversify.config';
import { TYPES } from '@src/types';
import { EmbedHelper } from '@src/helpers/embed.helper';

@injectable()
export class Help implements ICommand {
    name: string = 'help';
    description: string = 'Displays all commands of the bot.';
    usageHint: string = '';
    private client: Client;
    private readonly prefix: string;
    needsPrivilege: boolean = false;

    constructor(@inject(TYPES.PREFIX) prefix: string, @inject(TYPES.Client) client: Client) {
        this.client = client;
        this.prefix = prefix;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        let description = '';
        let commands: ICommand[] = container.getAll('Command');
        commands.sort((a, b) => a.name.localeCompare(b.name));
        commands.forEach((command) => {
            description += inlineCode(this.prefix + command.name) + `: ${command.description}\n`;
        });

        let helpEmbed = EmbedHelper.getVerboseCommandEmbed(this.client, message)
            .setDescription(description)
            .setTitle('Command Reference');

        await message.channel.send({
            embeds: [helpEmbed],
        });

        return {
            isSuccessful: true,
        };
    }
}
