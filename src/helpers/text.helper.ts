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
}
