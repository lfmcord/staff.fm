import { Client, EmbedBuilder, Message, User } from 'discord.js';
import { LogLevel } from '@src/helpers/models/LogLevel';
import { TextHelper } from '@src/helpers/text.helper';
import { StaffMailType } from '@src/feature/staffmail/models/staff-mail-type.enum';

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

    // TODO: Fix this mess of staff mail embeds
    static getStaffMailCreateEmbed(client: Client): EmbedBuilder {
        return (
            new EmbedBuilder()
                // .setAuthor({
                //     name: 'Staff.fm',
                //     iconURL: client.user!.avatarURL() ?? undefined,
                // })
                .setTitle('✉️ StaffMail')
                .setColor(12059152)
                .setTimestamp()
        );
    }

    static getStaffMailStaffViewNewEmbed(user: User | null, createdBy: User | null): EmbedBuilder {
        // TODO: Add whois output, more info about user!
        return new EmbedBuilder()
            .setTitle('New StaffMail')
            .setColor(EmbedHelper.blue)
            .setFields([
                { name: 'User', value: user ? TextHelper.userDisplay(user) : 'Anonymous', inline: true },
                {
                    name: 'Created by',
                    value: createdBy ? TextHelper.userDisplay(createdBy) : 'Anonymous',
                    inline: true,
                },
            ])
            .setFooter({
                text: user ? `${user.username} | ${user.id}` : 'Anonymous',
                iconURL: user?.avatarURL() ?? 'https://cdn-icons-png.flaticon.com/512/1534/1534082.png',
            })
            .setTimestamp();
    }

    static getStaffMailUserViewIncomingEmbed(
        staffMember: User | null,
        isAnonymous: boolean,
        content: string,
        summary: string,
        type: StaffMailType
    ): EmbedBuilder {
        let name = staffMember?.username != null ? staffMember.username : `Anonymous`;
        name += ` (Lastcord Staff) -> You`;
        if (isAnonymous) name += ` (Anonymous)`;
        const humanReadableType = EmbedHelper.getHumanReadableStaffMailType(type);
        return new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: staffMember?.avatarURL() ?? EmbedHelper.lastfmPictureLink,
            })
            .setTitle(`📥 ${humanReadableType}: ${summary}`)
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
        summary: string,
        type: StaffMailType
    ): EmbedBuilder {
        let name = author.username;
        if (isAnonymous) name += ` (Anonymous)`;
        name += ` -> Lastcord Staff`;
        const humanReadableType = EmbedHelper.getHumanReadableStaffMailType(type);
        return new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: isAnonymous ? this.anonymousPictureLink : author!.avatarURL() ?? '',
            })
            .setTitle(`📤 ${humanReadableType}: ${summary}`)
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
                iconURL: author?.avatarURL() ?? 'https://discord.com/assets/c0e3fec8f08643b9c1fa.svg',
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
        if (isAnonymousReply) name += `(Anonymous)`;
        recipient ? (name += ` -> ${recipient.username}`) : ` -> Anonymous User`;
        const embed = new EmbedBuilder()
            .setAuthor({
                name: name,
                iconURL: staffMember?.avatarURL() ?? 'https://discord.com/assets/c0e3fec8f08643b9c1fa.svg',
            })
            .setTitle(`📤 Message sent`)
            .setColor(12059152)
            .setDescription(content)
            .setTimestamp();

        if (recipient) embed.setFooter({ text: `${recipient.username} | ${recipient.id}` });
        return embed;
    }

    static getHumanReadableStaffMailType(type: StaffMailType): string {
        let humanReadableType = '';
        switch (type) {
            case StaffMailType.report:
                humanReadableType = 'Report';
                break;
            case StaffMailType.server:
                humanReadableType = 'Question/Suggestion';
                break;
            case StaffMailType.lastfm:
                humanReadableType = 'Last.fm Question';
                break;
            case StaffMailType.crowns:
                humanReadableType = 'Crowns Game';
                break;
            case StaffMailType.other:
                humanReadableType = 'Other';
                break;
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
