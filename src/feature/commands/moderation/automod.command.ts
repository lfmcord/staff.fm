import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { BlockedWordsRepository } from '@src/infrastructure/repositories/blocked-words.repository';
import { TYPES } from '@src/types';
import { AttachmentBuilder, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class AutomodCommand implements ICommand {
    name: string = 'automod';
    description: string = 'Checks, adds or removes automodded words.';
    permissionLevel = CommandPermissionLevel.Moderator;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('add')
                .setDescription('Adds one or more words to automod')
                .addStringOption((option) =>
                    option
                        .setName('words')
                        .setDescription('The words to add (separate multiple with comma, * as wildcard)')
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription('Removes one or more words to automod')
                .addStringOption((option) =>
                    option
                        .setName('words')
                        .setDescription('The words to remove (separate multiple with comma)')
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('check').setDescription('Checks the existing automodded words')
        );

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

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        let result: CommandResult;
        switch (interaction.options.getSubcommand()) {
            case 'add':
                result = await this.addBlockedWords(
                    interaction.options
                        .getString('words')!
                        .split(',')
                        .map((word) => word.toLowerCase().trim().replace(',', ''))
                );
                break;
            case 'remove':
                result = await this.removeBlockedWords(
                    interaction.options
                        .getString('words')!
                        .split(',')
                        .map((word) => word.toLowerCase().trim().replace(',', ''))
                );
                break;
            default:
                result = await this.showBlockedWords(interaction);
                break;
        }

        return result;
    }

    async validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {}

    async addBlockedWords(wordsToAdd: string[]): Promise<CommandResult> {
        this.logger.info(`Trying to add ${wordsToAdd.length} new blocked words...`);
        const existingBlockedWords = await this.blockedWordsRepository.getAllBlockedWords();
        const existingTerms = existingBlockedWords.map((word) => word.toLowerCase());

        const newWords = wordsToAdd.filter(
            (word) => !existingTerms.includes(word.toLowerCase()) && /^[a-z0-9*]+$/i.test(word)
        );
        if (newWords.length === 0) {
            return {
                isSuccessful: false,
                replyToUser: { content: `None of the provided words are new or allowed!` },
            };
        }

        await this.blockedWordsRepository.addBlockedWords(newWords);

        return {
            isSuccessful: true,
            replyToUser: {
                content: `I've successfully added the following words to the blocked list: \`${newWords.join('`, `')}\`.`,
            },
        };
    }

    async removeBlockedWords(wordsToRemove: string[]): Promise<CommandResult> {
        const existingBlockedWords = await this.blockedWordsRepository.getAllBlockedWords();
        const existingTerms = existingBlockedWords.map((word) => word.toLowerCase());

        const removedWords = wordsToRemove.filter((word) => existingTerms.includes(word.toLowerCase()));
        if (removedWords.length === 0) {
            return {
                isSuccessful: false,
                replyToUser: { content: `None of the provided words are currently blocked!` },
            };
        }

        await this.blockedWordsRepository.removeBlockedWords(removedWords);

        return {
            isSuccessful: true,
            replyToUser: {
                content: `I've successfully removed the following words from the blocked list: \`${removedWords.join('`, `')}\`.`,
            },
        };
    }

    async showBlockedWords(interaction: ChatInputCommandInteraction) {
        const blockedWords = (await this.blockedWordsRepository.getAllBlockedWords()).sort((a, b) =>
            a.localeCompare(b)
        );

        if (blockedWords.length === 0) {
            return {
                isSuccessful: true,
                replyToUser: { content: `There are currently no blocked words.` },
            };
        }

        const blockedWordsContent = blockedWords.join('\n');
        const attachment = new AttachmentBuilder(Buffer.from(blockedWordsContent, 'utf-8'), {
            name: 'blocked_words.txt',
        });

        return {
            isSuccessful: true,
            replyToUser: {
                content: `Automod is enabled in following channels: ${[...this.env.MODERATION.AUTOMOD.ENABLED_CHANNEL_IDS.map((id) => `<#${id}>`)].join(' ')}.\nThere are currently ${blockedWords.length} blocked words.`,
                files: [attachment],
            },
        };
    }
}
