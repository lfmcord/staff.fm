import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { EmbedBuilder, inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { TYPES } from '@src/types';
import * as moment from 'moment';
import { EmbedHelper } from '@src/helpers/embed.helper';

@injectable()
export class FlagsCommand implements ICommand {
    name: string = 'flags';
    description: string = 'Shows all flagged terms.';
    usageHint: string = '';
    examples: string[] = [];
    permissionLevel = CommandPermissionLevel.Staff;
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

        const embeds: EmbedBuilder[] = [];

        let content = '';
        let i = 1;
        flags.forEach((flag) => {
            const newLine = `${i}. ${inlineCode(flag.term)}: ${flag.reason} (created <t:${moment(flag.createdAt).unix()}:D> by <@!${flag.createdById}>)\n`;
            if (content.length + newLine.length >= 4096) {
                embeds.push(new EmbedBuilder().setDescription(content).setColor(EmbedHelper.blue));
                content = '';
            }
            content += newLine;
            i++;
        });
        embeds.push(new EmbedBuilder().setDescription(content).setColor(EmbedHelper.blue));
        embeds[0].setTitle(`List of flagged terms`);

        await message.channel.send({ embeds: embeds });

        return {
            isSuccessful: true,
        };
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}