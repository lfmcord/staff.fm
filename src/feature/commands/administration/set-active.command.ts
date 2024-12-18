import { inject, injectable } from 'inversify';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TextHelper } from '@src/helpers/text.helper';
import { CachingRepository } from '@src/infrastructure/repositories/caching.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { Environment } from '@models/environment';
import LastFM from 'lastfm-typed';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LastfmError } from '@models/lastfm-error.model';

@injectable()
export class SetActiveCommand implements ICommand {
    name: string = 'setactive';
    description: string = 'Sets a user active again.';
    usageHint: string = '[user mention/ID] [last.fm username/link]';
    examples: string[] = ['@haiyn haiyn'];
    permissionLevel = CommandPermissionLevel.Helper;
    aliases = ['active'];
    isUsableInDms = false;
    isUsableInServer = false;

    private logger: Logger<SetActiveCommand>;
    usersRepository: UsersRepository;
    lastFmClient: LastFM;
    memberService: MemberService;
    env: Environment;
    cachingRepository: CachingRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<SetActiveCommand>,
        @inject(TYPES.CachingRepository) cachingRepository: CachingRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository
    ) {
        this.usersRepository = usersRepository;
        this.lastFmClient = lastFmClient;
        this.memberService = memberService;
        this.env = env;
        this.cachingRepository = cachingRepository;
        this.logger = logger;
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(`No args provided for setactive.`, `You must provide a Discord user!`);
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

        if (!member.roles.cache.has(this.env.INACTIVE_ROLE_ID)) {
            return {
                isSuccessful: false,
                replyToUser: `This user is not inactive!`,
            };
        }

        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (!indexedUser) {
            return {
                isSuccessful: false,
                replyToUser: `This user is not indexed yet, so I can't set them active. If you know their last.fm account, please verify them with \`${this.env.PREFIX}verify ${userId} [last.fm username/link]\`.`,
            };
        }
        const lastFmUsername = indexedUser.verifications.sort((a, b) => (a.verifiedOn > b.verifiedOn ? -1 : 1))[0]
            .username;
        let lastfmUser;
        try {
            lastfmUser = await this.lastFmClient.user.getInfo({ username: lastFmUsername });
        } catch (e) {
            if ((e as LastfmError).code == '6') {
                this.logger.info(`Last.fm user with name '${lastFmUsername}' could not be found.`);
            } else {
                this.logger.error('Last.fm returned an error that is not code 6 (not found)', e);
                throw Error(`Last.fm API returned an error.`);
            }
        }
        if (!lastfmUser) {
            return {
                isSuccessful: false,
                replyToUser: `The username '${lastFmUsername}' doesn't seem to be an existing Last.fm user. Perhaps they changed their name on the website?`,
                shouldDelete: true,
            };
        }

        let reply = `I've set <@!${member.id}> active again.`;
        if (lastfmUser.playcount == 0) {
            reply += `\n-# Last.fm gave me a playcount of 0. Please check that's correct!`;
        }

        await message.react(TextHelper.loading);
        await this.memberService.assignScrobbleRoles(member, lastfmUser.playcount);
        await member.roles.remove(this.env.INACTIVE_ROLE_ID);
        await message.reactions.removeAll();

        return {
            isSuccessful: true,
            replyToUser: reply,
        };
    }
}
