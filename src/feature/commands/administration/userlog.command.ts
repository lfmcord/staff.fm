import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TextHelper } from '@src/helpers/text.helper';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { inject, injectable } from 'inversify';

@injectable()
export class UserlogCommand implements ICommand {
    name: string = 'userlog';
    description: string = 'Logs someones User mention/ID in a searchable way.';
    usageHint: string = '<user mention/ID>';
    examples: string[] = ['@haiyn'];
    permissionLevel = CommandPermissionLevel.Backstager;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;
    private memberService: MemberService;

    constructor(@inject(TYPES.MemberService) memberService: MemberService) {
        this.memberService = memberService;
    }

    async run(message: Message<true>, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0]);
        if (!userId) {
            return {
                isSuccessful: false,
                replyToUser: `This is not a valid Discord user mention or ID.`,
            };
        }
        const user = await this.memberService.fetchUser(userId);
        if (!userId) {
            return {
                isSuccessful: false,
                replyToUser: `This is not a valid Discord user mention or ID.`,
            };
        }

        message.channel.send(TextHelper.userDisplay(user));

        return {};
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length < 1) {
            throw new ValidationError(`No args provided for userlog.`, `You must provide a last.fm username!`);
        }
        return Promise.resolve();
    }
}
