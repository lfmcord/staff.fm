import { Logger } from 'tslog';
import { inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { ICommand } from '@src/feature/commands/models/command.interface';
import container from '../../inversify.config';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { IHandler } from '@src/handlers/models/handler.interface';
import { TextHelper } from '@src/helpers/text.helper';
import { MemberService } from '@src/infrastructure/services/member.service';
import { CachingRepository } from '@src/infrastructure/repositories/caching.repository';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';

@injectable()
export class GuildMessageHandler implements IHandler {
    eventType: string = 'guildMessageCreate';

    private logger: Logger<GuildMessageHandler>;
    private readonly cachingRepository: CachingRepository;
    private memberService: MemberService;
    private readonly prefix: string;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<GuildMessageHandler>,
        @inject(TYPES.PREFIX) prefix: string,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.CachingRepository) cachingRepository: CachingRepository
    ) {
        this.cachingRepository = cachingRepository;
        this.memberService = memberService;
        this.prefix = prefix;
        this.logger = logger;
    }

    public async handle(message: Message) {
        const isCommand = message.content.startsWith(this.prefix);
        const isBot = message.author.bot;

        if (isBot) return;
        void this.cachingRepository.cacheMessage(message);
        if (isCommand) await this.handleCommand(message);
    }

    private async handleCommand(message: Message) {
        // Resolve command
        const command = await this.resolveCommand(message);
        if (!command) return;

        // Check permissions
        const member = await this.memberService.getGuildMemberFromUserId(message.author.id);
        if ((await this.memberService.getMemberPermissionLevel(member!)) < command.permissionLevel) {
            this.logger.info(
                `User ${TextHelper.userLog(message.author)} is trying to run a command that requires '${command.permissionLevel}' permissions, but has no privilege.`
            );
            await this.handleCommandError(message, `You do not have sufficient permissions to use this command.`);
            return;
        }

        // Run command
        const args = message.content!.split(' ').splice(1);
        const start = new Date().getTime();
        let result: CommandResult;
        try {
            this.logger.info(`Validating arguments for command ${command.name}...`);
            await command.validateArgs(args);
            this.logger.info(`Running command ${command.name}...`);
            result = await command.run(message, args);
        } catch (error) {
            if (error instanceof ValidationError) {
                this.logger.info(`Command validation failed: ${error.error.message}`);
                await this.handleCommandError(
                    message,
                    error.messageToUser +
                        ` For more details, use ${inlineCode(this.prefix + 'help ' + command.name.toLowerCase())}.`
                );
                return;
            }
            this.logger.error(`Failed to run command '${command?.name}'`, error);
            await this.handleCommandError(message); // TODO: Log with correlation ID (bubble down from BotLogger?) and add ID here. https://tslog.js.org/#/?id=settings
            return;
        }
        const end = new Date().getTime();

        // Handle result
        await this.handleCommandResult(message, result, command.name, end - start);
    }

    private async handleCommandError(message: Message, messageToUser: string = `Oops, something went wrong!`) {
        await message.reply(TextHelper.failure + ' ' + messageToUser);
        await message.react(TextHelper.failure);
    }

    private async handleCommandResult(
        message: Message,
        result: CommandResult,
        commandName: string,
        executionTime: number
    ) {
        if (result.isSuccessful == null) {
            this.logger.info(`Command '${commandName}' finished silently.`);
            return;
        }
        let log = result.isSuccessful
            ? `Successfully finished command '${commandName}'.`
            : `Failed to finish command '${commandName}'${result.reason ? ` (Reason: '${result.reason}')` : ''}.`;
        log += ` Execution took ${executionTime}ms.`;
        this.logger.info(log);
        const emoji = result.isSuccessful ? TextHelper.success : TextHelper.failure;
        await message.react(emoji);

        let reply: Message;
        if (result.replyToUser) {
            reply = await message.reply(`${emoji} ${result.replyToUser}`);
        }

        if (result.shouldDelete) {
            setTimeout(async () => {
                await message.delete();
                if (reply) await reply.delete();
            }, 10000);
        }
    }

    private async resolveCommand(message: Message): Promise<ICommand | null> {
        const commandName = message.content.slice(
            this.prefix.length,
            message.content.indexOf(' ') == -1 ? undefined : message.content.indexOf(' ')
        );
        this.logger.debug(`Matching command for command name '${commandName}'...`);
        const commands: ICommand[] = container.getAll('Command');
        const command = commands.find(
            (c) => c.name == commandName.toLowerCase() || c.aliases.includes(commandName)
        ) as ICommand | null;

        if (!command) {
            this.logger.debug(`Could not find a command for name ${commandName}`);
            await this.handleCommandError(
                message,
                `I could not find a command called '${commandName.toLowerCase()}'. ` +
                    `Use \`${this.prefix}help\` to see a list of all commands.`
            );
            return null;
        }

        return command;
    }
}
