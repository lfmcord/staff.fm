import { ICommand } from '@commands/abstractions/ICommand';
import { CommandResult } from '@models/CommandResult';
import { Message, PartialMessage } from 'discord.js';
import { injectable } from 'inversify';

@injectable()
export class Ping implements ICommand {
    name: string = 'ping';
    usageHint: string = '';
    needsPrivilege: boolean = false; // TODO: Implement privilege system

    async run(message: Message | PartialMessage, args: string[]): Promise<CommandResult> {
        const start = new Date().getTime();
        let reply = await message.reply({
            content: 'Pinging...',
        });
        const end = new Date().getTime();
        await reply.edit(`I\'m alive! 🫡 Latency is ${end - start} ms.`);
        await message.react('✅');

        return {
            isSuccessful: true,
        };
    }
}
