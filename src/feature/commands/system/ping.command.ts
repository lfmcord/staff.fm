import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Message, PartialMessage } from 'discord.js';
import { injectable } from 'inversify';
import { TextHelper } from '@src/helpers/text.helper';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';

@injectable()
export class PingCommand implements ICommand {
    name: string = 'ping';
    description: string = 'Checks if the bot is up.';
    usageHint: string = '';
    examples: string[] = [];
    permissionLevel = CommandPermissionLevel.User;
    aliases = ['p'];
    isUsableInDms = false;
    isUsableInServer = true;

    async run(message: Message | PartialMessage): Promise<CommandResult> {
        const start = new Date().getTime();
        const reply = await message.reply({
            content: 'Pinging...',
        });
        const end = new Date().getTime();
        await reply.edit(`I\'m alive! 😌 Latency is ${end - start} ms.`);
        await message.react(TextHelper.success);

        return {
            isSuccessful: true,
        };
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}
