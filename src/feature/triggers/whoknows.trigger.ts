import { Environment } from '@models/environment';
import { LastfmError } from '@models/lastfm-error.model';
import { Verification } from '@src/feature/commands/administration/models/verification.model';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { MessageService } from '@src/infrastructure/services/message.service';
import { TYPES } from '@src/types';
import { GuildTextBasedChannel, Message, User } from 'discord.js';
import { inject, injectable } from 'inversify';
import LastFM from 'lastfm-typed';
import { Logger } from 'tslog';

@injectable()
export class WhoknowsTrigger {
    logger: Logger<WhoknowsTrigger>;
    lastFmClient: LastFM;
    memberService: MemberService;
    usersRepository: UsersRepository;
    loggingService: LoggingService;
    messageService: MessageService;
    env: Environment;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<WhoknowsTrigger>,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.MessageService) messageService: MessageService,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.lastFmClient = lastFmClient;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.loggingService = loggingService;
        this.messageService = messageService;
        this.logger = logger;
        this.env = env;
    }

    async run(message: Message) {
        this.logger.trace(`Checking if message is a relevant WK command...`);

        const args = message.content.split(' ');
        if (
            (message.content.startsWith('!crowns') || message.content.startsWith('!cw')) &&
            (args[1] == 'ban' || args[1] == 'unban')
        )
            await this.handleCrownsCommand(message, args);

        if (message.content.startsWith('!username')) await this.handleUsernameCommand(message, args.slice(1));

        const loginMessageMatch = message.content.match(/<@([0-9]{17,})>.*`(.*)`/);
        if (loginMessageMatch) {
            await this.handleLoginMessage(message, loginMessageMatch[1], loginMessageMatch[2]);
        }
    }

    private async handleCrownsCommand(message: Message, args: string[]) {
        this.logger.info(`New WK crowns command, updating DB...`);

        const isBan = args[1] == 'ban';
        const subjectId = TextHelper.getDiscordUserId(args[2]);
        let reason = args.slice(3).join(' ');
        if (!subjectId) {
            this.logger.info(`'${args[2]}' is not a Discord user ID`);
            await message.reply(
                `I've not ${isBan ? 'added' : 'removed'} the crowns ban flag to the user because I couldn't recognize this user. ` +
                    `If this is wrong, please use the \`${this.env.CORE.PREFIX}crowns ${isBan ? 'ban' : 'unban'}\` command.`
            );
            return;
        }
        const hasCrownsBan = (await this.usersRepository.getUserByUserId(subjectId))?.crownsBan != null;

        if ((hasCrownsBan && isBan) || (!hasCrownsBan && !isBan)) {
            this.logger.info(`DB is already up-to-date, nothing to do.`);
            return;
        }
        if (!reason || reason == '') {
            if (message.reference?.messageId != null) {
                const referenceContents = (
                    await this.messageService.getChannelMessageByMessageId(
                        message.reference.messageId,
                        message.channel as GuildTextBasedChannel
                    )
                )?.content;
                if (referenceContents) reason = referenceContents;
                else this.logger.warn(`No reference content found for ${message.reference.messageId}`);
            } else
                await message.reply(
                    `Tip: If you add the reason for the ${isBan ? 'ban' : 'unban'} directly behind the command or reply to a message with the reason for the ban I will be able to log and display it later!`
                );
        }

        isBan
            ? await this.usersRepository.addCrownBanToUser(message.author.id, subjectId, reason)
            : await this.usersRepository.removeCrownsBanFromUser(subjectId);

        const subject = await this.memberService.fetchUser(subjectId);
        if (!subject) {
            await message.reply(
                `I could not find this Discord User. I've still ${isBan ? 'added' : 'removed'} the crowns ban flag.`
            );
            return;
        }
        await this.loggingService.logCrownsBan(message.author, subject, reason, message, !isBan);
    }

    private async handleLoginMessage(message: Message, userId: string, username: string) {
        const user = await this.memberService.fetchUser(userId);
        if (!user) {
            this.logger.info(`Could not find user with ID ${userId}, skipping login message.`);
            return;
        }
        this.logger.info(`User logged in with username '${username}', adding verification...`);

        await this.addVerification(message, user, username, 'User used `!login` command');
    }

    private async handleUsernameCommand(message: Message, args: string[]) {
        const userId = TextHelper.getDiscordUserId(args[0]);
        const user = userId ? await this.memberService.fetchUser(userId) : null;
        if (!user) {
            this.logger.info(`'${args[0]}' is not a Discord user ID, I am skipping this indexing.`);
            return;
        }

        await this.addVerification(message, user, args[1], 'Moderator used `!username` command');
    }

    private async addVerification(message: Message, subject: User, lastFmUsername: string, reason: string) {
        const indexedUser = await this.usersRepository.getUserByUserId(subject.id);

        // if user is already indexed, make sure the login isn't already the latest verification
        if (indexedUser) {
            const lastUsedLastFmUsername = indexedUser.verifications.sort((a, b) =>
                a.verifiedOn > b.verifiedOn ? -1 : 1
            )[0].username;
            if (lastUsedLastFmUsername == lastFmUsername.toLowerCase()) {
                this.logger.info(
                    `User ${TextHelper.userLog(subject)} latest verification is already for username ${lastFmUsername.toLowerCase()}. Skipping.`
                );
                return;
            }
        }

        let lastfmUser;
        try {
            lastfmUser = await this.lastFmClient.user.getInfo({ username: lastFmUsername });
        } catch (e) {
            if ((e as LastfmError).code == '6') {
                this.logger.info(
                    `Last.fm user with name '${lastFmUsername}' could not be found, I am not adding this verification.`
                );
            } else {
                this.logger.error('Last.fm returned an error that is not code 6 (not found)', e);
            }
            return;
        }

        const member = await this.memberService.getGuildMemberFromUserId(subject.id);
        const wk = await this.memberService.fetchUser(this.env.CORE.WHOKNOWS_USER_ID);
        const newVerification: Verification = {
            verificationMessage: message,
            lastfmUser: lastfmUser,
            discordAccountCreated: subject.createdTimestamp,
            isReturningUser: false,
            lastfmAccountCreated: lastfmUser.registered,
            verifiedUser: member!.user,
            verifyingUser: wk!,
        };
        !indexedUser
            ? await this.usersRepository.addUser(newVerification)
            : await this.usersRepository.addVerificationToUser(newVerification);
        await this.loggingService.logIndex(newVerification, reason);
    }
}
