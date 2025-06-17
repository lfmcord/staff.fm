import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { BlockedWordsRepository } from '@src/infrastructure/repositories/blocked-words.repository';
import { TYPES } from '@src/types';
import { AttachmentBuilder, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class AutomodCommand implements ICommand {
    name: string = 'automod';
    description: string =
        'Gets, sets or removes automodded words. Use `*` to match any characters before or after the word.';
    usageHint: string = 'add <words to add, separated by comma> | remove <words to remove, separated by comma>';
    examples: string[] = ['', 'add badword, worseword, *word*', 'remove badword, *word*'];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;

    private env: Environment;
    private blockedWordsRepository: BlockedWordsRepository;
    private logger: Logger<AutomodCommand>;

    constructor(
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.BotLogger) logger: Logger<AutomodCommand>,
        @inject(TYPES.BlockedWordsRepository) blockedWordsRepository: BlockedWordsRepository
    ) {
        this.env = env;
        this.logger = logger;
        this.blockedWordsRepository = blockedWordsRepository;
        this.description += `\nAutomod enabled in following channels: ${[...this.env.MODERATION.AUTOMOD.ENABLED_CHANNEL_IDS.map((id) => `<#${id}>`)].join(' ')}.`;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        let result: CommandResult;
        switch (args[0]) {
            case 'add':
                result = await this.addBlockedWords(
                    args
                        .slice(1)
                        .join(' ')
                        .toLowerCase()
                        .split(',')
                        .map((word) => word.trim().replace(',', ''))
                );
                break;
            case 'remove':
                result = await this.removeBlockedWords(
                    args
                        .slice(1)
                        .join(' ')
                        .toLowerCase()
                        .split(',')
                        .map((word) => word.trim().replace(',', ''))
                );
                break;
            default:
                result = await this.showBlockedWords(message);
                break;
        }

        return result;
    }

    async validateArgs(args: string[]): Promise<void> {
        if (args[0] == 'add') {
            if (args.length < 2) {
                throw new ValidationError(
                    `Expected >1 arguments, got ${args.length}.`,
                    'You have to give me terms to block!'
                );
            }
        } else if (args[0] == 'remove') {
            if (args.length < 2) {
                throw new ValidationError(
                    `Expected >1 arguments, got ${args.length}.`,
                    'You have to give me terms to remove!'
                );
            }
        }
    }

    async addBlockedWords(wordsToAdd: string[]): Promise<CommandResult> {
        this.logger.info(`Trying to add ${wordsToAdd.length} new blocked words...`);
        const existingBlockedWords = await this.blockedWordsRepository.getAllBlockedWords();
        const existingTerms = existingBlockedWords.map((word) => word.toLowerCase());

        const newWords = wordsToAdd.filter((word) => !existingTerms.includes(word.toLowerCase()));
        if (newWords.length === 0) {
            return {
                isSuccessful: false,
                replyToUser: `None of the provided words are new!`,
            };
        }

        await this.blockedWordsRepository.addBlockedWords(newWords);

        return {
            isSuccessful: true,
            replyToUser: `I've successfully added the following words to the blocked list: \`${newWords.join('`, `')}\`.`,
        };
    }

    async removeBlockedWords(wordsToRemove: string[]): Promise<CommandResult> {
        const existingBlockedWords = await this.blockedWordsRepository.getAllBlockedWords();
        const existingTerms = existingBlockedWords.map((word) => word.toLowerCase());

        const removedWords = wordsToRemove.filter((word) => existingTerms.includes(word.toLowerCase()));
        if (removedWords.length === 0) {
            return {
                isSuccessful: false,
                replyToUser: `None of the provided words are currently blocked!`,
            };
        }

        await this.blockedWordsRepository.removeBlockedWords(removedWords);

        return {
            isSuccessful: true,
            replyToUser: `I've successfully removed the following words from the blocked list: \`${removedWords.join('`, `')}\`.`,
        };
    }

    async showBlockedWords(message: Message) {
        const blockedWords = (await this.blockedWordsRepository.getAllBlockedWords()).sort((a, b) =>
            a.localeCompare(b)
        );

        if (blockedWords.length === 0) {
            return {
                isSuccessful: true,
                replyToUser: `There are currently no blocked words.`,
            };
        }

        const blockedWordsContent = blockedWords.join('\n');
        const attachment = new AttachmentBuilder(Buffer.from(blockedWordsContent, 'utf-8'), {
            name: 'blocked_words.txt',
        });

        await message.reply({
            content: `Automod is enabled in following channels: ${[...this.env.MODERATION.AUTOMOD.ENABLED_CHANNEL_IDS.map((id) => `<#${id}>`)].join(' ')}.\nThere are currently ${blockedWords.length} blocked words.`,
            files: [attachment],
        });

        return {
            isSuccessful: true,
        };
    }
}
