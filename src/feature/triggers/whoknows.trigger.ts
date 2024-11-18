import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import { GuildTextBasedChannel, Message } from 'discord.js';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TextHelper } from '@src/helpers/text.helper';
import { Environment } from '@models/environment';
import { MessageService } from '@src/infrastructure/services/message.service';
import { LastfmError } from '@models/lastfm-error.model';
import LastFM from 'lastfm-typed';
import { Verification } from '@src/feature/commands/administration/models/verification.model';

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
        this.logger.debug(`Checking if message starting with ! is a relevant WK command...`);

        const args = message.content.split(' ');
        if (
            (message.content.startsWith('!crowns') || message.content.startsWith('!cw')) &&
            (args[1] == 'ban' || args[1] == 'unban')
        )
            await this.handleCrownsCommand(message, args);

        if (message.content.startsWith('!login')) await this.handleLoginCommand(message, args.slice(1));
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
                    `If this is wrong, please use the \`${this.env.PREFIX}crowns ${isBan ? 'ban' : 'unban'}\` command.`
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

    private async handleLoginCommand(message: Message, args: string[]) {
        if (args.length == 0 || args[0].startsWith('[')) {
            this.logger.info(`'${args[0]}' is most likely not a valid last.fm name, skipping verification`);
            return;
        }
        const indexedUser = await this.usersRepository.getUserByUserId(message.author.id);
        if (!indexedUser) {
            this.logger.warn(
                `Cannot find indexed user for user ID ${message.author.id}, so I cannot add this login to their verifications`
            );
            return;
        }
        const lastUsedLastFmUsername = indexedUser.verifications.sort((a, b) =>
            a.verifiedOn > b.verifiedOn ? -1 : 1
        )[0].username;
        if (lastUsedLastFmUsername == args[0].toLowerCase()) {
            this.logger.info(
                `User ${TextHelper.userLog(message.author)} latest verification is already for username ${args[0].toLowerCase()}. Skipping.`
            );
            return;
        }

        let lastfmUser;
        try {
            lastfmUser = await this.lastFmClient.user.getInfo({ username: args[0] });
        } catch (e) {
            if ((e as LastfmError).code == '6') {
                this.logger.info(
                    `Last.fm user with name '${args[0]}' could not be found, I am not adding this verification.`
                );
            } else {
                this.logger.error('Last.fm returned an error that is not code 6 (not found)', e);
            }
            return;
        }

        const member = await this.memberService.getGuildMemberFromUserId(message.author.id);
        const wk = await this.memberService.fetchUser(this.env.WHOKNOWS_USER_ID);
        const newVerification: Verification = {
            verificationMessage: message,
            lastfmUser: lastfmUser,
            discordAccountCreated: message.author.createdTimestamp,
            isReturningUser: false,
            lastfmAccountCreated: lastfmUser.registered,
            verifiedUser: member!.user,
            verifyingUser: wk!,
        };
        await this.usersRepository.addVerificationToUser(newVerification);
        await this.loggingService.logVerification(newVerification);
    }
}
