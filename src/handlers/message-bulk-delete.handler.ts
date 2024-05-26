import { IHandler } from '@src/handlers/models/handler.interface';
import { Logger } from 'tslog';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { AttachmentBuilder, Collection, Events, GuildTextBasedChannel, Message, PartialMessage } from 'discord.js';
import { CachingRepository } from '@src/infrastructure/repositories/caching.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { AuditService } from '@src/infrastructure/services/audit.service';
import { Environment } from '@models/environment';
import { Buffer } from 'buffer';
import * as moment from 'moment';

@injectable()
export class MessageBulkDeleteHandler implements IHandler {
    eventType = Events.MessageBulkDelete;
    private logger: Logger<MessageBulkDeleteHandler>;
    env: Environment;
    private auditService: AuditService;
    private loggingService: LoggingService;
    private memberService: MemberService;
    private cachingRepository: CachingRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<MessageBulkDeleteHandler>,
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
    async handle(deleteEvent: {
        messages: Collection<string, Message | PartialMessage>;
        channel: GuildTextBasedChannel;
    }) {
        this.logger.info(`Bulk delete in channel ${deleteEvent.channel.id}. Trying to fetch contents...`);
        let fetchedMessages = '';
        for (const message of deleteEvent.messages.values()) {
            const cachedMessage = await this.cachingRepository.getCachedMessage(message.id);
            if (cachedMessage) {
                this.logger.debug(`Deleted message in channel ID ${message.channelId} was cached.`);
                fetchedMessages += `[${cachedMessage.authorId}]: ${message.content}`;
                if (cachedMessage.attachments.length > 0) {
                    fetchedMessages += ` Attachments: ${cachedMessage.attachments.join(' ; ')}`;
                }
                fetchedMessages += '\n';
            }
        }
        const attachment = new AttachmentBuilder(Buffer.from(fetchedMessages, 'utf-8'), {
            name: `bulkdelete_${moment().utc().toDate().toISOString()}.txt`,
        });

        await this.loggingService.logBulkDelete(deleteEvent.messages.size, deleteEvent.channel.id, null, attachment);
        this.logger.info(`Logged bulk delete in channel ID ${deleteEvent.channel.id}.`);
    }
}
