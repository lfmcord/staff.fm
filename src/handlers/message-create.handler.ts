import { Logger } from 'tslog';
import { GuildTextBasedChannel, inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { ICommand } from '@src/feature/commands/models/command.interface';
import container from '../inversify.config';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { IHandler } from '@src/handlers/models/handler.interface';
import { MemberService } from '@src/infrastructure/services/member.service';
import { CachingRepository } from '@src/infrastructure/repositories/caching.repository';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { StaffMailDmTrigger } from '@src/feature/triggers/staff-mail-dm.trigger';
import { Environment } from '@models/environment';
import { VerificationTrigger } from '@src/feature/triggers/verification.trigger';
import { CommandService } from '@src/infrastructure/services/command.service';
import { WhoknowsTrigger } from '@src/feature/triggers/whoknows.trigger';

@injectable()
export class MessageCreateHandler implements IHandler {
    eventType: string = 'messageCreate';

    private logger: Logger<MessageCreateHandler>;
    commandService: CommandService;
    verificationLastFmTrigger: VerificationTrigger;
    whoknowsTrigger: WhoknowsTrigger;
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
        @inject(TYPES.VerificationLastFmTrigger) verificationLastFmTrigger: VerificationTrigger,
        @inject(TYPES.WhoknowsTrigger) whoknowsTrigger: WhoknowsTrigger,
        @inject(TYPES.CommandService) commandService: CommandService
    ) {
        this.commandService = commandService;
        this.verificationLastFmTrigger = verificationLastFmTrigger;
        this.env = env;
        this.staffMailDmReply = staffMailDmReply;
        this.cachingRepository = cachingRepository;
        this.memberService = memberService;
        this.logger = logger;
        this.whoknowsTrigger = whoknowsTrigger;
    }

    public async handle(message: Message) {
        const isCommand = message.content.match(`^${this.env.PREFIX}[A-z]+.*`)?.length != null;
        const isBot = message.author.bot;
        const isDms = message.channel.isDMBased();
        const isVerification = message.channelId === this.env.VERIFICATION_CHANNEL_ID;
        const isWhoKnowsCommand = message.content.startsWith('!');

        if (isWhoKnowsCommand) await this.whoknowsTrigger.run(message);

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
        ) {
            // void this.cachingRepository.cacheMessage(message);
        }
    }

    private async handleCommand(message: Message) {
        // Resolve command
        const command = await this.resolveCommand(message);
        if (!command) return;

        // Check if running in correct place
        const isDms = message.channel.isDMBased();
        if (isDms && !command.isUsableInDms) {
            await this.commandService.handleCommandErrorForMessage(
                message,
                `This command is not usable in direct messages! You can only run it in the server.`
            );
            return;
        } else if (!isDms && !command.isUsableInServer) {
            await this.commandService.handleCommandErrorForMessage(
                message,
                `This command is not usable in the server! You can only run it by DMing me.`
            );
            return;
        }

        // Check permissions
        const member = await this.memberService.getGuildMemberFromUserId(message.author.id);
        if (!(await this.commandService.isPermittedToRun(member!, command))) {
            await this.commandService.handleCommandErrorForMessage(
                message,
                `You do not have sufficient permissions to use this command.`
            );
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
                await this.commandService.handleCommandErrorForMessage(
                    message,
                    error.messageToUser +
                        ` For more details, use ${inlineCode(this.env.PREFIX + 'help ' + command.name.toLowerCase())}.`
                );
                return;
            }
            this.logger.error(`Failed to run command '${command?.name}'`, error);
            await this.commandService.handleCommandErrorForMessage(message); // TODO: Log with correlation ID (bubble down from BotLogger?) and add ID here. https://tslog.js.org/#/?id=settings
            return;
        }
        const end = new Date().getTime();

        // Handle result
        await this.commandService.handleCommandResultForMessage(message, result, command.name, end - start);
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
            await this.commandService.handleCommandErrorForMessage(
                message,
                `I could not find a command called '${commandName}'. ` +
                    `Use \`${this.env.PREFIX}help\` to see a list of all commands.`
            );
            return null;
        }

        return command;
    }
}
