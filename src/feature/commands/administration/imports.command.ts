import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { IUserModel, UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import moment = require('moment');

@injectable()
export class ImportsCommand implements ICommand {
    name: string = 'imports';
    description: string = "Manages importing flags on a user.";
    permissionLevel = CommandPermissionLevel.Helper;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('set')
                .setDescription('Sets an import flag')
                .addUserOption((option) => option.setName('user').setDescription('The user to set').setRequired(true))
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('unset')
                .setDescription('Unsets an import flag')
                .addUserOption((option) => option.setName('user').setDescription('The user to unset').setRequired(true))
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('check')
                .setDescription('Checks if a user has an import flag')
                .addUserOption((option) => option.setName('user').setDescription('The user to check').setRequired(true))
        );

    private logger: Logger<ImportsCommand>;
    private usersRepository: UsersRepository;
    private loggingService: LoggingService;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<ImportsCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.usersRepository = usersRepository;
        this.logger = logger;
        this.loggingService = loggingService;
        this.memberService = memberService;
    }

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        let userId = interaction.options.getUser('user')!.id;
        let operationType = interaction.options.getSubcommand();

        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (!indexedUser) {
            this.logger.info(`imports command for user ID ${userId} cannot run because user is not in DB.`);
            return {
                isSuccessful: false,
                replyToUser: { embeds: [EmbedHelper.getUserNotIndexedEmbed()] },
            };
        }

        let replyToUser;
        switch (operationType) {
            case 'set':
                replyToUser = await this.set(indexedUser, interaction);
                break;
            case 'unset':
                replyToUser = await this.unset(indexedUser, interaction);
                break;
            default:
                replyToUser = await this.check(indexedUser);
        }

        return {
            isSuccessful: true,
            replyToUser: { content: replyToUser },
        };
    }

    private async set(indexedUser: IUserModel, interaction: ChatInputCommandInteraction): Promise<string> {
        let replyToUser = `📈 I've added the imports flag to <@${indexedUser.userId}>.`;
        if (indexedUser.importsFlagDate == null) {
            await this.usersRepository.addImportsFlagDateToUser(indexedUser.userId);
            const user = await this.memberService.fetchUser(indexedUser.userId);
            if (!user) {
                replyToUser += ` It seems like this user has left the server.`;
            } else {
                await this.loggingService.logImports(interaction.user, user, false);
            }
        } else {
            replyToUser = `<@${indexedUser.userId}> already has an import flag from <t:${moment(indexedUser.importsFlagDate).unix()}:d>.`;
        }

        return replyToUser;
    }

    private async unset(indexedUser: IUserModel, interaction: ChatInputCommandInteraction): Promise<string> {
        let replyToUser = `📉 I've removed the imports flag from <@${indexedUser.userId}>.`;
        if (indexedUser.importsFlagDate) {
            await this.usersRepository.removeImportsFlagDateFromUser(indexedUser.userId);
            const user = await this.memberService.fetchUser(indexedUser.userId);
            if (!user) {
                replyToUser += ` It seems like this user has left the server.`;
            } else {
                await this.loggingService.logImports(interaction.user, user, true);
            }
        } else {
            replyToUser = `<@${indexedUser.userId}> has no import flag.`;
        }

        return replyToUser;
    }

    private async check(indexedUser: IUserModel): Promise<string> {
        return indexedUser.importsFlagDate != null
            ? `<@${indexedUser.userId}> has been flagged for imports on <t:${moment(indexedUser.importsFlagDate).unix()}:d>.`
            : `<@${indexedUser.userId}> has not been flagged for imports.`;
    }
}
