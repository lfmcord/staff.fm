import { inlineCode, italic, Message, User } from 'discord.js';

export class TextHelper {
    static success = '✅';
    static failure = '❌';
    static lastfm = '<:lastfmred:900551196023083048>';
    static loading = '<a:loading:1221575003041173565>';
    static pascalCase(input: string): string {
        return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    }

    static userLog(user: User): string {
        return `${user.username} (ID ${user.id})`;
    }

    static userDisplay(user: User | null | undefined, useMention = true): string {
        if (!user) return `${inlineCode('unknown')} ${italic(`(ID Not Found)`)}`;
        return useMention
            ? `<@!${user.id}> (ID ${user.id})`
            : `${inlineCode(user.username)} ${italic(`(ID ${user.id})`)}`;
    }

    static wordWrap(text: string): string {
        return text.replace(/(?![^\n]{1,32}$)([^\n]{1,25})\s/g, '$1\n');
    }

    static getLastfmUsername(link: string): string | null {
        const matches = link.match(
            /(?<=(http:\/\/|https:\/\/)?(?:www.)?last\.fm\/([A-z]{2}\/)*user\/)([A-z0-9]{2,})+/g
        );
        if (matches != null && matches?.length > 0) return matches[0];
        else return null;
    }

    static pluralize(word: string, num: number, append = 's'): string {
        return num == 0 || num > 1 ? word + append : word;
    }

    static isDiscordUser(stringToCheck: string): boolean {
        return stringToCheck.match(/<@!*[0-9]{17,19}>|[0-9]{17,19}/g)?.length == 1;
    }
    static getDiscordUserId(stringToCheck: string): string | null {
        return stringToCheck.match(/[0-9]{17,}/g)?.pop() ?? null;
    }

    static getDiscordMessageLink(message: Message): string {
        return `https://discord.com/channels/${message.guild ? message.guild.id : '@me'}/${message.channelId}/${message.id}`;
    }
}
