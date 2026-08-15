import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { inject, injectable } from 'inversify';
import LastFM from 'lastfm-typed';
import { Logger } from 'tslog';

@injectable()
export class LastfmCommand implements ICommand {
    name: string = 'lastfm';
    description: string = "Shows a user's current last.fm account.";
    permissionLevel = CommandPermissionLevel.Backstager;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .addUserOption((option) => option.setName('user').setDescription('The user to look up').setRequired(true));

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

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const userId = interaction.options.getUser('user')!.id;

        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (!indexedUser) {
            return { isSuccessful: true, replyToUser: { embeds: [EmbedHelper.getUserNotIndexedEmbed()] } };
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

        return {
            isSuccessful: true,
            replyToUser: {
                embeds: [EmbedHelper.getLastFmUserEmbed(currentLastFmUsername, lastFmUser).setTitle(`Last.fm Account`)],
            },
        };
    }
}
