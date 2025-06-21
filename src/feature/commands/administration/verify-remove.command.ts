import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { ComponentHelper } from '@src/helpers/component.helper';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { TYPES } from '@src/types';
import { ActionRowBuilder, Message, StringSelectMenuBuilder } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class VerifyRemoveCommand implements ICommand {
    name: string = 'verifyremove';
    description: string = 'Removes a verification from a user.';
    usageHint: string = '<user mention/ID>';
    examples: string[] = ['356178941913858049', '@haiyn'];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = ['removeverify'];
    isUsableInDms = false;
    isUsableInServer = true;
    logger: Logger<VerifyRemoveCommand>;
    env: Environment;
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

    async run(message: Message<true>, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0])!;
        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (!indexedUser) {
            return {
                isSuccessful: false,
                replyToUser: `This user is not indexed yet. If you know their last.fm username, please verify them with \`${this.env.CORE.PREFIX}verify ${userId} [last.fm username]\`.`,
            };
        }

        if (indexedUser.verifications.length == 0) {
            return {
                isSuccessful: false,
                replyToUser: `This user has no verifications I can remove. If you know their last.fm username, please verify them with \`${this.env.CORE.PREFIX}verify ${userId} [last.fm username]\`.`,
            };
        }

        message.channel.send({
            content: 'Which verification do you want to remove? Please select below.',
            embeds: [EmbedHelper.getVerificationHistoryEmbed(indexedUser.verifications, true)],
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    ComponentHelper.verificationMenu(indexedUser)
                ),
            ],
        });

        return {
            isSuccessful: true,
        };
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(`No args provided for verifyremove.`, `You must provide a Discord user!`);
        }
        if (!TextHelper.getDiscordUserId(args[0])) {
            throw new ValidationError(
                `${args[0]} is not a valid Discord user.`,
                `${args[0]} is not a valid Discord user.`
            );
        }
        return Promise.resolve();
    }
}
