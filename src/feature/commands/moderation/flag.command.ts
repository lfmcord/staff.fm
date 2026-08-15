import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { Flag } from '@src/feature/commands/moderation/models/flag.model';
import { TextHelper } from '@src/helpers/text.helper';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { TYPES } from '@src/types';
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    inlineCode,
    PermissionFlagsBits,
    SlashCommandBuilder,
    User,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';

@injectable()
export class FlagCommand implements ICommand {
    name: string = 'flag';
    description: string = 'Flags a term as suspicious in order to show a warning if detected.';
    permissionLevel = CommandPermissionLevel.Moderator;
    isUsableInDms = false;
    isUsableInServer = true;
    loggingService: LoggingService;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('add')
                .setDescription('Flag a term')
                .addStringOption((option) =>
                    option.setName('term').setDescription('The term to flag (word or discord user ID)').setRequired(true)
                )
                .addStringOption((option) =>
                    option.setName('reason').setDescription('The reason for the flag').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription('Removes one or more flagged terms')
                .addStringOption((option) =>
                    option
                        .setName('term')
                        .setDescription('The term(s) to unflag (separate multiple with comma)')
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) => subcommand.setName('check').setDescription('Checks the existing flags'));

    private flagsRepository: FlagsRepository;

    async validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {}

    constructor(
        @inject(TYPES.FlagsRepository) flagsRepository: FlagsRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.loggingService = loggingService;
        this.flagsRepository = flagsRepository;
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        let result: CommandResult;
        switch (interaction.options.getSubcommand()) {
            case 'add':
                result = await this.add(interaction);
                break;
            case 'remove':
                result = await this.remove(interaction);
                break;
            default:
                result = await this.check();
                break;
        }

        return result;
    }

    async add(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const flag: Flag = {
            term: interaction.options.getString('term')!.toLowerCase(),
            reason: interaction.options.getString('reason')!,
            createdBy: interaction.user,
            createdAt: moment.utc().toDate(),
        };

        const existingFlag = await this.flagsRepository.getFlagByTerm(flag.term);
        if (existingFlag) {
            return {
                isSuccessful: false,
                reason: `Flag for term ${flag.term} already exists in database.`,
                replyToUser: {
                    content: `${inlineCode(flag.term)} is already on the list of flagged terms!\nReason: '${existingFlag.reason}' (created <t:${moment(existingFlag.createdAt).unix()}:D> by ${TextHelper.userDisplay(existingFlag.createdBy)})`,
                },
            };
        }

        await this.flagsRepository.addFlag(flag);

        await this.loggingService.logFlag(interaction.user, flag);

        return {
            isSuccessful: true,
            replyToUser: { content: `I've successfully added ${inlineCode(flag.term)} to the list of flagged terms.` },
        };
    }

    async remove(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        let wordsToRemove = interaction.options
            .getString('words')!
            .split(',')
            .map((word) => word.toLowerCase().trim().replace(',', ''));
        const entriesToDelete = await this.flagsRepository.getFlagsByTerms(wordsToRemove);

        if (entriesToDelete.length === 0) {
            return {
                isSuccessful: false,
                replyToUser: { content: `None of the terms you gave me are flagged.` },
            };
        }

        await this.flagsRepository.deleteFlagsByTerms(wordsToRemove);

        for (const entry of entriesToDelete) {
            await this.loggingService.logFlag(interaction.user, entry, true);
        }

        return {
            isSuccessful: true,
            replyToUser: {
                content: `I've removed the following ${TextHelper.pluralize('flag', entriesToDelete.length)}: ${entriesToDelete.map((s) => inlineCode(s.term)).join(', ')}.`,
            },
        };
    }

    async check(): Promise<CommandResult> {
        const flags = await this.flagsRepository.getAllFlags();

        if (flags.length === 0) {
            return {
                isSuccessful: true,
                replyToUser: { content: `No flagged terms yet.` },
            };
        }

        let content = '';
        let i = 1;
        for (const flag of flags) {
            const newLine = `${i}. ${flag.term}: ${flag.reason} (created ${moment(flag.createdAt).format('YYYY-MM-DD')} by ${flag.createdBy instanceof User ? flag.createdBy.username : flag.createdBy})\n`;
            content += newLine;
            i++;
        }

        return {
            isSuccessful: true,
            replyToUser: {
                content: `There are currently ${flags.length} flagged terms:`,
                files: [
                    new AttachmentBuilder(Buffer.from(content, 'utf-8'), {
                        name: `${moment().format('YYYY_MM_DD')}_flags.txt`,
                    }),
                ],
            },
        };
    }
}
