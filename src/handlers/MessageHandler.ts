import { Logger } from 'tslog';
import { Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { ICommand } from '@commands/abstractions/ICommand';
import container from '@src/inversify.config';
import { CommandResult } from '@models/CommandResult';

@injectable()
export class MessageHandler {
    private logger: Logger<MessageHandler>;
    private readonly prefix: string;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<MessageHandler>,
        @inject(TYPES.PREFIX) prefix: string
    ) {
        this.prefix = prefix;
        this.logger = logger;
    }

    public async handleMessageCreate(message: Message): Promise<void> {
        // Resolve command
        const commandName = message.content.slice(
            this.prefix.length,
            message.content.indexOf(' ') == -1 ? undefined : message.content.indexOf(' ') + 1
        );
        let command = this.getCommandByName(commandName);
        if (!command) {
            await this.handleCommandError(
                message,
                new Error(
                    `I could not find a command called '${commandName.toLowerCase()}'.` +
                        `Use \`${this.prefix}help\` to see a list of all commands.`
                )
            );
            return;
        }

        // Run command
        let args = message.content!.split(' ').splice(0, 1);
        let result: CommandResult;
        const start = new Date().getTime();
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

    public async handleCommandError(message: Message, error: Error) {
        await message.reply('❌ ' + error.message);
        await message.react('❌');
    }

    public async handleCommandResult(
        message: Message,
        result: CommandResult,
        commandName: string,
        executionTime: number
    ) {
        let log = result.isSuccessful
            ? `Successfully finished command '${commandName}'.`
            : `Failed to finish command '${commandName}'${result.reason ? ` (Reason: ${result.reason})` : ''}.`;
        log += `Execution took ${executionTime}ms.`;
        this.logger.info(log);

        if (result.replyToUser) {
            let emoji = result.isSuccessful ? '✅' : '❌';
            await message.reply(`${emoji} ${result.replyToUser}`);
            await message.react(emoji);
        }
    }

    private getCommandByName(name: string): ICommand | null {
        this.logger.debug(`Matching command for command name '${name}'...`);
        const commandName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() + 'Command';
        let command = null;
        try {
            command = container.get(commandName) as ICommand;
        } catch (e) {
            this.logger.debug(
                `Could not find command for user input '${name}' and resolved symbol name '${commandName}'`
            );
        }
        return command;
    }
}
