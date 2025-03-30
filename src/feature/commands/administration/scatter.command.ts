import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import LastFM from 'lastfm-typed';
import { Logger } from 'tslog';

@injectable()
export class ScatterCommand implements ICommand {
    name: string = 'scatter';
    description: string = "Shows a scatter plot of a user's scrobbles.";
    usageHint: string = '<last.fm username>';
    examples: string[] = ['@haiyn'];
    permissionLevel = CommandPermissionLevel.Backstager;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;

    private lastFmClient: LastFM;
    private memberService: MemberService;
    private usersRepository: UsersRepository;
    private logger: Logger<ScatterCommand>;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<ScatterCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM
    ) {
        this.logger = logger;
        this.lastFmClient = lastFmClient;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const lastfmUsername = args[0];

        let lastFmUser;
        try {
            lastFmUser = await this.lastFmClient.user.getInfo(lastfmUsername);
        } catch (e) {
            this.logger.warn(`Could not find last.fm user for username ${lastfmUsername} in scatter command.`);
            return {
                isSuccessful: false,
                replyToUser: `Could not find last.fm user for username ${lastfmUsername}.`,
            };
        }
        this.logger.info(`Found last.fm user ${lastFmUser.name} for username ${lastfmUsername}.`);

        return {
            isSuccessful: true,
            replyToUser: `Here is a scatter plot of ${lastFmUser.name}'s scrobbles: https://scatterfm.markhansen.co.nz/graph.html#/user/${args[0]}`,
        };
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(`No args provided for lastfm.`, `You must provide a last.fm username!`);
        }
        return Promise.resolve();
    }
}
