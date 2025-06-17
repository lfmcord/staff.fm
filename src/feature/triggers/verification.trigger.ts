import { Environment } from '@models/environment';
import { TextHelper } from '@src/helpers/text.helper';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { GuildMember, Message, User, italic } from 'discord.js';
import { inject, injectable } from 'inversify';
import LastFM from 'lastfm-typed';
import * as moment from 'moment';
import { Logger } from 'tslog';

@injectable()
export class VerificationTrigger {
    logger: Logger<VerificationTrigger>;
    memberService: MemberService;
    usersRepository: UsersRepository;
    flagsRepository: FlagsRepository;
    env: Environment;
    lastFmClient: LastFM;
    loggingService: LoggingService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<VerificationTrigger>,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.FlagsRepository) flagsRepository: FlagsRepository,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.flagsRepository = flagsRepository;
        this.env = env;
        this.lastFmClient = lastFmClient;
        this.loggingService = loggingService;
        this.logger = logger;
    }

    async run(message: Message) {
        if (message.content.startsWith(this.env.CORE.PREFIX)) return;

        const discordUsername = message.author.username.toLowerCase();
        const discordDisplayname = message.author.displayName.toLowerCase();
        const discordServerDisplayname = (
            await this.memberService.getGuildMemberFromUserId(message.author.id)
        )?.displayName.toLowerCase();
        const lastFmUsername = TextHelper.getLastfmUsername(message.content)?.toLowerCase();

        const flaggedTerms = await this.flagsRepository.getAllFlagTerms();

        this.logger.info(
            `Checking if new message or author is in flagged terms list. Last.fm username: ${lastFmUsername} Discord Username: ${discordUsername} Discord Displayname: ${discordDisplayname} Discord Server Displayname: ${discordServerDisplayname}`
        );
        for (const flaggedTerm of flaggedTerms) {
            // check if last.fm username is flagged
            if (message.content?.toLowerCase().match(flaggedTerm)) {
                this.logger.info(`Verification message ${message.content} contains a flagged term (${flaggedTerm})`);
                const flag = await this.flagsRepository.getFlagByTerm(flaggedTerm);
                if (!flag) {
                    this.logger.warn(`Flag for term ${flaggedTerm} not found in database.`);
                    continue;
                }
                await this.loggingService.logLastFmFlagAlert(message, flag);
                return;
            }
            // check if discord username is flagged
            if (this.memberService.checkIfMemberIsFlagged(flaggedTerm, message.author)) {
                this.logger.info(`User ${TextHelper.userLog(message.author)} matches flagged term ${flaggedTerm}`);
                const flag = await this.flagsRepository.getFlagByTerm(flaggedTerm);
                if (!flag) {
                    this.logger.warn(`Flag for term ${flaggedTerm} not found in database.`);
                    continue;
                }
                await this.loggingService.logDiscordFlagAlert(message, flag);
                return;
            }
        }

        if (!lastFmUsername) return;

        let lastFmUser;
        try {
            lastFmUser = await this.lastFmClient.user.getInfo({ username: lastFmUsername });
        } catch (e) {
            this.logger.info(`Couldn't find last.fm user for username ${lastFmUsername}.`);
            return;
        }
        if (!lastFmUsername) return;
        this.logger.trace(lastFmUser.country);

        // check for account age
        const accountAgeInDays = moment().diff(moment.unix(lastFmUser.registered), 'days');
        if (accountAgeInDays <= this.env.MISC.LASTFM_AGE_ALERT_IN_DAYS) {
            this.logger.info(
                `Last.fm link in verification channel points to new last.fm account (Age: ${accountAgeInDays}d, alert threshold: ${this.env.MISC.LASTFM_AGE_ALERT_IN_DAYS}d)`
            );
            await this.loggingService.logLastFmAgeAlert(message, lastFmUser);
        }
        this.logger.debug(
            `Last.fm link in verification channel is not a new account (Age: ${accountAgeInDays}d, alert threshold: ${this.env.MISC.LASTFM_AGE_ALERT_IN_DAYS}d)`
        );

        const usersWithSameLastFm = await Promise.all(
            (await this.usersRepository.getUsersByLastFmUsername(lastFmUsername)).map(
                async (user) =>
                    (await this.memberService.getGuildMemberFromUserId(user.userId)) ??
                    (await this.memberService.fetchUser(user.userId))
            )
        );
        if (usersWithSameLastFm.length == 0) {
            this.logger.info(`No other users using the last.fm username ${lastFmUsername}`);
            return;
        }
        this.logger.info(
            `There are ${usersWithSameLastFm.length} other users with this lastfm username (${lastFmUsername}).`
        );

        const membersWithSameLastFm: GuildMember[] = usersWithSameLastFm
            .filter((m) => m instanceof GuildMember)
            .map((m) => m as GuildMember);
        this.logger.debug(`${membersWithSameLastFm.length} other guild members with this account.`);

        // if there are other users on Discord using the same last.fm that are not in the server, log an info
        if (membersWithSameLastFm.length == 1 && membersWithSameLastFm[0].user.id == message.author.id) {
            this.logger.debug(`Member in server with same last.fm is message author, welcome back!`);
            const returningMember = membersWithSameLastFm[0];
            const latestVerification = await this.usersRepository.getLatestVerificationOfUser(returningMember.user.id);
            await this.loggingService.logReturningUserNote(
                message.author,
                lastFmUsername,
                latestVerification?.username.toLowerCase() !== lastFmUsername.toLowerCase()
            );
            return;
        }

        // If there are other members in the server using the same last.fm, log a warning
        if (membersWithSameLastFm.length >= 1) {
            this.logger.debug(
                `Member in server with same last.fm is not message author or there are multiple members!`
            );
            const memberStrings: string[] = [];
            for (const memberOrUser of usersWithSameLastFm) {
                if (memberOrUser == null) continue;
                const isMember = memberOrUser instanceof GuildMember;
                let line = `${TextHelper.userDisplay(isMember ? memberOrUser.user : memberOrUser, isMember)}`;
                if (!isMember) line += ` ${italic(`- not in server`)}`;
                memberStrings.push(line);
            }
            await this.loggingService.logDuplicateLastFmUsername(message, memberStrings);
            return;
        }

        // no other members in the server but other users use this last.fm, log a returning user info
        this.logger.debug(`No other members in server, fetching other Discord users.`);
        await this.loggingService.logReturningUserNote(
            message.author,
            lastFmUsername,
            false,
            usersWithSameLastFm.filter((u) => u instanceof User && u.id != message.author.id).map((u) => u as User)
        );
    }
}
