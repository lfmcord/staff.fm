import { User } from 'discord.js';

export class TextHelper {
    static success = '✅';
    static failure = '❌';
    static pascalCase(input: string): string {
        return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    }

    static userLog(user: User): string {
        return `${user.username} (ID ${user.id})`;
    }

    static wordWrap(text: string): string {
        return text.replace(/(?![^\n]{1,32}$)([^\n]{1,25})\s/g, '$1\n');
    }

    static getLastfmUsername(link: string): string | null {
        const matches = link.match(/(?<=(http:\/\/|https:\/\/)?(?:www.)?last\.fm\/user\/)([A-z0-9])+/g);
        if (matches != null && matches?.length > 0) return matches[0];
        else return null;
    }
}
