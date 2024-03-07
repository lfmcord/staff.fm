import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { EmbedBuilder, inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TYPES } from '@src/types';
import { IUserModel, UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { TextHelper } from '@src/helpers/text.helper';
import { MemberService } from '@src/infrastructure/services/member.service';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { LogLevel } from '@src/helpers/models/LogLevel';
import * as moment from 'moment/moment';
import LastFM from 'lastfm-typed';
import { Logger } from 'tslog';

@injectable()
export class WhoisCommand implements ICommand {
    name: string = 'whois';
    description: string = 'Shows information about a discord or lastfm user.';
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

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<WhoisCommand>,
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
        let indexedUsers: IUserModel[] = [];
        if (TextHelper.getDiscordUserId(args[0])) {
            const foundUser = await this.usersRepository.getUserByUserId(TextHelper.getDiscordUserId(args[0])!);
            if (!foundUser)
                return {
                    isSuccessful: false,
                    replyToUser: `User is not indexed yet.`,
                };
            indexedUsers.push(foundUser);
        } else {
            indexedUsers = (await this.usersRepository.getUsersByLastFmUsername(args[0])) as IUserModel[];
            if (indexedUsers.length === 0) {
                return {
                    isSuccessful: false,
                    replyToUser: `I could not find a user with this Last.fm username. Perhaps they are not indexed yet?`,
                };
            }
        }

        for (const u of indexedUsers) {
            const embeds = await this.getEmbedsByDiscordUserId(u.userId);
            message.channel.send({ embeds: embeds });
        }

        return {
            isSuccessful: true,
        };
    }

    async getEmbedsByDiscordUserId(userId: string): Promise<EmbedBuilder[]> {
        const embeds: EmbedBuilder[] = [];
        let guildMember;
        try {
            guildMember = await this.memberService.getGuildMemberFromUserId(userId);
        } catch (e) {
            this.logger.warn(`User with user ID ${userId} is not in the server.`);
            return [
                new EmbedBuilder()
                    .setTitle(`Unknown Discord User`)
                    .setColor(EmbedHelper.orange)
                    .setDescription(
                        `User with user ID ${userId} used the given username but is no longer in the server.`
                    ),
            ];
        }
        if (!guildMember)
            return [
                new EmbedBuilder()
                    .setTitle(`Unknown Discord User`)
                    .setColor(EmbedHelper.orange)
                    .setDescription(
                        `User with user ID ${userId} used the given username but is no longer in the server.`
                    ),
            ];
        const indexedUser = await this.usersRepository.getUserByUserId(userId);

        // Discord user
        embeds.push(
            EmbedHelper.getLogEmbed(guildMember.user, guildMember.user, LogLevel.Info)
                .setTitle(`Discord Account`)
                .setFields([
                    {
                        name: 'Joined',
                        value: `<t:${moment(guildMember.joinedAt).unix()}:f> (<t:${moment(guildMember.joinedAt).unix()}:R>)`,
                    },
                    {
                        name: 'Account created',
                        value: `<t:${moment(guildMember.user.createdAt).unix()}:f> (<t:${moment(guildMember.user.createdAt).unix()}:R>)`,
                    },
                ])
                .setFooter({ text: `User ID: ${guildMember.id}` })
        );

        if (indexedUser) {
            const verifications = indexedUser.verifications.sort((a, b) => (a.verifiedOn > b.verifiedOn ? 1 : -1));
            const currentLastFmUsername = verifications[0].username;

            // Last.fm Account
            if (!currentLastFmUsername)
                embeds.push(
                    new EmbedBuilder()
                        .setTitle(`Last.fm Account`)
                        .setColor(EmbedHelper.blue)
                        .setDescription(`No Last.fm account currently in use.`)
                );
            let lastFmUser;
            try {
                lastFmUser = await this.lastFmClient.user.getInfo(currentLastFmUsername);
            } catch (e) {
                this.logger.warn(
                    `Could not find last.fm user for username ${currentLastFmUsername} for user ${TextHelper.userDisplay(guildMember.user)} in whois command.`
                );
            }

            if (lastFmUser) embeds.push(EmbedHelper.getLastFmUserEmbed(lastFmUser).setTitle(`Last.fm Account`));
            else
                embeds.push(
                    new EmbedBuilder()
                        .setTitle(`Last.fm Account`)
                        .setColor(EmbedHelper.orange)
                        .setDescription(
                            `⚠️ Could not find Last.fm user for username ${inlineCode(currentLastFmUsername)}.\nPerhaps they've changed their username on the website?`
                        )
                );

            // Past verifications
            let description = '';
            verifications.forEach((v) => {
                description += `- ${inlineCode(v.username ?? 'NO LAST.FM ACCOUNT')} (${`<t:${moment(v.verifiedOn).unix()}:D>`} by <@!${v.verifiedById}>)\n`;
            });
            embeds.push(
                new EmbedBuilder().setTitle(`Past Verifications`).setColor(EmbedHelper.blue).setDescription(description)
            );

            // Crowns
            embeds.push(
                new EmbedBuilder().setTitle(`Crowns Game`).setColor(EmbedHelper.blue).setFields(
                    {
                        name: 'Status',
                        value: 'Not banned',
                        inline: true,
                    },
                    {
                        name: 'Imported?',
                        value: 'No',
                        inline: true,
                    }
                )
            );
        } else {
            embeds.push(
                new EmbedBuilder()
                    .setTitle(`User not indexed`)
                    .setColor(EmbedHelper.orange)
                    .setDescription(
                        `This user is not yet indexed (hasn't been manually imported or verified yet), so I don't have any more info to show you.`
                    )
            );
        }
        return embeds;
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
