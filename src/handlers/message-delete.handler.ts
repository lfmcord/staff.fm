import { Environment } from '@models/environment';
import { IHandler } from '@src/handlers/models/handler.interface';
import { CachingRepository } from '@src/infrastructure/repositories/caching.repository';
import { AuditService } from '@src/infrastructure/services/audit.service';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { Message, PartialMessage } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class MessageDeleteHandler implements IHandler {
    eventType = 'messageDelete';
    private logger: Logger<MessageDeleteHandler>;
    env: Environment;
    private auditService: AuditService;
    private loggingService: LoggingService;
    private memberService: MemberService;
    private cachingRepository: CachingRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<MessageDeleteHandler>,
        @inject(TYPES.CachingRepository) cachingRepository: CachingRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.AuditService) auditService: AuditService,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.env = env;
        this.auditService = auditService;
        this.loggingService = loggingService;
        this.memberService = memberService;
        this.cachingRepository = cachingRepository;
        this.logger = logger;
    }

    async handle(message: Message | PartialMessage) {
        if (message.guild?.id !== this.env.CORE.GUILD_ID) return;
        this.logger.info(`Message with message ID ${message.id} was deleted. Trying to fetch contents...`);
        const cachedMessage = await this.cachingRepository.getCachedMessage(message.id);
        if (!cachedMessage) {
            this.logger.info(`Deleted message in channel ID ${message.channelId} was not cached.`);
            return;
        }
        const actorId = await this.auditService.getDeletionActorIdForMessageAuthor(
            cachedMessage.authorId,
            cachedMessage.channelId
        );

        const author = await this.memberService.fetchUser(cachedMessage.authorId);
        let actor;
        if (actorId) actor = await this.memberService.fetchUser(actorId);
        await this.loggingService.logDeletedMessage(cachedMessage, author, actor ?? null);
        this.logger.info(`Logged deleted message with message ID ${message.id}.`);
    }
}
