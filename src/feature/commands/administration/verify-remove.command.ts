import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ActionRowBuilder, Client, Message, StringSelectMenuBuilder } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TYPES } from '@src/types';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import LastFM from 'lastfm-typed';
import { Logger } from 'tslog';
import { TextHelper } from '@src/helpers/text.helper';
import { Environment } from '@models/environment';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { ComponentHelper } from '@src/helpers/component.helper';

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

    private lastFmClient: LastFM;
    private memberService: MemberService;
    private usersRepository: UsersRepository;
    private client: Client;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<VerifyRemoveCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.env = env;
        this.logger = logger;
        this.lastFmClient = lastFmClient;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.client = client;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0])!;
        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (!indexedUser) {
            return {
                isSuccessful: false,
                replyToUser: `This user is not indexed yet. If you know their last.fm username, please verify them with \`${this.env.PREFIX}verify ${userId} [last.fm username]\`.`,
            };
        }

        if (indexedUser.verifications.length == 0) {
            return {
                isSuccessful: false,
                replyToUser: `This user has no verifications I can remove. If you know their last.fm username, please verify them with \`${this.env.PREFIX}verify ${userId} [last.fm username]\`.`,
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
