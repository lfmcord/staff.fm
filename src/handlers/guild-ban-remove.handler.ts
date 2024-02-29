import { inject, injectable } from 'inversify';
import { IHandler } from '@src/handlers/models/handler.interface';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import { Events, GuildBan } from 'discord.js';
import { Environment } from '@models/environment';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { TextHelper } from '@src/helpers/text.helper';

@injectable()
export class GuildBanRemoveHandler implements IHandler {
    eventType = Events.GuildBanRemove;
    private readonly logger: Logger<GuildBanRemoveHandler>;
    flagsRepository: FlagsRepository;
    usersRepository: UsersRepository;
    env: Environment;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<GuildBanRemoveHandler>,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.FlagsRepository) flagsRepository: FlagsRepository
    ) {
        this.flagsRepository = flagsRepository;
        this.usersRepository = usersRepository;
        this.env = env;
        this.logger = logger;
    }

    async handle(ban: GuildBan) {
        const user = await this.usersRepository.getUserByUserId(ban.user.id);
        if (!user) {
            this.logger.info(
                `Cannot remove any flags for unbanned user ${TextHelper.userDisplay(ban.user)} because user is not indexed.`
            );
            return;
        }
        const usernamesToUnflag = user.verifications.map((v) => v.username);
        const deletedCount = await this.flagsRepository.deleteFlagsByTerms(usernamesToUnflag);
        this.logger.info(
            `Unflagged ${deletedCount} ${TextHelper.pluralize(`username`, deletedCount)}. Ran with usernames: ${usernamesToUnflag.join(', ')}`
        );
    }
}
