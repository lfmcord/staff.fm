import { Environment } from '@models/environment';
import { TYPES } from '@src/types';
import { AuditLogEvent, Client } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class AuditService {
    private client: Client;
    logger: Logger<AuditService>;
    private environment: Environment;

    constructor(
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.ENVIRONMENT) environment: Environment,
        @inject(TYPES.InfrastructureLogger) logger: Logger<AuditService>
    ) {
        this.logger = logger;
        this.environment = environment;
        this.client = client;
    }

    public async getDeletionActorIdForMessageAuthor(
        messageAuthorId: string,
        channelId: string
    ): Promise<string | null> {
        const guild = await this.client.guilds.fetch(this.environment.CORE.GUILD_ID);
        const auditLog = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 });
        return (
            auditLog.entries.find((log) => log.targetId === messageAuthorId && log.extra.channel.id === channelId)
                ?.executorId ?? null
        );
    }
}
