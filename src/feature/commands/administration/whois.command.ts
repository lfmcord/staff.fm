import { Environment } from '@models/environment';
import { ErrorMessages } from '@models/error-messages';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { ComponentHelper } from '@src/helpers/component.helper';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageCreateOptions,
    SlashCommandBuilder,
    User,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import LastFM from 'lastfm-typed';
import { Logger } from 'tslog';

@injectable()
export class WhoisCommand implements ICommand {
    name: string = 'whois';
    description: string = 'Shows information about a Discord or Lastfm user.';
    permissionLevel = CommandPermissionLevel.Helper;
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
    private logger: Logger<WhoisCommand>;
    private env: Environment;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<WhoisCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.env = env;
        this.logger = logger;
        this.lastFmClient = lastFmClient;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const userId = interaction.options.getUser('user')!.id;
        if (!interaction.channel!.isSendable()) {
            return {
                isSuccessful: false,
                replyToUser: { content: ErrorMessages.ChannelNotSendable },
            };
        }
        if (userId) {
            interaction.channel.send(await this.getMessageForDiscordUser(userId, interaction.user!));
        } else {
            const messagesToSend = await this.getMessagesForLastFmUsername(
                interaction.options.getString('lastfm')!
            );
            for (const messageToSend of messagesToSend) {
                interaction.channel.send(messageToSend);
            }
        }

        return {
            isSuccessful: true,
        };
    }

    async getMessagesForLastFmUsername(lastfmUsername: string): Promise<MessageCreateOptions[]> {
        const messages: MessageCreateOptions[] = [];
        const usersWithLastfmName = await this.usersRepository.getUsersByLastFmUsername(lastfmUsername);

        let lastFmUser;
        if (lastfmUsername) {
            try {
                lastFmUser = await this.lastFmClient.user.getInfo(lastfmUsername);
            } catch (e) {
                this.logger.warn(`Could not find last.fm user for username ${lastfmUsername} in whois command.`);
            }
        }

        this.logger.info(
            `Found ${usersWithLastfmName.length} indexed user with last.fm username ${lastfmUsername} to display.`
        );
        const embeds: EmbedBuilder[] = [];
        embeds.push(EmbedHelper.getLastFmUserEmbed(lastfmUsername, lastFmUser).setTitle(`Last.fm Account`));
        if (usersWithLastfmName.length == 0) embeds.push(EmbedHelper.getUserNotIndexedEmbed());
        messages.push({ embeds: embeds });

        let userCount = 1;
        for (const indexedUser of usersWithLastfmName) {
            const embeds: EmbedBuilder[] = [];
            const guildMember = await this.memberService.getGuildMemberFromUserId(indexedUser.userId);
            if (!guildMember) {
                const user = await this.memberService.fetchUser(indexedUser.userId);
                embeds.push(EmbedHelper.getDiscordUserEmbed(indexedUser.userId, user ?? undefined));
            } else {
                embeds.push(EmbedHelper.getDiscordMemberEmbed(indexedUser.userId, guildMember ?? undefined));
            }
            embeds.push(EmbedHelper.getVerificationHistoryEmbed(indexedUser.verifications));
            embeds.push(EmbedHelper.getCrownsEmbed(indexedUser));
            messages.push({ content: `### User ${userCount} using this Last.fm username:`, embeds: embeds });
            userCount++;
        }

        return messages;
    }

    async getMessageForDiscordUser(userId: string, executingUser: User): Promise<MessageCreateOptions> {
        const embeds: EmbedBuilder[] = [];
        const components: ButtonBuilder[] = [];
        // Discord user
        const guildMember = await this.memberService.getGuildMemberFromUserId(userId);
        if (!guildMember) {
            const user = await this.memberService.fetchUser(userId);
            embeds.push(EmbedHelper.getDiscordUserEmbed(userId, user ?? undefined));
        } else {
            embeds.push(EmbedHelper.getDiscordMemberEmbed(userId, guildMember ?? undefined));
        }

        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (!indexedUser) {
            embeds.push(EmbedHelper.getUserNotIndexedEmbed());
            return { embeds: embeds };
        }

        // Last.fm Account
        const verifications = indexedUser.verifications.sort((a, b) => (a.verifiedOn > b.verifiedOn ? -1 : 1));
        const currentLastFmUsername = verifications[0]?.username;

        let lastFmUser;
        if (currentLastFmUsername) {
            try {
                lastFmUser = await this.lastFmClient.user.getInfo(currentLastFmUsername);
            } catch (e) {
                this.logger.warn(
                    `Could not find last.fm user for username ${currentLastFmUsername} for user ${TextHelper.userDisplay(guildMember?.user)} in whois command.`
                );
            }
        }
        embeds.push(EmbedHelper.getLastFmUserEmbed(currentLastFmUsername, lastFmUser).setTitle(`Last.fm Account`));
        if (lastFmUser) {
            components.push(ComponentHelper.updateScrobblesButton(userId));
        }

        // Past verifications
        embeds.push(EmbedHelper.getVerificationHistoryEmbed(verifications));

        // Strikes
        const executingMember = await this.memberService.getGuildMemberFromUserId(executingUser.id);
        const executingMemberPermissionLevel = await this.memberService.getMemberPermissionLevel(executingMember!);
        if (executingMemberPermissionLevel >= CommandPermissionLevel.Moderator) {
            const strikes = await this.usersRepository.getAllStrikesOfUser(userId);
            embeds.push(EmbedHelper.getStrikesEmbed(strikes));
        }

        // Crowns
        embeds.push(EmbedHelper.getCrownsEmbed(indexedUser));

        return {
            embeds: embeds,
            components:
                components.length > 0 ? [new ActionRowBuilder<ButtonBuilder>().addComponents(components)] : undefined,
        };
    }

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.options.getUser('user') && !interaction.options.getString('lastfm')) {
            throw new ValidationError(
                `No args provided for whois.`,
                `You must provide a last.fm username or a discord user!`
            );
        }
        return Promise.resolve();
    }
}
