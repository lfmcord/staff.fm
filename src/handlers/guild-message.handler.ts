import { Logger } from 'tslog';
import { inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { ICommand } from '@src/feature/commands/models/command.interface';
import container from '@src/inversify.config';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { IHandler } from '@src/handlers/models/handler.interface';
import { TextHelper } from '@src/helpers/text.helper';

@injectable()
export class GuildMessageHandler implements IHandler {
    private logger: Logger<GuildMessageHandler>;
    private readonly prefix: string;

    constructor(@inject(TYPES.BotLogger) logger: Logger<GuildMessageHandler>, @inject(TYPES.PREFIX) prefix: string) {
        this.prefix = prefix;
        this.logger = logger;
    }

    public async handle(message: Message) {
        const isCommand = message.content.startsWith(this.prefix);
        const isBot = message.author.bot;

        if (!isCommand || isBot) return;

        await this.handleCommand(message);
    }

    private async handleCommand(message: Message) {
        // Resolve command
        const commandName = message.content.slice(
            this.prefix.length,
            message.content.indexOf(' ') == -1 ? undefined : message.content.indexOf(' ')
        );
        const command = this.getCommandByName(commandName);
        if (!command) {
            this.logger.debug(`Could not find a command for name ${commandName}`);
            await this.handleCommandError(
                message,
                new Error(
                    `I could not find a command called '${commandName.toLowerCase()}'. ` +
                        `Use \`${this.prefix}help\` to see a list of all commands.`
                )
            );
            return;
        }

        // Run command
        const args = message.content!.split(' ').splice(1);
        let result: CommandResult;
        const start = new Date().getTime();
        try {
            await command.validateArgs(args);
        } catch (error) {
            this.logger.info(`Command validation failed: ${(error as Error).message}`);
            await this.handleCommandError(
                message,
                new Error(
                    (error as Error).message +
                        ` For more details, use ${inlineCode(this.prefix + commandName.toLowerCase())}.`
                )
            );
            return;
        }
        try {
            result = await command.run(message, args);
        } catch (error) {
            this.logger.error(`Failed to run command '${command?.name}'`, error);
            await this.handleCommandError(message, new Error(`Oops, something went wrong!`)); // TODO: Log with correlation ID (bubble down from BotLogger?) and add ID here. https://tslog.js.org/#/?id=settings
            return;
        }
        const end = new Date().getTime();

        // Handle result
        await this.handleCommandResult(message, result, commandName, end - start);
    }

    private async handleCommandError(message: Message, error: Error) {
        await message.reply(TextHelper.failure + ' ' + error.message);
        await message.react(TextHelper.failure);
    }

    private async handleCommandResult(
        message: Message,
        result: CommandResult,
        commandName: string,
        executionTime: number
    ) {
        let log = result.isSuccessful
            ? `Successfully finished command '${commandName}'.`
            : `Failed to finish command '${commandName}'${result.reason ? ` (Reason: '${result.reason}')` : ''}.`;
        log += ` Execution took ${executionTime}ms.`;
        this.logger.info(log);
        const emoji = result.isSuccessful ? TextHelper.success : TextHelper.failure;
        await message.react(emoji);

        if (result.replyToUser) {
            await message.reply(`${emoji} ${result.replyToUser}`);
        }
    }

    private getCommandByName(name: string): ICommand | null {
        this.logger.debug(`Matching command for command name '${name}'...`);
        const commands: ICommand[] = container.getAll('Command');
        return commands.find((c) => c.name == name.toLowerCase() || c.aliases.includes(name)) as ICommand | null;
    }
}
