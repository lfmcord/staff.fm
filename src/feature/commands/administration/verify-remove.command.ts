import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ComponentHelper } from '@src/helpers/component.helper';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { TYPES } from '@src/types';
import {
    ActionRowBuilder,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class VerifyRemoveCommand implements ICommand {
    name: string = 'verifyremove';
    description: string = 'Removes a verification from a user.';
    permissionLevel = CommandPermissionLevel.Moderator;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .addUserOption((option) =>
            option.setName('user').setDescription('The discord user to remove a verification from').setRequired(true)
        );

    private logger: Logger<VerifyRemoveCommand>;
    private env: Environment;
    private usersRepository: UsersRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<VerifyRemoveCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.env = env;
        this.logger = logger;
        this.usersRepository = usersRepository;
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const userId = interaction.options.getUser('user')!.id;
        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (!indexedUser) {
            return {
                isSuccessful: false,
                replyToUser: {
                    embeds: [EmbedHelper.getUserNotIndexedEmbed()],
                },
            };
        }

        if (indexedUser.verifications.length == 0) {
            return {
                isSuccessful: false,
                replyToUser: {
                    content: `This user has no verifications I can remove. If you know their last.fm username, please index them with \`/index\` first.`,
                },
            };
        }

        return {
            isSuccessful: true,
            replyToUser: {
                content: 'Which verification do you want to remove? Please select below.',
                embeds: [EmbedHelper.getVerificationHistoryEmbed(indexedUser.verifications, true)],
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        ComponentHelper.verificationMenu(indexedUser)
                    ),
                ],
            },
        };
    }

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }
}
