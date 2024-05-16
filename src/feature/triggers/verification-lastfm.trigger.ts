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
export class VerificationLastFmTrigger {
    logger: Logger<VerificationLastFmTrigger>;
    memberService: MemberService;
    usersRepository: UsersRepository;
    flagsRepository: FlagsRepository;
    env: Environment;
    lastFmClient: LastFM;
    loggingService: LoggingService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<VerificationLastFmTrigger>,
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
        const lastFmUsername = TextHelper.getLastfmUsername(message.content);

        // check if username is flagged
        this.logger.debug(`Checking if '${lastFmUsername?.toLowerCase() ?? message.content}' is in flagged terms list`);
        const flag = await this.flagsRepository.getFlagByTerm(lastFmUsername?.toLowerCase() ?? message.content);
        if (flag) {
            this.logger.info(`Verification message ${message.content} is exact match a flagged term (${flag.term})`);
            await this.loggingService.logLastFmFlagAlert(message, flag);
        } else {
            const flags = await this.flagsRepository.getAllFlags();
            for (const flag1 of flags) {
                if (message.content?.match(flag1.term)) {
                    this.logger.info(`Verification message ${message.content} contains a flagged term (${flag1.term})`);
                    await this.loggingService.logLastFmFlagAlert(message, flag1);
                    break;
                }
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

        // check if it's a returning user
        if (membersWithSameLastFm.length === 1 && membersWithSameLastFm[0].user.id === message.author.id) {
            const latestVerification = await this.usersRepository.getLatestVerificationOfUser(
                membersWithSameLastFm[0].user.id
            );
            this.logger.debug(
                `Member ${TextHelper.userLog(membersWithSameLastFm[0].user)} is using last.fm account '${latestVerification?.username}'`
            );
            await this.loggingService.logReturningUserNote(
                message.author,
                lastFmUsername,
                latestVerification?.username.toLowerCase() === lastFmUsername.toLowerCase()
            );
            return;
        }

        // log a warning if there's more than 1 other member that isn't a returning user
        if (membersWithSameLastFm.length > 1 || membersWithSameLastFm[0].user.id != message.author.id) {
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
                    if (memberOrId.user.id === message.member?.user.id) continue;
                    memberStrings.push(
                        `${inlineCode(memberOrId.user.username)} ${italic(`(ID ${memberOrId.user.id})`)}`
                    );
                }
            }
            await this.loggingService.logDuplicateLastFmUsername(message, memberStrings);
        }
    }
}
