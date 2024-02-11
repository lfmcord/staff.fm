import {
    ActionRowBuilder,
    bold,
    ButtonBuilder,
    Client,
    EmbedBuilder,
    Message,
    MessageCreateOptions,
    MessageEditOptions,
    StringSelectMenuBuilder,
    User,
} from 'discord.js';
import { LogLevel } from '@src/helpers/models/LogLevel';
import { TextHelper } from '@src/helpers/text.helper';
import { ComponentHelper } from '@src/helpers/component.helper';
import { StaffMailCustomIds } from '@src/feature/interactions/models/staff-mail-custom-ids';
import { StaffMailType } from '@src/feature/interactions/models/staff-mail-type';

export class EmbedHelper {
    static readonly red = 12059152;
    static readonly blue = 2002943;
    static readonly green = 6538847;
    static readonly grey = 5730958;

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

    static getStaffMailOpenEmbed = new EmbedBuilder()
        .setTitle(`🟢 StaffMail Opened`)
        .setColor(EmbedHelper.red)
        .setDescription(
            `Thank you for using Lastcord's StaffMail! To make sure staff can see your request timely, please open a new StaffMail for matters that aren't directly related to this StaffMail.\n\n` +
                `${bold('How to reply:')} In order to reply or send follow up messages, always reply to the last message you sent or received!\n\n` +
                `In order to keep track of your open StaffMails, ${bold('check the pins in this channel')}. It always has the latest message from each of your open StaffMails.`
        )
        .setTimestamp();

    static getStaffMailCloseEmbed(summary: string | null, type: string, reason: string | null): EmbedBuilder {
        // TODO: Implement reopen button
        const humanReadableType = EmbedHelper.getHumanReadableStaffMailType(type);
        let title = `${humanReadableType}`;
        if (summary) title += ` (${summary})`;
        const embed = new EmbedBuilder()
            .setTitle(`🔴 StaffMail Closed`)
            .setColor(EmbedHelper.red)
            .setDescription(
                `Thank you for using the Lastcord StaffMail! This StaffMail has been closed:\n\n## ${title}\n\nPlease use the button below to reopen the StaffMail if you feel that this was wrong.`
            )
            .setTimestamp();
        if (reason) embed.setFields({ name: 'Closure Reason', value: reason, inline: false });
        return embed;
    }

    static getStaffMailStaffViewNewEmbed(
        user: User | null,
        createdBy: User | null,
        category: string,
        summary: string | null
    ): EmbedBuilder {
        // TODO: Add whois output, more info about user!
        const fields = [{ name: 'Category', value: EmbedHelper.getHumanReadableStaffMailType(category), inline: true }];
        if (summary) fields.push({ name: 'Summary', value: summary, inline: true });
        fields.push(
            { name: '\u200B', value: '\u200B', inline: false },
            { name: 'User', value: user ? TextHelper.userDisplay(user) : 'Anonymous', inline: true },
            {
                name: 'Created by',
                value: createdBy ? TextHelper.userDisplay(createdBy) : 'Anonymous',
                inline: true,
            }
        );
        return new EmbedBuilder()
            .setTitle('New StaffMail')
            .setColor(EmbedHelper.blue)
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
        return new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: staffMember?.avatarURL() ?? EmbedHelper.lastfmPictureLink,
            })
            .setTitle(title)
            .setColor(32768)
            .setDescription(content)
            .setFooter({
                text: 'Please reply to this message to send a reply to staff.',
            })
            .setTimestamp();
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
        return new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: isAnonymous ? this.anonymousPictureLink : author!.avatarURL() ?? '',
            })
            .setTitle(title)
            .setColor(12059152)
            .setDescription(content)
            .setFooter({
                text: 'To send a follow up message, reply to this message.',
            })
            .setTimestamp();
    }

    static getStaffMailStaffViewIncomingEmbed(author: User | null, content: string): EmbedBuilder {
        let name = author?.username != null ? author.username : `Anonymous User`;
        name += ' -> Lastcord Staff';
        const embed = new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: author?.avatarURL() ?? EmbedHelper.anonymousPictureLink,
            })
            .setTitle(`📥 New Message`)
            .setColor(32768)
            .setDescription(content)
            .setTimestamp();
        if (author) embed.setFooter({ text: `${author.username} | ${author.id}` });
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
        recipient ? (name += ` -> ${recipient.username}`) : ` -> Anonymous User`;
        const embed = new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: staffMember?.avatarURL() ?? EmbedHelper.anonymousPictureLink,
            })
            .setTitle(`📤 Message sent`)
            .setColor(12059152)
            .setDescription(content)
            .setTimestamp();

        if (recipient) embed.setFooter({ text: `${recipient.username} | ${recipient.id}` });
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
            case StaffMailType.Crowns: // TODO: Add another submenu for crowns?
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
                            .setTitle(`🎵 StaffMail - Last.fm Inquiry`)
                            .setDescription(
                                `⚠️ ${bold(`BEFORE YOU SUBMIT:`)} Please be aware that the Last.fm Discord is not officially affiliated with Last.fm. ` +
                                    `If you have an issue with your account or the website, we can't help you beyond pointing you in the right direction. For official Last.fm support, please visit the [Last.fm Support Forums](https://support.last.fm/).\n` +
                                    `Similarly, if you experience issues with the .fmbot or Gowon Discord bots, please visit their respective servers:\n- [.fmbot server](https://discord.gg/fmbot)\n- [Gowon server](https://discord.gg/9Vr7Df7TZf)\n\n` +
                                    `You might also get some help in #help-api-tools!`
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
                                    ` Please choose below if how you want to send your concern.`
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
            case StaffMailType.CrownsBanInquiry: // TODO: Add another submenu for crowns?
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
        }
        return humanReadableType;
    }

    static getLogEmbed(actor: User | string, subject: User | null, level: LogLevel): EmbedBuilder {
        const logEmbed = new EmbedBuilder()
            .setColor(this.getLogLevelColor(level))
            .setThumbnail(subject?.avatarURL() ?? null)
            .setTimestamp();
        if (actor instanceof User) {
            logEmbed.setAuthor({
                name: `${actor.username} (ID ${actor.id})`,
                iconURL: actor.avatarURL() ?? undefined,
            });
        } else {
            logEmbed.setAuthor({ name: `User Not Found (ID ${actor})` });
        }
        return logEmbed;
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
        }
    }
}
