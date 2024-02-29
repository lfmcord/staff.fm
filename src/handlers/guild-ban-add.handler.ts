import { inject, injectable } from 'inversify';
import { IHandler } from '@src/handlers/models/handler.interface';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import { Client, Events, GuildBan } from 'discord.js';
import { Environment } from '@models/environment';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { TextHelper } from '@src/helpers/text.helper';

@injectable()
export class GuildBanAddHandler implements IHandler {
    eventType = Events.GuildBanAdd;
    private readonly logger: Logger<GuildBanAddHandler>;
    client: Client;
    flagsRepository: FlagsRepository;
    usersRepository: UsersRepository;
    env: Environment;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<GuildBanAddHandler>,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.FlagsRepository) flagsRepository: FlagsRepository,
        @inject(TYPES.Client) client: Client
    ) {
        this.client = client;
        this.flagsRepository = flagsRepository;
        this.usersRepository = usersRepository;
        this.env = env;
        this.logger = logger;
    }

    async handle(ban: GuildBan) {
        const user = await this.usersRepository.getUserByUserId(ban.user.id);
        if (!user) {
            this.logger.info(`Cannot flag any last.fm accounts for ban evasion as user is not indexed.`);
            return;
        }

        for (const verification of user.verifications) {
            const flag = await this.flagsRepository.getFlagByTerm(verification.username);
            if (flag) {
                this.logger.info(`Last.fm username ${verification.username} is already flagged.`);
                continue;
            }

            this.logger.info(
                `Flagging username '${verification.username}' of banned user ${TextHelper.userLog(ban.user)}`
            );

            await this.flagsRepository.addFlag(verification.username, 'Ban evasion', this.client.user!);
        }
    }
}
