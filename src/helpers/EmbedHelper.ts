import { Client, EmbedBuilder, ImageURLOptions, Message, User } from 'discord.js';

export class EmbedHelper {
    readonly red = 12059152;
    readonly blue = 255;
    readonly green = 32768;

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

    static getUserStaffMailEmbed(client: Client): EmbedBuilder {
        return new EmbedBuilder()
            .setAuthor({
                name: 'Staff.fm',
                iconURL: client.user!.avatarURL() ?? undefined,
            })
            .setTitle('✉️ StaffMail')
            .setColor(12059152)
            .setTimestamp();
    }

    static getStaffMailEmbed(
        author: User | null,
        isFromStaff: boolean,
        isIncoming: boolean
    ): EmbedBuilder {
        return new EmbedBuilder()
            .setAuthor({
                name: author?.username ?? isFromStaff ? 'Lastcord Staff' : 'Anonymous',
                iconURL:
                    author?.avatarURL() ??
                    'https://cdn-icons-png.flaticon.com/512/1534/1534082.png',
            })
            .setTitle(isIncoming ? '📥 Message received' : '📤 Message sent')
            .setColor(isIncoming ? 32768 : 12059152)
            .setTimestamp();
    }
}
