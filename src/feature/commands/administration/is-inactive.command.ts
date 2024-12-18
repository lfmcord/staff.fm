/** TODO: Implement an automatic inactivity command */
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

@injectable()
export class IsInactiveCommand implements ICommand {
    name: string = 'isinactive';
    description: string = 'Shows if the provided user is inactive.';
    usageHint: string = '[user mention/ID]';
    examples: string[] = ['@haiyn'];
    permissionLevel = CommandPermissionLevel.Helper;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = false;

    private logger: Logger<IsInactiveCommand>;
    cachingRepository: CachingRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<IsInactiveCommand>,
        @inject(TYPES.CachingRepository) cachingRepository: CachingRepository
    ) {
        this.cachingRepository = cachingRepository;
        this.logger = logger;
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(`No args provided for isinactive.`, `You must provide a Discord user!`);
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
        const lastMessageDate = await this.cachingRepository.getCachedLastUserMessage(userId);

        if (!lastMessageDate) {
            return {
                isSuccessful: false,
                replyToUser:
                    "This user hasn't sent a message yet so I cannot determine if they are inactive or just new. Please check manually!",
            };
        }

        const isInactive = moment().isSameOrAfter(moment(lastMessageDate).add(1, 'M'));
        let reply = isInactive ? `😴` : `🥳`;
        reply += ` This user is **${isInactive ? '' : 'not '}inactive** (last message: <t:${moment(lastMessageDate).unix()}:D>.`;

        return {
            isSuccessful: true,
            replyToUser: reply,
        };
    }
}
