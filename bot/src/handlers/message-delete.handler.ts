import { IHandler } from '@src/handlers/models/handler.interface';
import { Logger } from 'tslog';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { Message, PartialMessage } from 'discord.js';
import { CachingRepository } from '@src/infrastructure/repositories/caching.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { LoggingService } from '@src/infrastructure/services/logging.service';

@injectable()
export class MessageDeleteHandler implements IHandler {
    eventType = 'messageDelete';
    private logger: Logger<MessageDeleteHandler>;
    private loggingService: LoggingService;
    private memberService: MemberService;
    cachingRepository: CachingRepository;
    constructor(
        @inject(TYPES.BotLogger) logger: Logger<MessageDeleteHandler>,
        @inject(TYPES.CachingRepository) cachingRepository: CachingRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.loggingService = loggingService;
        this.memberService = memberService;
        this.cachingRepository = cachingRepository;
        this.logger = logger;
    }
    async handle(message: Message | PartialMessage) {
        this.logger.info(`Message with message ID ${message.id} was deleted. Trying to fetch contents...`);
        const cachedMessage = await this.cachingRepository.getCachedMessage(message.id);
        if (!cachedMessage) {
            this.logger.info(`Deleted message was too old and cannot be fetched.`);
            return;
        }

        const author = await this.memberService.getGuildMemberFromUserId(cachedMessage.userId);
        await this.loggingService.logDeletedMessage(cachedMessage, author);
    }
}
