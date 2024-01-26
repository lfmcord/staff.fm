import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { bold, Client, EmbedBuilder, inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import container from '@src/inversify.config';
import { TYPES } from '@src/types';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';

@injectable()
export class HelpCommand implements ICommand {
    name: string = 'help';
    description: string = 'Displays all commands of the bot.';
    usageHint: string = '[name of command]';
    examples: string[] = ['', 'selfmute'];
    private client: Client;
    private readonly prefix: string;
    needsPrivilege: boolean = false;
    aliases = ['h'];

    constructor(@inject(TYPES.PREFIX) prefix: string, @inject(TYPES.Client) client: Client) {
        this.client = client;
        this.prefix = prefix;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        let embed;
        let messageOptions;

        if (args.length == 0) {
            embed = this.getCommandReference(message);
        } else {
            embed = this.getCommandHelp(message, args[0]);
        }

        if (!embed) {
            messageOptions = {
                content: `I cannot find a command with the name ${args[0]}. Use ${inlineCode(this.prefix + this.name)} to get an overview of all commands.`,
            };
        } else {
            messageOptions = { embeds: [embed] };
        }

        await message.channel.send(messageOptions);

        return {
            isSuccessful: true,
        };
    }

    private getCommandReference(message: Message): EmbedBuilder {
        let description = '';
        const commands: ICommand[] = container.getAll('Command');
        commands.sort((a, b) => a.name.localeCompare(b.name));
        commands.forEach((command) => {
            description += inlineCode(this.prefix + command.name) + `: ${command.description}\n`;
        });

        return EmbedHelper.getVerboseCommandEmbed(this.client, message)
            .setDescription(description)
            .setTitle('Command Reference');
    }

    private getCommandHelp(message: Message, commandName: string): EmbedBuilder | null {
        let description = '';
        const command: ICommand | null = (container.getAll('Command') as ICommand[]).find(
            (c: ICommand) => c.name == commandName.toLowerCase() || c.aliases.includes(commandName)
        ) as ICommand | null;

        if (!command) return null;

        description =
            `${bold('Description:')} ${command.description}\n\n` +
            `${bold('Usage:')} ${inlineCode(this.prefix + command.name.toLowerCase() + ' ' + command.usageHint)}\n\n`;

        if (command.examples.length > 0) {
            description += `${bold('Examples:\n')}`;
            command.examples.forEach(
                (e) => (description += inlineCode(this.prefix + command.name.toLowerCase() + ' ' + e) + '\n')
            );
            description += '\n';
        }

        description += `${bold('Aliases:')} ${command.aliases.join(', ')}`;

        return EmbedHelper.getVerboseCommandEmbed(this.client, message)
            .setDescription(description)
            .setTitle(TextHelper.pascalCase(commandName));
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}
