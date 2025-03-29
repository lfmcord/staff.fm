import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import LastFM from 'lastfm-typed';
import { Logger } from 'tslog';

@injectable()
export class LastfmCommand implements ICommand {
    name: string = 'lastfm';
    description: string = "Shows a user's current last.fm account.";
    usageHint: string = '<user mention/ID>';
    examples: string[] = ['356178941913858049', '@haiyn'];
    permissionLevel = CommandPermissionLevel.Backstager;
    aliases = ['lfm'];
    isUsableInDms = false;
    isUsableInServer = true;

    private lastFmClient: LastFM;
    private memberService: MemberService;
    private usersRepository: UsersRepository;
    private logger: Logger<LastfmCommand>;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<LastfmCommand>,
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
        const userId = TextHelper.getDiscordUserId(args[0])!;

        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (!indexedUser) {
            await message.reply({ embeds: [EmbedHelper.getUserNotIndexedEmbed(userId)] });
            return { isSuccessful: true };
        }

        const verifications = indexedUser.verifications.sort((a, b) => (a.verifiedOn > b.verifiedOn ? -1 : 1));
        const currentLastFmUsername = verifications[0]?.username;

        let lastFmUser;
        if (currentLastFmUsername) {
            try {
                lastFmUser = await this.lastFmClient.user.getInfo(currentLastFmUsername);
            } catch (e) {
                this.logger.warn(
                    `Could not find last.fm user for username ${currentLastFmUsername} for user ${TextHelper.userDisplay(await this.memberService.fetchUser(userId))} in lfm command.`
                );
            }
        }
        await message.reply({
            embeds: [EmbedHelper.getLastFmUserEmbed(currentLastFmUsername, lastFmUser).setTitle(`Last.fm Account`)],
        });

        return {
            isSuccessful: true,
        };
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(`No args provided for lastfm.`, `You must provide a Discord user or ID!`);
        }
        if (!TextHelper.getDiscordUserId(args[0])) {
            throw new ValidationError(`Invalid user ID provided.`, `You must provide a valid Discord user or ID!`);
        }
        return Promise.resolve();
    }
}
