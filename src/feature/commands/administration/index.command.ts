import { Environment } from '@models/environment';
import { LastfmError } from '@models/lastfm-error.model';
import { Verification } from '@src/feature/commands/administration/models/verification.model';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { inject, injectable } from 'inversify';
import LastFM from 'lastfm-typed';
import * as moment from 'moment';
import { Logger } from 'tslog';

@injectable()
export class IndexCommand implements ICommand {
    name: string = 'index';
    description: string = 'Indexes a user with a last.fm account.';
    permissionLevel = CommandPermissionLevel.Helper;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .addUserOption((option) => option.setName('user').setDescription('The user to index').setRequired(true))
        .addStringOption((option) =>
            option
                .setName('lastfm')
                .setDescription('The last.fm username to index the user with')
                .setRequired(true)
        )
        .addStringOption((option) => option.setName('reason').setDescription('The reason'));

    private loggingService: LoggingService;
    private lastFmClient: LastFM;
    private logger: Logger<IndexCommand>;
    private flagsRepository: FlagsRepository;
    private usersRepository: UsersRepository;
    private env: Environment;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<IndexCommand>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.FlagsRepository) flagsRepository: FlagsRepository
    ) {
        this.flagsRepository = flagsRepository;
        this.usersRepository = usersRepository;
        this.env = env;
        this.loggingService = loggingService;
        this.lastFmClient = lastFmClient;
        this.logger = logger;
        this.memberService = memberService;
    }

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const userId = interaction.options.getUser('user')!.id;
        const lastfmUsername = interaction.options.getString('lastfm')!;
        const reason = interaction.options.getString('reason');
        const userToVerify = await this.memberService.fetchUser(userId!);

        if (!userToVerify) {
            return {
                isSuccessful: false,
                replyToUser: { content: `This doesn't seem to be a valid discord user!` },
            };
        }

        const pastVerifications = (await this.usersRepository.getUserByUserId(userToVerify.id))?.verifications ?? [];
        const existingVerification = pastVerifications.find(
            (v) => v.username.toLowerCase() == lastfmUsername.toLowerCase()
        );
        if (existingVerification) {
            return {
                isSuccessful: false,
                replyToUser: {
                    content: `This user has already been indexed with the last.fm account name \`${existingVerification.username}\` at <t:${moment(existingVerification.verifiedOn).unix()}:f> by <@!${existingVerification.verifiedById}>.`,
                },
            };
        }

        let lastfmUser;
        try {
            lastfmUser = await this.lastFmClient.user.getInfo({ username: lastfmUsername });
        } catch (e) {
            if ((e as LastfmError).code == '6') {
                this.logger.info(`Last.fm user with name '${lastfmUsername}' could not be found.`);
            } else {
                this.logger.error('Last.fm returned an error that is not code 6 (not found)', e);
                throw Error(`Last.fm API returned an error.`);
            }
        }

        if (!lastfmUser) {
            return {
                isSuccessful: false,
                replyToUser: {
                    content: `The username '${lastfmUsername}' doesn't seem to be an existing Last.fm user.`,
                },
            };
        }

        const verification: Verification = {
            verificationMessage: null,
            verifyingUser: interaction.user,
            verifiedUser: userToVerify,
            lastfmUser: lastfmUser ?? null,
            discordAccountCreated: userToVerify.createdTimestamp,
            lastfmAccountCreated: lastfmUser?.registered ?? null,
            isReturningUser: false,
        };

        const existingUser = await this.usersRepository.getUserByUserId(verification.verifiedUser.id);
        if (!existingUser) {
            await this.usersRepository.addUser(verification);
        } else {
            verification.isReturningUser = true;
            await this.usersRepository.addVerificationToUser(verification);
        }

        await this.loggingService.logIndex(verification, reason);

        return {
            isSuccessful: true,
            replyToUser: {
                content: `I've indexed the user <@!${userToVerify.id}> with the last.fm account name \`${lastfmUsername.toLowerCase()}\`.`,
            },
        };
    }
}
