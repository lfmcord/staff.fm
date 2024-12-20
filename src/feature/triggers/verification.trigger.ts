import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import LastFM from 'lastfm-typed';
import { GuildMember, inlineCode, italic, Message } from 'discord.js';
import { TextHelper } from '@src/helpers/text.helper';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import * as moment from 'moment';
import { Environment } from '@models/environment';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { MemberService } from '@src/infrastructure/services/member.service';

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
        if (message.content.startsWith(this.env.PREFIX)) return;

        const discordUsername = message.author.username.toLowerCase();
        const discordDisplayname = message.author.displayName.toLowerCase();
        const discordServerDisplayname = (
            await this.memberService.getGuildMemberFromUserId(message.author.id)
        )?.displayName.toLowerCase();
        const lastFmUsername = TextHelper.getLastfmUsername(message.content)?.toLowerCase();

        const flags = await this.flagsRepository.getAllFlags();

        this.logger.info(
            `Checking if new message or author is in flagged terms list. Last.fm username: ${lastFmUsername} Discord Username: ${discordUsername} Discord Displayname: ${discordDisplayname} Discord Server Displayname: ${discordServerDisplayname}`
        );
        for (const flag of flags) {
            // check if last.fm username is flagged
            if (message.content?.match(flag.term)) {
                this.logger.info(`Verification message ${message.content} contains a flagged term (${flag.term})`);
                await this.loggingService.logLastFmFlagAlert(message, flag);
                return;
            }
            // check if discord username is flagged
            if (this.memberService.checkIfMemberIsFlagged(flag, message.author)) {
                this.logger.info(`User ${TextHelper.userLog(message.author)} matches flagged term ${flag.term}`);
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
        if (accountAgeInDays <= this.env.LASTFM_AGE_ALERT_IN_DAYS) {
            this.logger.info(
                `Last.fm link in verification channel points to new last.fm account (Age: ${accountAgeInDays}d, alert threshold: ${this.env.LASTFM_AGE_ALERT_IN_DAYS}d)`
            );
            await this.loggingService.logLastFmAgeAlert(message, lastFmUser);
        }
        this.logger.debug(
            `Last.fm link in verification channel is not a new account (Age: ${accountAgeInDays}d, alert threshold: ${this.env.LASTFM_AGE_ALERT_IN_DAYS}d)`
        );

        const usersWithSameLastFm = await Promise.all(
            (await this.usersRepository.getUsersByLastFmUsername(lastFmUsername)).map(
                async (user) => (await this.memberService.getGuildMemberFromUserId(user.userId)) ?? user.userId
            )
        );
        const membersWithSameLastFm: GuildMember[] = usersWithSameLastFm.filter((m): m is GuildMember => m !== null);
        this.logger.debug(`${membersWithSameLastFm.length} other guild members with this account.`);
        if (membersWithSameLastFm.length === 0) {
            this.logger.info(`No other members for username '${lastFmUsername}'`);
            return;
        }

        // check if it's a returning user
        const returningUser = membersWithSameLastFm.find((m) => m.user.id === message.author.id);
        if (returningUser && membersWithSameLastFm.length === 1) {
            const latestVerification = await this.usersRepository.getLatestVerificationOfUser(returningUser.user.id);
            this.logger.debug(
                `Member ${TextHelper.userLog(returningUser.user)} is using last.fm account '${lastFmUsername}' vs lastfm username in database '${latestVerification?.username}'`
            );
            await this.loggingService.logReturningUserNote(
                message.author,
                lastFmUsername,
                latestVerification?.username.toLowerCase() === lastFmUsername.toLowerCase()
            );
            return;
        }

        // log a warning if there's more than 1 other member that isn't a returning user
        this.logger.info(
            `There are ${usersWithSameLastFm.length} other users with this lastfm username (${lastFmUsername}).`
        );
        const memberStrings: string[] = [];
        for (const memberOrId of usersWithSameLastFm) {
            if (memberOrId instanceof String) {
                this.logger.debug(`${memberOrId} is not in guild.`);
                memberStrings.push(`${inlineCode('unknown')} ${italic(`(ID ${memberOrId}) - not in server`)}`);
            } else if (memberOrId instanceof GuildMember) {
                this.logger.debug(`${memberOrId?.user?.id} is in guild.`);
                if (memberOrId && memberOrId.user.id === message.member?.user.id) continue;
                memberStrings.push(`${TextHelper.userDisplay(memberOrId.user)}`);
            }
        }
        await this.loggingService.logDuplicateLastFmUsername(message, memberStrings);
    }
}
