import { Client, EmbedBuilder, Message, User } from 'discord.js';
import { LogLevelEnum } from '@src/helpers/models/LogLevel.enum';

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

    static getStaffMailEmbed(author: User | null, isFromStaff: boolean, isIncoming: boolean): EmbedBuilder {
        return new EmbedBuilder()
            .setAuthor({
                name: author?.username ?? isFromStaff ? 'Lastcord Staff' : 'Anonymous',
                iconURL: author?.avatarURL() ?? 'https://cdn-icons-png.flaticon.com/512/1534/1534082.png',
            })
            .setTitle(isIncoming ? '📥 Message received' : '📤 Message sent')
            .setColor(isIncoming ? 32768 : 12059152)
            .setTimestamp();
    }

    static getLogEmbed(actor: User, subject: User | null, level: LogLevelEnum): EmbedBuilder {
        return new EmbedBuilder()
            .setAuthor({
                name: actor?.username,
                iconURL: actor?.avatarURL() ?? undefined,
            })
            .setColor(this.getLogLevelColor(level))
            .setThumbnail(subject?.avatarURL() ?? null)
            .setTimestamp();
    }

    static getLogLevelColor(level: LogLevelEnum): number {
        switch (level) {
            case LogLevelEnum.Failure:
                return EmbedHelper.red;
            case LogLevelEnum.Success:
                return EmbedHelper.green;
            case LogLevelEnum.Info:
                return EmbedHelper.blue;
            case LogLevelEnum.Trace:
                return EmbedHelper.grey;
        }
    }
}
