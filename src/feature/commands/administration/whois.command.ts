import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Client, EmbedBuilder, inlineCode, Message } from 'discord.js';
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
        let indexedUsers: IUserModel[] = [];
        const userId = TextHelper.getDiscordUserId(args[0]);
        if (userId) {
            // arg is a user ID
            const foundUser = await this.usersRepository.getUserByUserId(userId);
            if (!foundUser) {
                this.logger.info(`Whois command for user ID ${userId} cannot run because user is not in DB.`);
                return {
                    isSuccessful: false,
                    replyToUser: `I have no information on this user. If you know their last.fm username, please verify them manually with \`>>verify ${userId} [last.fm username]\``,
                };
            }
            indexedUsers.push(foundUser);
        } else {
            // arg is a last.fm username
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
        // Discord user
        const guildMember = await this.memberService.getGuildMemberFromUserId(userId);
        if (!guildMember) {
            const user = await this.memberService.fetchUser(userId);
            if (!user)
                embeds.push(
                    new EmbedBuilder()
                        .setTitle(`Unknown Discord User`)
                        .setColor(EmbedHelper.orange)
                        .setDescription(`User with user ID ${userId} is not in the server.`)
                );
            else
                embeds.push(
                    EmbedHelper.getLogEmbed(user, user, LogLevel.Warning)
                        .setTitle(`Discord Account`)
                        .setDescription(`:warning: Not in this server.`)
                        .setFields([
                            {
                                name: 'Account created',
                                value: `<t:${moment(user.createdAt).unix()}:f> (<t:${moment(user.createdAt).unix()}:R>)`,
                            },
                        ])
                        .setFooter({ text: `User ID: ${user.id}` })
                );
        } else {
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
        }
        const indexedUser = await this.usersRepository.getUserByUserId(userId);

        if (indexedUser) {
            const verifications = indexedUser.verifications.sort((a, b) => (a.verifiedOn > b.verifiedOn ? 1 : -1));
            const currentLastFmUsername = verifications[0]?.username;

            // Last.fm Account
            if (!currentLastFmUsername)
                embeds.push(
                    new EmbedBuilder()
                        .setTitle(`Last.fm Account`)
                        .setColor(EmbedHelper.blue)
                        .setDescription(`No Last.fm account currently in use.`)
                );
            else {
                let lastFmUser;
                try {
                    lastFmUser = await this.lastFmClient.user.getInfo(currentLastFmUsername);
                } catch (e) {
                    this.logger.warn(
                        `Could not find last.fm user for username ${currentLastFmUsername} for user ${TextHelper.userDisplay(guildMember?.user)} in whois command.`
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
            }

            // Past verifications
            let description = '';
            verifications.forEach((v) => {
                description += `- ${inlineCode(v.username ?? 'NO LAST.FM ACCOUNT')} (${`<t:${moment(v.verifiedOn).unix()}:D>`} by <@!${v.verifiedById}>)\n`;
            });
            embeds.push(
                new EmbedBuilder()
                    .setTitle(`Past Verifications`)
                    .setColor(EmbedHelper.blue)
                    .setDescription(description != '' ? description : 'No Verifications')
            );

            // Crowns
            embeds.push(
                new EmbedBuilder()
                    .setTitle(`Crowns Game`)
                    .setColor(EmbedHelper.blue)
                    .setFields(
                        {
                            name: 'Status',
                            value: indexedUser.crownsBan
                                ? `<:nocrown:816944519924809779> Banned on <t:${moment(indexedUser.crownsBan.bannedOn).unix()}:d>`
                                : `👑 No Crowns Ban`,
                            inline: true,
                        },
                        {
                            name: 'Imported?',
                            value: indexedUser.importsFlagDate
                                ? `✅ <t:${moment(indexedUser.importsFlagDate).unix()}:f>`
                                : `❌ No`,
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
                        `This user is not yet indexed (hasn't been manually imported or verified yet), so I don't have any more info to show you. If you know their last.fm username, please verify them manually with \`>>verify ${userId} [last.fm username]\``
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
