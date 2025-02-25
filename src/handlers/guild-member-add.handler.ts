import { Environment } from '@models/environment';
import { IHandler } from '@src/handlers/models/handler.interface';
import { TYPES } from '@src/types';
import { GuildMember } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class GuildMemberAddHandler implements IHandler {
    eventType = 'guildMemberAdd';
    private readonly logger: Logger<GuildMemberAddHandler>;
    env: Environment;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<GuildMemberAddHandler>,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.env = env;
        this.logger = logger;
    }

    async handle(member: GuildMember) {
        try {
            await member.roles.add(this.env.ROLES.UNVERIFIED_ROLE_ID);
            this.logger.info(`Added Unverified role to new guild member.`);
        } catch (e) {
            this.logger.warn(`Could not add Unverified role to new guild member.`, e);
        }
    }
}
