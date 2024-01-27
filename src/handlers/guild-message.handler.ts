import { Logger } from 'tslog';
import { inlineCode, Message, User } from 'discord.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { ICommand } from '@src/feature/commands/models/command.interface';
import container from '@src/inversify.config';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { IHandler } from '@src/handlers/models/handler.interface';
import { TextHelper } from '@src/helpers/text.helper';
import { MemberService } from '@src/infrastructure/services/member.service';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';

@injectable()
export class GuildMessageHandler implements IHandler {
    private logger: Logger<GuildMessageHandler>;
    private readonly backstagerRoleIds: string[];
    private readonly helperRoleIds: string[];
    private readonly staffRoleIds: string[];
    private memberService: MemberService;
    private readonly prefix: string;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<GuildMessageHandler>,
        @inject(TYPES.PREFIX) prefix: string,
        @inject(TYPES.BACKSTAGER_ROLE_IDS) backstagerRoleIds: string[],
        @inject(TYPES.HELPER_ROLE_IDS) helperRoleIds: string[],
        @inject(TYPES.STAFF_ROLE_IDS) staffRoleIds: string[],
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.backstagerRoleIds = backstagerRoleIds;
        this.helperRoleIds = helperRoleIds;
        this.staffRoleIds = staffRoleIds;
        this.memberService = memberService;
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
        const command = await this.resolveCommand(message);
        if (!command) return;

        // Check permissions
        if (!(await this.checkIfUserIsPrivileged(command, message.author))) {
            this.logger.info(
                `User ${TextHelper.userLog(message.author)} is trying to run a command that requires '${command.permissionLevel}' permissions, but has no privilege.`
            );
            await this.handleCommandError(
                message,
                new Error(`You do not have sufficient permissions to use this command.`)
            );
            return;
        }

        // Validate command arguments
        const args = message.content!.split(' ').splice(1);
        try {
            await command.validateArgs(args);
        } catch (error) {
            this.logger.info(`Command validation failed: ${(error as Error).message}`);
            await this.handleCommandError(
                message,
                new Error(
                    (error as Error).message +
                        ` For more details, use ${inlineCode(this.prefix + command.name.toLowerCase())}.`
                )
            );
            return;
        }

        // Run command
        const start = new Date().getTime();
        let result: CommandResult;
        try {
            result = await command.run(message, args);
        } catch (error) {
            this.logger.error(`Failed to run command '${command?.name}'`, error);
            await this.handleCommandError(message, new Error(`Oops, something went wrong!`)); // TODO: Log with correlation ID (bubble down from BotLogger?) and add ID here. https://tslog.js.org/#/?id=settings
            return;
        }
        const end = new Date().getTime();

        // Handle result
        await this.handleCommandResult(message, result, command.name, end - start);
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
                new Error(
                    `I could not find a command called '${commandName.toLowerCase()}'. ` +
                        `Use \`${this.prefix}help\` to see a list of all commands.`
                )
            );
            return null;
        }

        return command;
    }

    private async checkIfUserIsPrivileged(command: ICommand, user: User): Promise<boolean> {
        if (command.permissionLevel === CommandPermissionLevel.User) return true;

        const member = await this.memberService.getGuildMemberFromUserId(user.id);
        const memberHighestRole = await this.memberService.getHighestRoleFromGuildMember(member);
        let roleIdsToCheck: string[] = [];
        switch (command.permissionLevel) {
            case CommandPermissionLevel.Backstager:
                roleIdsToCheck = this.backstagerRoleIds;
                break;
            case CommandPermissionLevel.Helper:
                roleIdsToCheck = this.helperRoleIds;
                break;
            case CommandPermissionLevel.Staff:
                roleIdsToCheck = this.staffRoleIds;
                break;
        }
        let isPrivileged = false;
        roleIdsToCheck.forEach((roleId) => {
            if (memberHighestRole.id === roleId || memberHighestRole.comparePositionTo(roleId) > 1) isPrivileged = true;
        });
        return isPrivileged;
    }
}
