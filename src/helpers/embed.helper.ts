import { StaffMailCustomIds } from '@src/feature/interactions/models/staff-mail-custom-ids';
import { StaffMailType } from '@src/feature/interactions/models/staff-mail-type';
import { ComponentHelper } from '@src/helpers/component.helper';
import { CountryCodeHelper } from '@src/helpers/country-code.helper';
import { LogLevel } from '@src/helpers/models/LogLevel';
import { StrikeHelper } from '@src/helpers/strike.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { IDiscussionsModel } from '@src/infrastructure/repositories/discussions.repository';
import { IStrikesModel, IUserModel, IVerificationModel } from '@src/infrastructure/repositories/users.repository';

import {
    ActionRowBuilder,
    Attachment,
    ButtonBuilder,
    Client,
    EmbedBuilder,
    GuildMember,
    Message,
    MessageCreateOptions,
    MessageEditOptions,
    StringSelectMenuBuilder,
    User,
    bold,
    codeBlock,
    inlineCode,
} from 'discord.js';
import { getInfo } from 'lastfm-typed/dist/interfaces/userInterface';
import * as moment from 'moment';

export class EmbedHelper {
    static readonly red = 12059152;
    static readonly blue = 2002943;
    static readonly green = 6538847;
    static readonly grey = 5730958;
    static readonly orange = 16556627;

    static readonly anonymousPictureLink = 'https://em-content.zobj.net/source/twitter/376/detective_1f575-fe0f.png';
    static readonly lastfmPictureLink =
        'https://cdn.discordapp.com/emojis/900551196023083048.webp?size=96&quality=lossless';

    static getVerboseCommandEmbed(client: Client, message: Message): EmbedBuilder {
        return new EmbedBuilder()
            .setAuthor({
                name: client.user!.username,
                iconURL: client.user!.avatarURL() ?? undefined,
            })
            .setColor(message.author.accentColor ?? null)
            .setTimestamp()
            .setFooter({ text: `Command executed by @${message.author.username}` });
    }

    static getDefaultCommandEmbed(client: Client, message: Message): EmbedBuilder {
        return new EmbedBuilder()
            .setColor(message.author.accentColor ?? null)
            .setTimestamp()
            .setFooter({ text: `Command executed by @${message.author.username}` });
    }

