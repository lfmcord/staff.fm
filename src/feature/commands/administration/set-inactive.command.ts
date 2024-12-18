import { inject, injectable } from 'inversify';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TextHelper } from '@src/helpers/text.helper';
import moment = require('moment');
import { CachingRepository } from '@src/infrastructure/repositories/caching.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { Environment } from '@models/environment';

@injectable()
export class SetInactiveCommand implements ICommand {
    name: string = 'setinactive';
    description: string = 'Sets a user inactive if they are inactive.';
    usageHint: string = '[user mention/ID]';
    examples: string[] = ['@haiyn'];
    permissionLevel = CommandPermissionLevel.Helper;
    aliases = ['inactive'];
    isUsableInDms = false;
    isUsableInServer = false;

    private logger: Logger<SetInactiveCommand>;
    memberService: MemberService;
    env: Environment;
    cachingRepository: CachingRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<SetInactiveCommand>,
        @inject(TYPES.CachingRepository) cachingRepository: CachingRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.memberService = memberService;
        this.env = env;
        this.cachingRepository = cachingRepository;
        this.logger = logger;
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(`No args provided for setinactive.`, `You must provide a Discord user!`);
        }
        return Promise.resolve();
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0]);
        if (!userId) {
            return {
                isSuccessful: false,
                replyToUser: "I cannot recognize the argument you've provided as a Discord user.",
            };
        }

        const member = await this.memberService.getGuildMemberFromUserId(userId);
        if (!member) {
            return {
                isSuccessful: false,
                replyToUser: `(●´⌓\`●) This user doesn't seem to be in the server anymore so I can't set them inactive.`,
            };
        }

        if (member.roles.cache.has(this.env.INACTIVE_ROLE_ID)) {
            return {
                isSuccessful: false,
                replyToUser: 'This user is already inactive!',
            };
        }

        const lastMessageDate = await this.cachingRepository.getCachedLastUserMessage(userId);

        if (!lastMessageDate) {
            return {
                isSuccessful: false,
                replyToUser:
                    "This user hasn't sent a message yet so I cannot determine if they are inactive or just new. Please check manually!",
            };
        }

        const isInactive = moment().isSameOrAfter(moment(lastMessageDate).add(1, 'M'));
        if (!isInactive) {
            return {
                isSuccessful: false,
                replyToUser: `This user is not inactive! (last message: <t:${moment(lastMessageDate).unix()}:D>`,
            };
        }

        await message.react(TextHelper.loading);
        for (const roleId of this.env.SCROBBLE_MILESTONE_ROLE_IDS) {
            if (member.roles.cache.has(roleId)) await member.roles.remove(roleId);
        }
        await member.roles.add(this.env.INACTIVE_ROLE_ID);
        await message.reactions.removeAll();

        return {
            isSuccessful: true,
            replyToUser: `I've set <@!${member.id}> inactive.`,
        };
    }
}
