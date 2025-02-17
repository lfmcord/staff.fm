import { inject, injectable } from 'inversify';
import { AuditLogEvent, Client } from 'discord.js';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { Environment } from '@models/environment';
import { LastfmError } from '@models/lastfm-error.model';
import LastFM from 'lastfm-typed';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { getInfo } from 'lastfm-typed/dist/interfaces/userInterface';

@injectable()
export class LastFmService {
    private client: Client;
    logger: Logger<LastFmService>;
    private environment: Environment;
    private usersRepository: UsersRepository;
    private lastFmClient: LastFM;

    constructor(
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.ENVIRONMENT) environment: Environment,
        @inject(TYPES.InfrastructureLogger) logger: Logger<LastFmService>,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository
    ) {
        this.logger = logger;
        this.environment = environment;
        this.client = client;
        this.lastFmClient = lastFmClient;
        this.usersRepository = usersRepository;
    }

    /**
     * Retrieves Last.fm user information based on the provided user ID.
     * This method checks the latest verification for the user and fetches their Last.fm user details.
     *
     * @param {string} userId - The ID of the user for whom Last.fm information is to be retrieved.
     * @return {Promise<getInfo | undefined | null>} A promise that resolves to the Last.fm user information,
     *         undefined if last.fm user cannot be found, or null if the user is not indexed.
     */
    async getLastFmUserByUserId(userId: string): Promise<getInfo | undefined | null> {
        const latestVerification = await this.usersRepository.getLatestVerificationOfUser(userId);
        if (!latestVerification) return null;
        let lastfmUser;
        try {
            lastfmUser = await this.lastFmClient.user.getInfo({ username: latestVerification.username });
        } catch (e) {
            if ((e as LastfmError).code == '6') {
                this.logger.warn(`Last.fm user with name '${latestVerification.username}' could not be found.`);
            } else {
                this.logger.error('Last.fm returned an error that is not code 6 (not found)', e);
                throw Error(`Last.fm API returned an error.`);
            }
        }
        return lastfmUser;
    }
}
