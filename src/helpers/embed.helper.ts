import { StaffMailType } from '@src/feature/models/staff-mail-type';
import { CountryCodeHelper } from '@src/helpers/country-code.helper';
import { LogLevel } from '@src/helpers/models/LogLevel';
import { StrikeHelper } from '@src/helpers/strike.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { IDiscussionsModel } from '@src/infrastructure/repositories/discussions.repository';
import { IStrikesModel, IUserModel, IVerificationModel } from '@src/infrastructure/repositories/users.repository';

import { ErrorMessages } from '@models/error-messages';
import {
    Client,
    EmbedBuilder,
    GuildMember,
    Message,
    Role,
    User,
    bold,
    inlineCode, ChatInputCommandInteraction,
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

    static getVerboseCommandEmbed(client: Client, interaction: ChatInputCommandInteraction): EmbedBuilder {
        return new EmbedBuilder()
            .setAuthor({
                name: client.user!.username,
                iconURL: client.user!.avatarURL() ?? undefined,
            })
            .setColor(interaction.user.accentColor ?? null)
            .setTimestamp()
            .setFooter({ text: `Command executed by @${interaction.user.username}` });
    }

    static getDefaultCommandEmbed(client: Client, message: Message): EmbedBuilder {
        return new EmbedBuilder()
            .setColor(message.author.accentColor ?? null)
            .setTimestamp()
            .setFooter({ text: `Command executed by @${message.author.username}` });
    }

    static getStaffMailOpenEmbed = (isOpenedByStaff: boolean) => {
        let description = isOpenedByStaff
            ? `The staff team has a concern that they want to discuss with you. Please get back to them after you've read the messages!\n\n`
            : `Thank you for using Lastcord's StaffMail! To make sure staff can see your request timely, please open a new StaffMail for matters that aren't directly related to this one.\n\n`;
        return new EmbedBuilder()
            .setTitle(`🟢 StaffMail Opened`)
            .setColor(EmbedHelper.blue)
            .setDescription(description)
            .setFooter({ text: `To reply, simply send a message in this channel.`} );
    };

    static getStaffMailCloseEmbed(type: string, reason: string | null): EmbedBuilder {
        const humanReadableType = EmbedHelper.getHumanReadableStaffMailType(type);
        let title = `${humanReadableType}`;
        const embed = new EmbedBuilder()
            .setTitle(`🔴 StaffMail Closed`)
            .setColor(EmbedHelper.red)
            .setDescription(
                `Thank you for using the Lastcord StaffMail! This StaffMail has been closed. Please open another one if you feel that this closing was not correct.`
            )
            .setTimestamp();
        if (reason) embed.setFields({ name: 'Closure Reason', value: reason, inline: false });
        return embed;
    }

    static getStaffMailStaffViewNewEmbed(
        member: GuildMember | null,
        createdBy: User | null,
        category: string | StaffMailType,
        memberRoles: Role[],
    ): EmbedBuilder {
        const description =
            `${inlineCode('/reply')} to reply to the user (anonymously or not)\n` +
            `${inlineCode('/close')} to close the staff mail with an optional reason sent to the user (silently or not).\n`;
        const fields = [{ name: 'Category', value: EmbedHelper.getHumanReadableStaffMailType(category), inline: true }];
        let roles = '';
        const sortedRoles = memberRoles
            .filter((role) => !role.name.includes('everyone'))
            .sort((a, b) => b.position - a.position);
        sortedRoles.forEach((role) => {
            roles += `<@&${role.id}> `;
        });
        fields.push(
            { name: 'User', value: member ? TextHelper.userDisplay(member.user) : 'Anonymous', inline: false },
            { name: 'Roles', value: member ? roles : 'Anonymous', inline: false },
            {
                name: 'Created by',
                value: createdBy ? TextHelper.userDisplay(createdBy) : 'Anonymous',
                inline: false,
            }
        );
        return new EmbedBuilder()
            .setTitle('New StaffMail')
            .setColor(EmbedHelper.blue)
            .setDescription(description)
            .setFields(fields)
            .setFooter({
                text: member ? `${member.user.username} | ${member.id}` : 'Anonymous User',
                iconURL: member?.avatarURL() ?? EmbedHelper.anonymousPictureLink,
            })
            .setTimestamp();
    }

    static getStaffMailUserViewIncomingEmbed(
        staffMember: User | null,
        isAnonymous: boolean,
        type: string,
        content?: string,
    ): EmbedBuilder {
        let name = staffMember?.username != null ? staffMember.username : `Anonymous`;
        name += ` (Lastcord Staff) -> You`;
        if (isAnonymous) name += ` (Anonymous)`;
        const humanReadableType = EmbedHelper.getHumanReadableStaffMailType(type);

        let title = `📥 ${humanReadableType}`;
        const embed = new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: staffMember?.avatarURL() ?? EmbedHelper.lastfmPictureLink,
            })
            .setTitle(title)
            .setColor(32768)
            .setTimestamp();
        if (content && content !== '') embed.setDescription(content);
        return embed;
    }

    static getStaffMailUserViewOutgoingEmbed(
        author: User,
        isAnonymous: boolean,
        content: string,
        type: string | StaffMailType
    ): EmbedBuilder {
        let name = author.username;
        if (isAnonymous) name += ` (Anonymous)`;
        name += ` -> Lastcord Staff`;
        const humanReadableType = EmbedHelper.getHumanReadableStaffMailType(type);
        let title = `📤 ${humanReadableType}`;
        const embed = new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: isAnonymous || !author?.avatarURL() ? this.anonymousPictureLink : author!.avatarURL()!,
            })
            .setTitle(title)
            .setColor(12059152)
            .setFooter({
                text: 'To send a follow up message, send a message in this channel.',
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
        content?: string
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
        if (content && content !== '') embed.setDescription(content);
        return embed;
    }

    static getHumanReadableStaffMailType(type: string | StaffMailType): string {
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
            case StaffMailType.Other:
                humanReadableType = 'Other';
                break;
            case StaffMailType.Staff:
                humanReadableType = 'Staff';
                break;
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
                    name: 'Display name',
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
            .setDescription(TextHelper.userDisplay(member.user))
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
                        ? `🚫 <@&${user.scrobbleCap.roleId}> on <t:${moment(user.scrobbleCap.setOn).unix()}:d> by <@!${user.scrobbleCap.setBy}> (${user.scrobbleCap.reason?.substring(0, 50)}${user.scrobbleCap.reason && user.scrobbleCap.reason.length > 50 ? '...' : ''})`
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

    static getUserNotIndexedEmbed(): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle(`User not indexed`)
            .setColor(EmbedHelper.orange)
            .setDescription(ErrorMessages.UserNotIndexed);
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

        // sort by date, newest first
        strikes = strikes.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
        strikes.forEach((strike, idx) => {
            description += `${idx + 1}. <t:${moment(strike.createdAt).unix()}:d> by <@!${strike.createdById}>${strike.strikeLogLink ? ' [show log](' + strike.strikeLogLink + ')' : ''} - ${strike.wasAppealed ? 'Appealed' : strike.expiresOn && strike.expiresOn < new Date() ? 'Expired' : 'Active'}\n`;
        });

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

    static getInformEmbed(text: string): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle('ℹ️ Information from Staff')
            .setDescription(text)
            .setColor(EmbedHelper.blue)
            .setTimestamp()
            .setFooter({ text: `This message is purely informational and not a warning.` });
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
