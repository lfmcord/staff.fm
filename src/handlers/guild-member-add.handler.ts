import { inject, injectable } from 'inversify';
import { IHandler } from '@src/handlers/models/handler.interface';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import { GuildMember } from 'discord.js';

@injectable()
export class GuildMemberAddHandler implements IHandler {
    private readonly logger: Logger<GuildMemberAddHandler>;
    unverifiedRoleId: string;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<GuildMemberAddHandler>,
        @inject(TYPES.UNVERIFIED_ROLE_ID) unverifiedRoleId: string
    ) {
        this.unverifiedRoleId = unverifiedRoleId;
        this.logger = logger;
    }

    async handle(member: GuildMember) {
        try {
            await member.roles.add(this.unverifiedRoleId);
            this.logger.info(`Added Unverified role to new guild member.`);
        } catch (e) {
            this.logger.warn(`Could not add Unverified role to new guild member.`, e);
        }
    }
}
