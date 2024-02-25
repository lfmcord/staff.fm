import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import LastFM from 'lastfm-typed';
import { Message } from 'discord.js';
import { TextHelper } from '@src/helpers/text.helper';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import * as moment from 'moment';
import { Environment } from '@models/environment';

@injectable()
export class VerificationLastFmTrigger {
    logger: Logger<VerificationLastFmTrigger>;
    env: Environment;
    lastFmClient: LastFM;
    loggingService: LoggingService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<VerificationLastFmTrigger>,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.env = env;
        this.lastFmClient = lastFmClient;
        this.loggingService = loggingService;
        this.logger = logger;
    }

    async run(message: Message) {
        const lastFmUsername = TextHelper.getLastfmUsername(message.content);
        if (!lastFmUsername) return;
        const lastFmUser = await this.lastFmClient.user.getInfo({ username: lastFmUsername });
        if (!lastFmUsername) return;
        this.logger.trace(lastFmUser.country);

        const accountAgeInDays = moment().diff(moment.unix(lastFmUser.registered), 'days');
        if (accountAgeInDays <= this.env.LASTFM_AGE_ALERT_IN_DAYS) {
            this.logger.info(
                `Last.fm link in verification channel points to new last.fm account (Age: ${accountAgeInDays}d, alert threshold: ${this.env.LASTFM_AGE_ALERT_IN_DAYS}d)`
            );
            await this.loggingService.logLastFmAgeAlert(message, lastFmUser);
        }
        this.logger.info(
            `Last.fm link in verification channel is not a new account (Age: ${accountAgeInDays}d, alert threshold: ${this.env.LASTFM_AGE_ALERT_IN_DAYS}d)`
        );
    }
}
