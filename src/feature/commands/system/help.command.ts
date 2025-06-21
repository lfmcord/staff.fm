import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { bold, Client, inlineCode, Message, MessageCreateOptions } from 'discord.js';
import { inject, injectable } from 'inversify';
import container from '../../../inversify.config';

@injectable()
export class HelpCommand implements ICommand {
    name: string = 'help';
    description: string = 'Displays all commands of the bot.';
    usageHint: string = '[name of command]';
    private memberService: MemberService;
    examples: string[] = ['', 'selfmute'];
    private client: Client;
    private readonly env: Environment;
    permissionLevel = CommandPermissionLevel.User;
    aliases = ['h'];
    isUsableInDms = true;
    isUsableInServer = true;

    constructor(
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.memberService = memberService;
        this.client = client;
        this.env = env;
    }

    async run(message: Message<true>, args: string[]): Promise<CommandResult> {
        let reply;
        const member = await this.memberService.getGuildMemberFromUserId(message.author.id);
        const memberPermissionLevel = await this.memberService.getMemberPermissionLevel(member!);

        if (args.length == 0) {
            reply = await this.getCommandReference(message, memberPermissionLevel);
        } else {
            reply = this.getCommandHelp(message, args[0], memberPermissionLevel);
        }

        await message.channel.send(reply);

        return {
            isSuccessful: reply.embeds != null,
        };
    }

    private async getCommandReference(
        message: Message,
        memberPermissionLevel: CommandPermissionLevel
    ): Promise<MessageCreateOptions> {
        let description = '';
        const commands: ICommand[] = container.getAll('Command');
        commands.sort((a, b) => a.name.localeCompare(b.name));

        commands.forEach((command) => {
            if (memberPermissionLevel >= command.permissionLevel)
                description += inlineCode(this.env.CORE.PREFIX + command.name) + `: ${command.description}\n`;
        });

        return {
            embeds: [
                EmbedHelper.getVerboseCommandEmbed(this.client, message)
                    .setDescription(description)
                    .setTitle('Command Reference')
                    .setFooter({
                        text: `Type ${this.env.CORE.PREFIX}help [command name] to find out more about a command.`,
                    }),
            ],
        };
    }

    private getCommandHelp(
        message: Message,
        commandName: string,
        memberPermissionLevel: CommandPermissionLevel
    ): MessageCreateOptions {
        let description = '';
        const command: ICommand | null = (container.getAll('Command') as ICommand[]).find(
            (c: ICommand) => c.name == commandName.toLowerCase() || c.aliases.includes(commandName)
        ) as ICommand | null;

        if (!command)
            return {
                content: `I cannot find a command with the name ${commandName}. Use ${inlineCode(this.env.CORE.PREFIX + this.name)} to get an overview of all commands.`,
            };

        if (command.permissionLevel > memberPermissionLevel)
            return { content: "You cannot look up help for this command since you're not allowed to run it." };

        description =
            `${bold('Description:')} ${command.description}\n\n` +
            `${bold('Permission Level:')} ${CommandPermissionLevel[command.permissionLevel]}\n\n` +
            `${bold('Usage:')} ${inlineCode(this.env.CORE.PREFIX + command.name.toLowerCase() + ' ' + command.usageHint)}\n\n`;

        if (command.examples.length > 0) {
            description += `${bold('Examples:\n')}`;
            command.examples.forEach(
                (e) => (description += inlineCode(this.env.CORE.PREFIX + command.name.toLowerCase() + ' ' + e) + '\n')
            );
            description += '\n';
        }

        if (command.aliases.length > 0) description += `${bold('Aliases:')} ${command.aliases.join(', ')}`;

        return {
            embeds: [
                EmbedHelper.getVerboseCommandEmbed(this.client, message)
                    .setDescription(description)
                    .setTitle(TextHelper.pascalCase(commandName)),
            ],
        };
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}
