import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
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
export class ScatterCommand implements ICommand {
    name: string = 'scatter';
    description: string = "Shows a scatter plot of a user's scrobbles.";
    permissionLevel = CommandPermissionLevel.Backstager;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .addUserOption((option) => option.setName('user').setDescription('The discord user to look up'))
        .addStringOption((option) =>
            option.setName('lastfm').setDescription('The last.fm username to look up')
        );

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

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        let lastfmUsername = interaction.options.getString('lastfm');

        if (!lastfmUsername) {
            // caller supplied user instead
            const indexedUser = await this.usersRepository.getUserByUserId(interaction.options.getUser('user')!.id);
            if (!indexedUser) {
                return {
                    isSuccessful: false,
                    replyToUser: { embeds: [EmbedHelper.getUserNotIndexedEmbed()] },
                };
            }
            const verifications = indexedUser.verifications.sort((a, b) => (a.verifiedOn > b.verifiedOn ? -1 : 1));
            lastfmUsername = verifications[0]?.username;
        }

        let lastFmUser;
        try {
            lastFmUser = await this.lastFmClient.user.getInfo(lastfmUsername);
        } catch (e) {
            this.logger.warn(`Could not find last.fm user for username ${lastfmUsername} in scatter command.`);
            return {
                isSuccessful: false,
                replyToUser: { content: `Could not find last.fm user for username ${lastfmUsername}.` },
            };
        }
        this.logger.info(`Found last.fm user ${lastFmUser.name} for username ${lastfmUsername}.`);

        return {
            isSuccessful: true,
            replyToUser: {
                content: `Here is a scatter plot of ${lastFmUser.name}'s scrobbles: https://scatterfm.markhansen.co.nz/graph.html#/user/${TextHelper.htmlEncode(lastfmUsername)}`,
            },
        };
    }

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.options.getUser('user') && !interaction.options.getString('lastfm')) {
            throw new ValidationError(
                `No args provided for lastfm.`,
                `You must provide a last.fm username or a discord user!`
            );
        }
        return Promise.resolve();
    }
}
