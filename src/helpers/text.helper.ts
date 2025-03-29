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

    static userDisplay(user: User | string | null | undefined, useMention = true): string {
        if (!user) return `${inlineCode('unknown')} ${italic(`(ID Not Found)`)}`;
        if (user instanceof User)
            return useMention
                ? `<@!${user.id}> ${inlineCode(user.username)} (ID ${user.id})`
                : `${inlineCode(user.username)} ${italic(`(ID ${user.id})`)}`;
        return `${inlineCode('unknown')} ${italic(`(ID ${user})`)}`;
    }

    static wordWrap(text: string): string {
        return text.replace(/(?![^\n]{1,32}$)([^\n]{1,25})\s/g, '$1\n');
    }

    static getLastfmUsername(link: string): string | null {
        const matches = link.match(
            /(?<=(http:\/\/|https:\/\/)?(?:www.)?last\.fm\/([A-z]{2}\/)*user\/)([A-z0-9\-]{2,})+/g
        );
        if (matches != null && matches?.length > 0) return matches[0];
        else return null;
    }

    static pluralize(word: string, num: number, append = 's'): string {
        return num == 0 || num > 1 ? word + append : word;
    }

    static isDiscordUser(stringToCheck: string): boolean {
        return stringToCheck.match(/<@!*[0-9]{17,}>|[0-9]{17,}/g)?.length == 1;
    }

    static getDiscordUserId(stringToCheck: string): string | null {
        return stringToCheck.match(/[0-9]{17,}/g)?.pop() ?? null;
    }

    static getDiscordThreadId(stringToCheck: string): string | null {
        return stringToCheck.match(/[0-9]{17,}/g)?.pop() ?? null;
    }

    static getDiscordMessageLink(message: Message): string {
        return `https://discord.com/channels/${message.guild ? message.guild.id : '@me'}/${message.channelId}/${message.id}`;
    }

    static numberWithCommas(x: number | string): string {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    static strikeCounter(activeCount: number, allCount: number) {
        return `Strike Count: ${activeCount} active / ${allCount} total`;
    }

    static strikeCounterVerbose(activeCount: number, expiredCount: number, appealedCount: number) {
        return `**\\# of Strikes:** ${activeCount + expiredCount + appealedCount} total (${activeCount} active / ${expiredCount} expired / ${appealedCount} appealed)`;
    }
}
