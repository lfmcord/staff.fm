import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { TextHelper } from '@src/helpers/text.helper';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { Message, PartialMessage } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';

@injectable()
export class StrictSelfMuteCommand implements ICommand {
    name: string = 'strictselfmute';
    description: string = 'Sets your selfmute mode to "strict". You can no longer end your selfmute early.';
    usageHint: string = '';
    examples: string[] = [];
    permissionLevel = CommandPermissionLevel.User;
    aliases = ['strictsm'];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<StrictSelfMuteCommand>;
    private memberService: MemberService;
    private userRepository: UsersRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StrictSelfMuteCommand>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.UsersRepository) userRepository: UsersRepository
    ) {
        this.userRepository = userRepository;
        this.logger = logger;
        this.memberService = memberService;
    }

    async run(message: Message | PartialMessage, args: string[]): Promise<CommandResult> {
        this.logger.info(`Setting strict self mute for user ${TextHelper.userLog(message.author!)}...`);
        const member = await this.memberService.getGuildMemberFromUserId(message.author!.id);
        if (!member) throw Error(`Cannot find user with user ID ${message.author!.id}. Has the user left the guild?`);

        const result = await this.userRepository.setStrictSelfmute(member.id);
        if(!result) {
            return {
                isSuccessful: false,
                replyToUser: 'Failed to set strict selfmute. Please try again later.'
            }
        }

        return {
            isSuccessful: true,
            replyToUser: 'Your selfmute mode has been set to "strict". You can no longer end your selfmute early. If you want to disable this mode, please contact staff.'
        };
    }

    async validateArgs(args: string[]): Promise<void> {
        return;
    }
}
