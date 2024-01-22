export class TextHelper {
    static bold(input: string): string {
        return `**${input}**`;
    }

    static italicize(input: string): string {
        return `*${input}*`;
    }

    static underscore(input: string): string {
        return `_${input}_`;
    }

    static code(input: string): string {
        return `\`${input}\``;
    }

    static codeBlock(input: string): string {
        return `\`\`\`\n${input}\n\`\`\``;
    }

    static pascalCase(input: string): string {
        return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    }
}
