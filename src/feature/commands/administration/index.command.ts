import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { MessageService } from '@src/infrastructure/services/message.service';
import { TYPES } from '@src/types';
import { MemberService } from '@src/infrastructure/services/member.service';
import { Logger } from 'tslog';
import { Verification } from '@src/feature/commands/administration/models/verification.model';
import { TextHelper } from '@src/helpers/text.helper';
import LastFM from 'lastfm-typed';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { Environment } from '@models/environment';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LastfmError } from '@models/lastfm-error.model';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import * as moment from 'moment';

@injectable()
export class IndexCommand implements ICommand {
    name: string = 'index';
    description: string = 'Indexes a user with a last.fm account.';
    usageHint: string = '[user mention/ID] [last.fm username]';
    examples: string[] = ['@haiyn haiyn'];
    permissionLevel = CommandPermissionLevel.Helper;
    aliases = ['link'];
    isUsableInDms = false;
    isUsableInServer = true;

    private loggingService: LoggingService;
    private lastFmClient: LastFM;
    private logger: Logger<IndexCommand>;
    private flagsRepository: FlagsRepository;
    private usersRepository: UsersRepository;
    private env: Environment;
    private memberService: MemberService;
    private messageService: MessageService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<IndexCommand>,
        @inject(TYPES.MessageService) messageService: MessageService,
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
        this.messageService = messageService;
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length < 1)
            throw new ValidationError(
                `args length is ${args.length}, expected length 3+.`,
                `You must give me a discord user, last.fm username and a reason for the indexing!`
            );

        if (args.length == 2)
            throw new ValidationError(
                `args length is ${args.length}, expected length 3+.`,
                `You must give me a reason for the indexing so it's understandable in the future!`
            );

        const userId = TextHelper.getDiscordUserId(args[0]);
        if (!userId)
            throw new ValidationError(
                `The supplied first argument is not a discord user: ${args[0]}`,
                `The first argument in the command has to be a valid Discord user!`
            );

        return Promise.resolve();
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0]);
        const lastfmUsername = args[1];
        const reason = args.slice(2).join(' ');
        const userToVerify = await this.memberService.fetchUser(userId!);

        if (!userToVerify) {
            return {
                isSuccessful: false,
                replyToUser: `This doesn't seem to be a valid discord user!`,
            };
        }

        const pastVerifications = (await this.usersRepository.getUserByUserId(userToVerify.id))?.verifications ?? [];
        const existingVerification = pastVerifications.find(
            (v) => v.username.toLowerCase() == lastfmUsername.toLowerCase()
        );
        if (existingVerification) {
            return {
                isSuccessful: false,
                replyToUser: `This user has already been indexed with the last.fm account name \`${existingVerification.username}\` at <t:${moment(existingVerification.verifiedOn).unix()}:f> by <@!${existingVerification.verifiedById}>.`,
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
                replyToUser: `The username '${lastfmUsername}' doesn't seem to be an existing Last.fm user.`,
            };
        }

        const verification: Verification = {
            verificationMessage: null,
            verifyingUser: message.author,
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
            replyToUser: `I've indexed the user <@!${userToVerify.id}> with the last.fm account name \`${lastfmUsername.toLowerCase()}\`.`,
        };
    }
}
