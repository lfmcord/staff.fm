import { Client, EmbedBuilder, Message, User } from 'discord.js';
import { LogLevel } from '@src/helpers/models/LogLevel';
import { TextHelper } from '@src/helpers/text.helper';

export class EmbedHelper {
    static readonly red = 12059152;
    static readonly blue = 2002943;
    static readonly green = 6538847;
    static readonly grey = 5730958;

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

    static getStaffMailNewChannelEmbed(user: User | null, createdBy: User | null): EmbedBuilder {
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

    static getStaffMailEmbed(
        author: User | null,
        isFromStaff: boolean,
        isIncoming: boolean,
        content: string
    ): EmbedBuilder {
        return new EmbedBuilder()
            .setAuthor({
                name: author?.username != null ? author.username : 'Anonymous',
                iconURL: author?.avatarURL() ?? 'https://discord.com/assets/c0e3fec8f08643b9c1fa.svg',
            })
            .setTitle(isIncoming ? '📥 Message received' : '📤 Message sent')
            .setColor(isIncoming ? 32768 : 12059152)
            .setDescription(content)
            .setFooter({
                text: isIncoming
                    ? 'Please reply to this message to send a reply to staff.'
                    : 'To send a follow up message, reply to this message.',
            })
            .setTimestamp();
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
