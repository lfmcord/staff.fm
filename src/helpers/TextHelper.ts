export class TextHelper {
    static pascalCase(input: string): string {
        return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    }
}
