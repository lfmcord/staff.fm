import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Message, PartialMessage } from 'discord.js';
import { injectable } from 'inversify';

@injectable()
export class PingCommand implements ICommand {
    name: string = 'ping';
    description: string = 'Checks if the bot is up.';
    usageHint: string = '';
    examples: string[] = [];
    needsPrivilege: boolean = false; // TODO: Implement privilege system
    aliases = ['p'];

    async run(message: Message | PartialMessage): Promise<CommandResult> {
        const start = new Date().getTime();
        const reply = await message.reply({
            content: 'Pinging...',
        });
        const end = new Date().getTime();
        await reply.edit(`I\'m alive! 😌 Latency is ${end - start} ms.`);
        await message.react('✅');

        return {
            isSuccessful: true,
        };
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}
