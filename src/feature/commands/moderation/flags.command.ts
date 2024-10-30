import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { AttachmentBuilder, Message, User } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { TYPES } from '@src/types';
import * as moment from 'moment';
import * as Buffer from 'buffer';

@injectable()
export class FlagsCommand implements ICommand {
    name: string = 'flags';
    description: string = 'Shows all flagged terms.';
    usageHint: string = '';
    examples: string[] = [];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = ['showflags', 'flagsshow'];
    isUsableInDms = false;
    isUsableInServer = true;

    private flagsRepository: FlagsRepository;

    constructor(@inject(TYPES.FlagsRepository) flagsRepository: FlagsRepository) {
        this.flagsRepository = flagsRepository;
    }

    async run(message: Message): Promise<CommandResult> {
        const flags = await this.flagsRepository.getAllFlags();

        if (flags.length === 0) {
            return {
                isSuccessful: true,
                replyToUser: `No flagged terms yet.`,
            };
        }

        let content = '';
        let i = 1;
        for (const flag of flags) {
            const newLine = `${i}. ${flag.term}: ${flag.reason} (created ${moment(flag.createdAt).format('YYYY-MM-DD')} by ${flag.createdBy instanceof User ? flag.createdBy.username : flag.createdBy})\n`;
            content += newLine;
            i++;
        }
        await message.channel.send({
            content: `There are currently ${flags.length} flagged terms:`,
            files: [
                new AttachmentBuilder(Buffer.Buffer.from(content, 'utf-8'), {
                    name: `${moment().format('YYYY_MM_DD')}_flags.txt`,
                }),
            ],
        });

        return {
            isSuccessful: true,
        };
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}
