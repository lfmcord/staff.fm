import { Logger } from 'tslog';
import { GuildTextBasedChannel, inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { ICommand } from '@src/feature/commands/models/command.interface';
import container from '../inversify.config';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { IHandler } from '@src/handlers/models/handler.interface';
import { TextHelper } from '@src/helpers/text.helper';
import { MemberService } from '@src/infrastructure/services/member.service';
import { CachingRepository } from '@src/infrastructure/repositories/caching.repository';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { StaffMailDmTrigger } from '@src/feature/triggers/staff-mail-dm.trigger';
import { Environment } from '@models/environment';
import { VerificationLastFmTrigger } from '@src/feature/triggers/verification-lastfm.trigger';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';

@injectable()
export class MessageCreateHandler implements IHandler {
    eventType: string = 'messageCreate';

    private logger: Logger<MessageCreateHandler>;
    verificationLastFmTrigger: VerificationLastFmTrigger;
    env: Environment;
    private readonly staffMailDmReply: StaffMailDmTrigger;
    private readonly cachingRepository: CachingRepository;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<MessageCreateHandler>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.CachingRepository) cachingRepository: CachingRepository,
        @inject(TYPES.StaffMailDmTrigger) staffMailDmReply: StaffMailDmTrigger,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.VerificationLastFmTrigger) verificationLastFmTrigger: VerificationLastFmTrigger
    ) {
        this.verificationLastFmTrigger = verificationLastFmTrigger;
        this.env = env;
        this.staffMailDmReply = staffMailDmReply;
        this.cachingRepository = cachingRepository;
        this.memberService = memberService;
        this.logger = logger;
    }

    public async handle(message: Message) {
        const isCommand = message.content.startsWith(this.env.PREFIX);
        const isBot = message.author.bot;
        const isDms = message.channel.isDMBased();
        const isVerification = message.channelId === this.env.VERIFICATION_CHANNEL_ID;

        if (isBot) return;
        if (isCommand) await this.handleCommand(message);
        if (!isCommand && isDms) {
            await this.staffMailDmReply.run(message);
        }
        if (isVerification) await this.verificationLastFmTrigger.run(message);

        // cache message if needed
        if (
            !isDms &&
            !(
                this.env.DELETED_MESSAGE_LOG_EXCLUDED_CHANNEL_IDS.includes(message.channelId) ||
                this.env.DELETED_MESSAGE_LOG_EXCLUDED_CHANNEL_IDS.includes(
                    (message.channel as GuildTextBasedChannel)?.parentId ?? message.channelId
                )
            )
        )
            void this.cachingRepository.cacheMessage(message);
    }

    private async handleCommand(message: Message) {
        // Resolve command
        const command = await this.resolveCommand(message);
        if (!command) return;

        // Check if running in correct place
        const isDms = message.channel.isDMBased();
        if (isDms && !command.isUsableInDms) {
            await this.handleCommandError(
                message,
                `This command is not usable in direct messages! You can only run it in the server.`
            );
            return;
        } else if (!isDms && !command.isUsableInServer) {
            await this.handleCommandError(
                message,
                `This command is not usable in the server! You can only run it by DMing me.`
            );
            return;
        }

        // Check permissions
        const member = await this.memberService.getGuildMemberFromUserId(message.author.id);
        const permissionLevel = await this.memberService.getMemberPermissionLevel(member!);
        if (
            permissionLevel === CommandPermissionLevel.User /* TODO: Remove this for go-live */ ||
            permissionLevel < command.permissionLevel
        ) {
            this.logger.info(
                `User ${TextHelper.userLog(message.author)} is trying to run a command that requires permission level '${command.permissionLevel}', but has permission level '${permissionLevel}'.`
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
            this.logger.trace(args);
            result = await command.run(message, args);
        } catch (error) {
            if (error instanceof ValidationError) {
                this.logger.info(`Command validation failed: ${error.internalMessage}`);
                await this.handleCommandError(
                    message,
                    error.messageToUser +
                        ` For more details, use ${inlineCode(this.env.PREFIX + 'help ' + command.name.toLowerCase())}.`
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
        await message.reply({ content: messageToUser, allowedMentions: { repliedUser: false } });
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
            reply = await message.channel.send(`${result.replyToUser}`);
        }

        if (result.shouldDelete) {
            setTimeout(async () => {
                await message.delete();
                if (reply) await reply.delete();
            }, 10000);
        }
    }

    private async resolveCommand(message: Message): Promise<ICommand | null> {
        const commandName = message.content
            .slice(
                this.env.PREFIX.length,
                message.content.indexOf(' ') == -1 ? undefined : message.content.indexOf(' ')
            )
            .toLowerCase();
        this.logger.debug(`Matching command for command name '${commandName}'...`);
        const commands: ICommand[] = container.getAll('Command');
        const command = commands.find(
            (c) => c.name == commandName || c.aliases.includes(commandName)
        ) as ICommand | null;

        if (!command) {
            this.logger.debug(`Could not find a command for name ${commandName}`);
            await this.handleCommandError(
                message,
                `I could not find a command called '${commandName}'. ` +
                    `Use \`${this.env.PREFIX}help\` to see a list of all commands.`
            );
            return null;
        }

        return command;
    }
}
