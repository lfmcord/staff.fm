import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Message, PartialMessage } from 'discord.js';
import { injectable } from 'inversify';

@injectable()
export class Ping implements ICommand {
    name: string = 'ping';
    description: string = 'Checks if the bot is up.';
    usageHint: string = '';
    needsPrivilege: boolean = false; // TODO: Implement privilege system

    async run(message: Message | PartialMessage, args: string[]): Promise<CommandResult> {
        const start = new Date().getTime();
        let reply = await message.reply({
            content: 'Pinging...',
        });
        const end = new Date().getTime();
        await reply.edit(`I\'m alive! 😌 Latency is ${end - start} ms.`);
        await message.react('✅');

        return {
            isSuccessful: true,
        };
    }
}
