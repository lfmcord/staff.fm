import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class InformCommand implements ICommand {
    name: string = 'inform';
    description: string = 'Sends someone a neutral information message from staff.';
    usageHint: string = '<user id/mention> <text>';
    examples: string[] = ['356178941913858049 this is some information'];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<InformCommand>;
    private loggingService: LoggingService;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<InformCommand>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.loggingService = loggingService;
        this.memberService = memberService;
        this.logger = logger;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0])!;
        const member = await this.memberService.getGuildMemberFromUserId(userId);
        if (!member) {
            return {
                isSuccessful: false,
                replyToUser: `I cannot inform this user because they are not in the server.`,
            };
        }
        this.logger.info(`Trying to inform user ${TextHelper.userLog(member.user)}...`);

        const content = args.slice(1).join(' ');
        try {
            await member.send({ embeds: [EmbedHelper.getInformEmbed(content)] });
        } catch (e) {
            this.logger.warn(`Could not send message to user ${userId}`, e);
            return {
                isSuccessful: false,
                replyToUser: `I cannot inform this user because their DMs are closed or they have me blocked.`,
            };
        }

        this.logger.info(`Sent information message to user ${TextHelper.userLog(member.user)}.`);
        await this.loggingService.logInform(member.user, message.author, content);

        return {
            isSuccessful: true,
            replyToUser: `I have sent the information message to ${TextHelper.userDisplay(member.user)}.`,
        };
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(
                `No args provided for strike.`,
                `You must provide a user to inform, together with the text to send them!`
            );
        }
        if (args.length === 1) {
            throw new ValidationError(`No reason provided for inform.`, `You must provide a text for the inform!`);
        }
        const textLength = args.slice(1).join(' ').length;
        if (textLength > 4000) {
            throw new ValidationError(
                `Text too long.`,
                `The text for the inform must be less than 4000 characters (currently: ${textLength}).`
            );
        }
        return Promise.resolve();
    }
}
