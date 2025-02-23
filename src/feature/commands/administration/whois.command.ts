import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Client, EmbedBuilder, Message, MessageCreateOptions } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TYPES } from '@src/types';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { TextHelper } from '@src/helpers/text.helper';
import { MemberService } from '@src/infrastructure/services/member.service';
import { EmbedHelper } from '@src/helpers/embed.helper';
import LastFM from 'lastfm-typed';
import { Logger } from 'tslog';

@injectable()
export class WhoisCommand implements ICommand {
    name: string = 'whois';
    description: string = 'Shows information about a Discord or Lastfm user.';
    usageHint: string = '<user mention/ID or last.fm username>';
    examples: string[] = ['356178941913858049', 'haiyn'];
    permissionLevel = CommandPermissionLevel.Helper;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;
    logger: Logger<WhoisCommand>;

    private lastFmClient: LastFM;
    private memberService: MemberService;
    private usersRepository: UsersRepository;
    private client: Client;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<WhoisCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.Client) client: Client
    ) {
        this.logger = logger;
        this.lastFmClient = lastFmClient;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.client = client;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0]);
        if (userId) {
            message.channel.send(await this.getMessageForDiscordUser(userId));
        } else {
            const messagesToSend = await this.getMessagesForLastFmUsername(args[0]);
            for (const messageToSend of messagesToSend) {
                message.channel.send(messageToSend);
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

    async getMessageForDiscordUser(userId: string): Promise<MessageCreateOptions> {
        const embeds: EmbedBuilder[] = [];
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
            embeds.push(EmbedHelper.getUserNotIndexedEmbed(userId));
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

        // Past verifications
        embeds.push(EmbedHelper.getVerificationHistoryEmbed(verifications));

        // Crowns
        embeds.push(EmbedHelper.getCrownsEmbed(indexedUser));

        return { embeds: embeds };
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(
                `No args provided for whois.`,
                `You must provide a Discord user or last.fm username!`
            );
        }
        return Promise.resolve();
    }
}