    static getStaffMailCreateEmbed(): MessageCreateOptions {
        const embed = new EmbedBuilder()
            .setDescription(
                `Hello! Looks like you are trying to send a message to the Lastcord Staff team.\n\n${bold('Please select below what you need help with.')}`
            )
            .setTitle('✉️ Sending a new StaffMail')
            .setColor(12059152)
            .setTimestamp();
        return {
            embeds: [embed],
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(ComponentHelper.staffMailCreateMenu),
                new ActionRowBuilder<ButtonBuilder>().setComponents(
                    ComponentHelper.cancelButton(StaffMailCustomIds.CancelButton)
                ),
            ],
        };
    }

    static getStaffMailUrgentReportEmbed(
        isContextMenuInteraction: boolean,
        attachments: Attachment[],
        content?: string
    ): MessageCreateOptions {
        let description = isContextMenuInteraction
            ? `${bold('Are you sure you want to report this message to staff?')}`
            : `${bold('Are you sure you want to send your report like this to staff?')}`;
        if (content && content !== '') {
            description = description += `\n${codeBlock(content)}`;
        }
        if (!isContextMenuInteraction && attachments.length === 0) {
            description += `\n\n💡 ${bold('Hint:')} Including message links, screenshots or user names/IDs helps staff to resolve the issue faster.`;
        }

        if (attachments.length > 0) {
            let attachmentCount = 1;
            attachments.forEach((attachment) => {
                description += `\n${bold('Attachment ' + attachmentCount + ':')} ${attachment.proxyURL}`;
            });
            attachmentCount++;
        }
        const embed = new EmbedBuilder()
            .setDescription(description)
            .setTitle('✉️ Send report?')
            .setColor(EmbedHelper.blue)
            .setTimestamp();
        return {
            embeds: [embed],
            components: [
                new ActionRowBuilder<ButtonBuilder>().setComponents([
                    ComponentHelper.reportButton(StaffMailCustomIds.UrgentReportSendButton),
                    ComponentHelper.reportAnonButton(StaffMailCustomIds.UrgentReportSendAnonButton),
                ]),
                new ActionRowBuilder<ButtonBuilder>().setComponents(
                    ComponentHelper.cancelButton(StaffMailCustomIds.CancelButton)
                ),
            ],
        };
    }

    static getStaffMailOpenEmbed = (isOpenedByStaff: boolean) => {
        let description = isOpenedByStaff
            ? `The staff team has a concern that they want to discuss with you. Please get back to them after you've read the messages!\n\n`
            : `Thank you for using Lastcord's StaffMail! To make sure staff can see your request timely, please open a new StaffMail for matters that aren't directly related to this StaffMail.\n\n`;
        description += `In order to keep track of your open StaffMails, ${bold('check the pins in this channel')}.\n\n`;
        return new EmbedBuilder()
            .setTitle(`🟢 StaffMail Opened`)
            .setColor(EmbedHelper.blue)
            .setDescription(description);
    };

    static getStaffMailLinkToLatestMessage = (message?: Message) => {
        return new EmbedBuilder()
            .setColor(EmbedHelper.blue)
            .setDescription(
                `${bold('How to reply:')} In order to reply or send follow up messages, always reply to the last message you sent or received.\n\n${message ? `**Last message:** ${TextHelper.getDiscordMessageLink(message)}` : ''}`
            );
    };

    static getStaffMailCloseEmbed(summary: string | null, type: string, reason: string | null): EmbedBuilder {
        const humanReadableType = EmbedHelper.getHumanReadableStaffMailType(type);
        let title = `${humanReadableType}`;
        if (summary) title += ` (${summary})`;
        const embed = new EmbedBuilder()
            .setTitle(`🔴 StaffMail Closed`)
            .setColor(EmbedHelper.red)
            .setDescription(
                `Thank you for using the Lastcord StaffMail! This StaffMail has been closed:\n\n${bold(title)}\n\nPlease open another StaffMail if you feel that this closing was not correct.`
            )
            .setTimestamp();
        if (reason) embed.setFields({ name: 'Closure Reason', value: reason, inline: false });
        return embed;
    }

    static getStaffMailStaffViewNewEmbed(
        user: User | null,
        createdBy: User | null,
        category: string,
        summary: string | null,
        prefix: string = '>>'
    ): EmbedBuilder {
        const description =
            `${inlineCode(prefix + 'reply [message]')} to reply to the user with your name\n` +
            `${inlineCode(prefix + 'areply [message]')} to reply to the user anonymously\n` +
            `${inlineCode(prefix + 'close [reason]')} to close the staff mail with an optional reason sent to the user.\n` +
            `${inlineCode(prefix + 'silentclose [reason]')} to close the staff mail with an optional reason without notifying the user of the closing.`;
        const fields = [{ name: 'Category', value: EmbedHelper.getHumanReadableStaffMailType(category), inline: true }];
        if (summary) fields.push({ name: 'Summary', value: summary, inline: true });
        fields.push(
            { name: 'User', value: user ? TextHelper.userDisplay(user) : 'Anonymous', inline: false },
            {
                name: 'Created by',
                value: createdBy ? TextHelper.userDisplay(createdBy) : 'Anonymous',
                inline: false,
            }
        );
        return new EmbedBuilder()
            .setTitle(summary ?? 'New StaffMail')
            .setColor(EmbedHelper.blue)
            .setDescription(description)
            .setFields(fields)
            .setFooter({
                text: user ? `${user.username} | ${user.id}` : 'Anonymous User',
                iconURL: user?.avatarURL() ?? EmbedHelper.anonymousPictureLink,
            })
            .setTimestamp();
    }

    static getStaffMailUserViewIncomingEmbed(
        staffMember: User | null,
        isAnonymous: boolean,
        content: string,
        summary: string | null,
        type: string
    ): EmbedBuilder {
        let name = staffMember?.username != null ? staffMember.username : `Anonymous`;
        name += ` (Lastcord Staff) -> You`;
        if (isAnonymous) name += ` (Anonymous)`;
        const humanReadableType = EmbedHelper.getHumanReadableStaffMailType(type);

        let title = `📥 ${humanReadableType}`;
        if (summary) title += `: ${summary}`;
        const embed = new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: staffMember?.avatarURL() ?? EmbedHelper.lastfmPictureLink,
            })
            .setTitle(title)
            .setColor(32768)
            .setFooter({
                text: 'Please reply to this message to send a reply to staff.',
            })
            .setTimestamp();
        if (content !== '') embed.setDescription(content);
        return embed;
    }

    static getStaffMailUserViewOutgoingEmbed(
        author: User,
        isAnonymous: boolean,
        content: string,
        summary: string | null,
        type: string
    ): EmbedBuilder {
        let name = author.username;
        if (isAnonymous) name += ` (Anonymous)`;
        name += ` -> Lastcord Staff`;
        const humanReadableType = EmbedHelper.getHumanReadableStaffMailType(type);
        let title = `📤 ${humanReadableType}`;
        if (summary) title += `: ${summary}`;
        const embed = new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: isAnonymous ? this.anonymousPictureLink : author!.avatarURL() ?? '',
            })
            .setTitle(title)
            .setColor(12059152)
            .setFooter({
                text: 'To send a follow up message, reply to this message.',
            })
            .setTimestamp();
        if (content !== '') embed.setDescription(content);
        return embed;
    }

    static getStaffMailStaffViewIncomingEmbed(author: User | null, content: string): EmbedBuilder {
        let name = author?.username != null ? author.username : `Anonymous User`;
        name += ' -> Lastcord Staff';
        const embed = new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: author?.avatarURL() ?? EmbedHelper.anonymousPictureLink,
            })
            .setTitle(`📥 Message received`)
            .setColor(32768)
            .setFooter({ text: author ? `${author.username} | ${author.id}` : 'Anonymous User' })
            .setTimestamp();
        if (content !== '') embed.setDescription(content);
        return embed;
    }

    static getStaffMailStaffViewOutgoingEmbed(
        staffMember: User,
        isAnonymousReply: boolean,
        recipient: User | null,
        content: string
    ): EmbedBuilder {
        let name = staffMember.username;
        if (isAnonymousReply) name += ` (Anonymous)`;
        recipient ? (name += ` (Staff) -> ${recipient.username}`) : ` (Staff) -> Anonymous User`;
        const embed = new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: staffMember?.avatarURL() ?? EmbedHelper.anonymousPictureLink,
            })
            .setTitle(`📤 Message sent`)
            .setColor(12059152)
            .setFooter({ text: `${staffMember.username} | ${staffMember.id}` })
            .setTimestamp();
        if (content !== '') embed.setDescription(content);
        return embed;
    }

    static getStaffMailCategoryEmbed = (category: string) => {
        let message: MessageEditOptions = EmbedHelper.getStaffMailCreateEmbed() as MessageEditOptions;
        const embed = message.embeds![0] as EmbedBuilder;
        switch (category) {
            case StaffMailType.Report:
                message = {
                    embeds: [
                        embed
                            .setTitle('⚠️ StaffMail - Report')
                            .setDescription(
                                `💡 When reporting a user or a message, it's always helpful to include a message link with your report.\n\n` +
                                    ` Please choose below if you want to send the report with your name or anonymously.`
                            ),
                    ],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().setComponents(
                            ComponentHelper.sendButton(StaffMailCustomIds.ReportSendButton),
                            ComponentHelper.sendAnonButton(StaffMailCustomIds.ReportSendAnonButton),
                            ComponentHelper.cancelButton(StaffMailCustomIds.CancelButton)
                        ),
                    ],
                };
                break;
            case StaffMailType.Crowns:
                message = {
                    embeds: [
                        embed
                            .setTitle('👑 StaffMail - Crowns Game Inquiry')
                            .setDescription(`Please select from the menu below what you'd like to inquire about.`),
                    ],
                    components: [
                        new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
                            ComponentHelper.staffMailCreateCrownsSubmenu
                        ),
                        new ActionRowBuilder<ButtonBuilder>().setComponents(
                            ComponentHelper.cancelButton(StaffMailCustomIds.CancelButton)
                        ),
                    ],
                };
                break;
            case StaffMailType.Server:
                message = {
                    embeds: [
                        embed
                            .setTitle('❔ StaffMail - Server Question/Suggestion')
                            .setDescription(
                                `Whether you have a question about how the server works or if you have a suggestion on how to improve it - were happy to answer and hear you out!\n\n` +
                                    `Click the send button below to send us your questions or suggestion.`
                            ),
                    ],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().setComponents(
                            ComponentHelper.sendButton(StaffMailCustomIds.ServerSendButton),
                            ComponentHelper.cancelButton(StaffMailCustomIds.CancelButton)
                        ),
                    ],
                };
                break;
            case StaffMailType.Lastfm:
                message = {
                    embeds: [
                        embed
                            .setTitle(`${TextHelper.lastfm} StaffMail - Last.fm Question`)
                            .setDescription(
                                `⚠️ ${bold(`BEFORE YOU SUBMIT:`)} Please be aware that the Last.fm Discord is not officially affiliated with Last.fm. ` +
                                    `If you have an issue with your account or the website, we can't help you beyond pointing you in the right direction. For official Last.fm support, please visit the [Last.fm Support Forums](https://support.last.fm/).\n` +
                                    `Similarly, if you experience issues with the .fmbot or Gowon Discord bots, please visit their respective servers:\n- [.fmbot support server](https://discord.gg/fmbot)\n- [Gowon support server](https://discord.gg/9Vr7Df7TZf)\n\n` +
                                    `You might also get some help about last.fm features or scrobbling in <#579673026526969876>!`
                            ),
                    ],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().setComponents(
                            ComponentHelper.sendButton(StaffMailCustomIds.LastfmSendButton),
                            ComponentHelper.cancelButton(StaffMailCustomIds.CancelButton)
                        ),
                    ],
                };
                break;
            case StaffMailType.Other:
                message = {
                    embeds: [
                        embed
                            .setTitle('🃏 StaffMail - Other Concerns')
                            .setDescription(
                                `The concern why you want to message staff falls under none of the other categories. We are still happy to hear you out and do what we can.\n\n` +
                                    `⚠️ ${bold(`BEFORE YOU SUBMIT:`)} Please be aware that the Last.fm Discord is not officially affiliated with Last.fm.` +
                                    `If you have an issue with your account or the website, we can't help you beyond pointing you in the right direction. For official Last.fm support, please visit the [Last.fm Support Forums](https://support.last.fm/).\\n` +
                                    `Similarly, if you experience issues with the .fmbot or Gowon Discord bots, please visit their respective servers:\\n- [.fmbot support server](https://discord.gg/fmbot)\\n- [Gowon support server](https://discord.gg/9Vr7Df7TZf)\\n\\n` +
                                    `You might also get some help about last.fm features or scrobbling in <#579673026526969876>!\n\n` +
                                    ` Please choose below how you want to send your concern.`
                            ),
                    ],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().setComponents(
                            ComponentHelper.sendButton(StaffMailCustomIds.OtherSendButton),
                            ComponentHelper.sendAnonButton(StaffMailCustomIds.OtherSendAnonButton),
                            ComponentHelper.cancelButton(StaffMailCustomIds.CancelButton)
                        ),
                    ],
                };
                break;
        }
        return message;
    };

    static getStaffMailCrownsSubcategoryEmbed = (subCategory: string) => {
        const embed = EmbedHelper.getStaffMailCreateEmbed().embeds![0] as EmbedBuilder;
        let messageCreateOptions: MessageEditOptions = { embeds: [embed] };
        switch (subCategory) {
            case StaffMailType.CrownsReport:
                messageCreateOptions = {
                    embeds: [
                        embed
                            .setTitle('👑 StaffMail - Crowns Game Report')
                            .setDescription(
                                `If you believe a user is violating the crowns game rules, please send us their Discord username and/or their Last.fm profile link along with a short reason why you think they are in violation of the rules.\n` +
                                    `We'll get back to you about what action we took.`
                            ),
                    ],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().setComponents(
                            ComponentHelper.sendButton(StaffMailCustomIds.CrownsReportSendButton),
                            ComponentHelper.cancelButton(StaffMailCustomIds.CancelButton)
                        ),
                    ],
                };
                break;
            case StaffMailType.CrownsBanInquiry:
                messageCreateOptions = {
                    embeds: [
                        embed
                            .setTitle('👑 StaffMail - Crowns Game Ban Inquiry')
                            .setDescription(
                                `If you're unsure about why you're not able to participate in the crowns game or would like to dispute your crowns game ban, please use the button below to send us a message.`
                            ),
                    ],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().setComponents(
                            ComponentHelper.sendButton(StaffMailCustomIds.CrownsBanInquirySendButton),
                            ComponentHelper.cancelButton(StaffMailCustomIds.CancelButton)
                        ),
                    ],
                };
                break;
            case StaffMailType.CrownsFalseCrown:
                messageCreateOptions = {
                    embeds: [
                        embed
                            .setTitle('👑 StaffMail - False Crown')
                            .setDescription(
                                `If you've accidentally misspelled a crown or found someone holding a false crown, let us know and we'll delete it.\n\n` +
                                    `Simply click the button below to send us the name of the false crown.`
                            ),
                    ],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().setComponents(
                            ComponentHelper.sendButton(StaffMailCustomIds.CrownsFalseCrownSendButton),
                            ComponentHelper.cancelButton(StaffMailCustomIds.CancelButton)
                        ),
                    ],
                };
                break;
            case StaffMailType.CrownsOther:
                messageCreateOptions = {
                    embeds: [
                        embed
                            .setTitle('👑 StaffMail - Other Crowns Game Inquiry')
                            .setDescription(
                                `If your inquiry falls under none of the other categories, we are still happy to hear you out and assist!\n\n` +
                                    `Simply click the button below to send us your crowns game concern.`
                            ),
                    ],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().setComponents(
                            ComponentHelper.sendButton(StaffMailCustomIds.CrownsOtherSendButton),
                            ComponentHelper.cancelButton(StaffMailCustomIds.CancelButton)
                        ),
                    ],
                };
                break;
        }
        return messageCreateOptions;
    };

    static getHumanReadableStaffMailType(type: string): string {
        let humanReadableType = 'Unknown Category';
        switch (type) {
            case StaffMailType.Report:
                humanReadableType = 'Report';
                break;
            case StaffMailType.Server:
                humanReadableType = 'Question/Suggestion';
                break;
            case StaffMailType.Lastfm:
                humanReadableType = 'Last.fm Question';
                break;
            case StaffMailType.Crowns:
                humanReadableType = 'Crowns Game';
                break;
            case StaffMailType.CrownsReport:
                humanReadableType = 'Crowns Game Report';
                break;
            case StaffMailType.CrownsBanInquiry:
                humanReadableType = 'Crowns Game Ban';
                break;
            case StaffMailType.CrownsFalseCrown:
                humanReadableType = 'Crowns Game - False Crown';
                break;
            case StaffMailType.CrownsOther:
                humanReadableType = 'Crowns Game - Other';
                break;
            case StaffMailType.Other:
                humanReadableType = 'Other';
                break;
            case StaffMailType.Staff:
                humanReadableType = 'Staff';
                break;
            case StaffMailType.UrgentReport:
                humanReadableType = 'Report - Urgent';
                break;
            case StaffMailType.InServerReport:
                humanReadableType = 'Report';
        }
        return humanReadableType;
    }

    static getLogEmbed(actor: User | null, subject: User | null, level: LogLevel): EmbedBuilder {
        const logEmbed = new EmbedBuilder()
            .setColor(this.getLogLevelColor(level))
            .setThumbnail(subject?.avatarURL() ?? null)
            .setTimestamp();
        if (actor) {
            logEmbed.setAuthor({
                name: `${actor.username} (ID ${actor.id})`,
                iconURL: actor.avatarURL() ?? undefined,
            });
        }
        return logEmbed;
    }

    static getLastFmUserEmbed(
        lastFmUsername: string | undefined,
        lastFmUser?: getInfo,
        shouldAlert = false
    ): EmbedBuilder {
        if (!lastFmUsername)
            return new EmbedBuilder()
                .setTitle(`Last.fm Account`)
                .setColor(EmbedHelper.blue)
                .setDescription(`No Last.fm account currently in use.`);

        if (!lastFmUser)
            return new EmbedBuilder()
                .setTitle(`Last.fm Account`)
                .setColor(EmbedHelper.orange)
                .setDescription(
                    `⚠️ Could not find Last.fm user for username ${inlineCode(lastFmUsername)}.\nPerhaps they've changed their username on the website?`
                );

        const embed = new EmbedBuilder()
            .setTitle('Last.fm Account')
            .setURL(lastFmUser.url)
            .setFields([
                {
                    name: 'Username',
                    value: inlineCode(lastFmUser.name),
                    inline: true,
                },
                {
                    name: 'Real name',
                    value: lastFmUser.realname !== '' ? inlineCode(lastFmUser.realname) : `N/A`,
                    inline: true,
                },
                {
                    name: 'Scrobble Count',
                    value: lastFmUser.playcount.toString(),
                    inline: false,
                },
                {
                    name: 'Country',
                    value:
                        lastFmUser.country !== 'None'
                            ? `:flag_${CountryCodeHelper.getTwoLetterIsoCountryCode(lastFmUser.country)?.toLowerCase()}: ` +
                              lastFmUser.country
                            : lastFmUser.country,
                    inline: true,
                },
                {
                    name: 'Created',
                    value: `${shouldAlert ? '⚠️ ' : ''}<t:${lastFmUser.registered}:D> (<t:${lastFmUser.registered}:R>)`,
                    inline: true,
                },
            ])
            .setColor(shouldAlert ? EmbedHelper.orange : EmbedHelper.blue)
            .setTimestamp();
        const lfmImageUrl = lastFmUser.image.find((i) => i.size === 'extralarge')?.url;
        if (lfmImageUrl && lfmImageUrl !== '') embed.setThumbnail(lfmImageUrl);
        return embed;
    }

    static getDiscordUserEmbed(userId: string, user?: User): EmbedBuilder {
        if (!user) {
            return new EmbedBuilder()
                .setTitle(`Unknown Discord User`)
                .setColor(EmbedHelper.orange)
                .setDescription(
                    `I cannot find any information on user with user ID ${userId}. They might not exist or have deleted their account.`
                );
        }

        return EmbedHelper.getLogEmbed(user, user, LogLevel.Warning)
            .setTitle(`Discord Account`)
            .setDescription(`:warning: Not in this server.`)
            .setFields([
                {
                    name: 'Account created',
                    value: `<t:${moment(user.createdAt).unix()}:f> (<t:${moment(user.createdAt).unix()}:R>)`,
                },
            ])
            .setFooter({ text: `User ID: ${user.id}` });
    }

    static getDiscordMemberEmbed(userId: string, member?: GuildMember): EmbedBuilder {
        if (!member) {
            return new EmbedBuilder()
                .setTitle(`Unknown Discord User`)
                .setColor(EmbedHelper.orange)
                .setDescription(
                    `I cannot find any information on user with user ID ${userId}. They might not exist or have deleted their account.`
                );
        }

        return EmbedHelper.getLogEmbed(member.user, member.user, LogLevel.Info)
            .setTitle(`Discord Account`)
            .setFields([
                {
                    name: 'Joined',
                    value: `<t:${moment(member.joinedAt).unix()}:f> (<t:${moment(member.joinedAt).unix()}:R>)`,
                },
                {
                    name: 'Account created',
                    value: `<t:${moment(member.user.createdAt).unix()}:f> (<t:${moment(member.user.createdAt).unix()}:R>)`,
                },
            ])
            .setFooter({ text: `User ID: ${member.id}` });
    }

    static getCrownsEmbed(user?: IUserModel): EmbedBuilder {
        if (!user)
            return new EmbedBuilder()
                .setTitle(`Crowns Game & Miscellaneous`)
                .setColor(EmbedHelper.orange)
                .setDescription('No data available.');

        return new EmbedBuilder()
            .setTitle(`Crowns Game & Miscellaneous`)
            .setColor(EmbedHelper.blue)
            .setFields(
                {
                    name: 'Crowns Status',
                    value: user.crownsBan
                        ? `<:nocrown:816944519924809779> Banned on <t:${moment(user.crownsBan.bannedOn).unix()}:d>`
                        : `👑 No Crowns Ban`,
                    inline: true,
                },
                {
                    name: 'Imported?',
                    value: user.importsFlagDate ? `📈 <t:${moment(user.importsFlagDate).unix()}:f>` : `📉 No Imports`,
                    inline: true,
                },
                {
                    name: 'Scrobble Cap',
                    value: user.scrobbleCap
                        ? `🚫 <@&${user.scrobbleCap.roleId}> on <t:${moment(user.scrobbleCap.setOn).unix()}:d> by <@!${user.scrobbleCap.setBy}> (${user.scrobbleCap.reason.substring(0, 50)}${user.scrobbleCap.reason.length > 50 ? '...' : ''})`
                        : `☑️ No Scrobble Cap`,
                    inline: false,
                }
            );
    }

    static getVerificationHistoryEmbed(verifications: IVerificationModel[], isNumbered = false): EmbedBuilder {
        const sortedVerifications = verifications.sort((a, b) => (a.verifiedOn > b.verifiedOn ? -1 : 1));

        let description = '';
        sortedVerifications.forEach((v, idx) => {
            description += `${isNumbered ? idx + 1 + '.' : '-'} ${inlineCode(v.username ?? 'NO LAST.FM ACCOUNT')} (${`<t:${moment(v.verifiedOn).unix()}:D>`} by <@!${v.verifiedById}>)\n`;
        });
        return new EmbedBuilder()
            .setTitle(`Past Verifications`)
            .setColor(EmbedHelper.blue)
            .setDescription(description != '' ? description : 'No Verifications');
    }

    static getUserNotIndexedEmbed(userId?: string): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle(`User not indexed`)
            .setColor(EmbedHelper.orange)
            .setDescription(
                `This user is not yet indexed (hasn't been manually imported or verified yet), so I don't have any more info to show you. 
                If you know their last.fm username, please verify them manually with \`>>verify ${userId ?? '[user ID]'} [last.fm username]\``
            );
    }

    static getDiscussionsManagementEmbed(
        discussions: IDiscussionsModel[],
        interval: number,
        pingRoleIds: string[]
    ): EmbedBuilder {
        const scheduledDiscussions = discussions.filter((d) => d.scheduledFor);
        const usedDiscussions = discussions.filter((d) => d.threadId);
        const unusedDiscussions = discussions.filter((d) => !d.threadId && !d.scheduledFor);

        const autoDiscussionEnabled = scheduledDiscussions.length > 0;
        const fields = [
            {
                name: 'Settings',
                value:
                    `- Automatic schedule: ${autoDiscussionEnabled ? '♾️ enabled' : '⏹️ disabled'}\n` +
                    `${autoDiscussionEnabled ? `- Next Discussion: scheduled for <t:${moment(scheduledDiscussions[0].scheduledFor).unix()}:f> (Topic: "${scheduledDiscussions[0].topic}").\n` : ''}` +
                    `- Automatic interval: ${interval}h\n` +
                    `- Ping Role IDs: ${pingRoleIds.map((id) => '<@&' + id + '>').join(', ')}`,
            },
            {
                name: 'Discussion Stats',
                value: `- Total Topic Count: ${discussions.length}\n- ${usedDiscussions.length} topics used.\n- ${unusedDiscussions.length} topics open.`,
            },
        ];
        return new EmbedBuilder().setTitle(`Discussions Management`).setColor(EmbedHelper.blue).addFields(fields);
    }

    static getDiscussionEtiquetteEmbed(): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle('📜 Discussion Etiquette')
            .setColor(EmbedHelper.blue)
            .setDescription(
                `Please remember our Discussions Etiquette:\n` +
                    `1. **Be Respectful** – Disagreements should be about ideas, not individuals.\n` +
                    `2. **Use Constructive Criticism** – If critiquing, offer insights, not just complaints.\n` +
                    `3. **Don't Gatekeep** – Welcome all levels of knowledge and musical tastes.\n` +
                    `4. **Be Open-Minded** – Embrace different genres, styles, and interpretations.\n` +
                    `5. **Stay on Topic** – Keep discussions focused on music and related subjects.`
            )
            .setFooter({ text: `Enjoy!` })
            .setTimestamp();
    }

    static getStrikesEmbed(strikes: IStrikesModel[], subject?: User): EmbedBuilder {
        const activeStrikes = StrikeHelper.getActiveStrikes(strikes);
        const expiredStrikes = StrikeHelper.getExpiredStrikes(strikes);
        const appealedStrikes = StrikeHelper.getAppealedStrikes(strikes);

        let description = '';
        if (subject) description += `:bust_in_silhouette: ${bold('User:')} ${TextHelper.userDisplay(subject, true)}\n`;

        description +=
            TextHelper.strikeCounterVerbose(activeStrikes.length, expiredStrikes.length, appealedStrikes.length) +
            '\n\n';

        if (activeStrikes.length > 0) {
            description += '**Active Strikes:**\n';
            activeStrikes.forEach((activeStrike, idx) => {
                description += `${idx + 1}. <t:${moment(activeStrike.createdAt).unix()}:d> by <@!${activeStrike.createdById}>${activeStrike.strikeLogLink ? ' [show log](' + activeStrike.strikeLogLink + ')' : ''}\n`;
            });
        }
        if (expiredStrikes.length > 0) {
            description += '\n**Expired Strikes:**\n';
            expiredStrikes.forEach((expiredStrike, idx) => {
                description += `${idx + 1}. <t:${moment(expiredStrike.createdAt).unix()}:d> by <@!${expiredStrike.createdById}>${expiredStrike.strikeLogLink ? ' [show log](' + expiredStrike.strikeLogLink + ')' : ''}\n`;
            });
        }
        if (appealedStrikes.length > 0) {
            description += '\n**Appealed Strikes:**\n';
            appealedStrikes.forEach((appealedStrike, idx) => {
                description += `${idx + 1}. <t:${moment(appealedStrike.createdAt).unix()}:d> by <@!${appealedStrike.createdById}>${appealedStrike.strikeLogLink ? ' [show log](' + appealedStrike.strikeLogLink + ')' : ''}\n`;
            });
        }

        const embed = new EmbedBuilder();
        embed.setColor(EmbedHelper.red);
        embed.setDescription(description);
        embed.setTitle(`🗯️ Strikes`);
        if (subject) {
            embed
                .setThumbnail(subject?.avatarURL() ?? null)
                .setTimestamp()
                .setFooter({ text: `${subject.username} | ${subject.id}` });
        }
        return embed;
    }

    static getLogLevelColor(level: LogLevel): number {
        switch (level) {
            case LogLevel.Failure:
                return EmbedHelper.red;
            case LogLevel.Success:
                return EmbedHelper.green;
            case LogLevel.Info:
                return EmbedHelper.blue;
            case LogLevel.Trace:
                return EmbedHelper.grey;
            case LogLevel.Warning:
                return EmbedHelper.orange;
        }
    }
}
