import { inject, injectable } from 'inversify';
import Redis from 'ioredis';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { CachedMessageModel } from '@src/infrastructure/repositories/models/cached-message.model';
import { Environment } from '@models/environment';
import { Logger } from 'tslog';
import { CachedAttachmentModel } from '@src/infrastructure/repositories/models/cached-attachment.model';

@injectable()
export class CachingRepository {
    redis: Redis;
    logger: Logger<CachingRepository>;
    env: Environment;
    constructor(
        @inject(TYPES.Redis) redis: Redis,
        @inject(TYPES.InfrastructureLogger) logger: Logger<CachingRepository>,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.logger = logger;
        this.env = env;
        this.redis = redis;
    }

    public async cacheMessage(message: Message) {
        await this.cacheMessageContents(message);
        await this.cacheLastUserMessage(message);
    }

    public async getCachedLastUserMessage(userId: string): Promise<number | null> {
        const timestamp = await this.redis.get(`LASTMESSAGE_${userId}`);
        return timestamp ? Number.parseInt(timestamp) : null;
    }

    public async getCachedMessage(messageId: string): Promise<CachedMessageModel | null> {
        const cachedMessage = await this.getCachedMessageV2(messageId);
        return cachedMessage ? cachedMessage : await this.getCachedMessageV1(messageId);
    }

    private async getCachedMessageV1(messageId: string): Promise<CachedMessageModel | null> {
        const keyV1 = `MESSAGECONTENT_${messageId}`;
        this.logger.trace(`Trying to get ${keyV1}`);
        this.logger.debug(`Retrieving messagecontent v1...`);
        const value = await this.redis.get(keyV1);
        return value ? JSON.parse(value) : null;
    }

    private async getCachedMessageV2(messageId: string): Promise<CachedMessageModel | null> {
        const keyV2 = `MESSAGECONTENTV2_${messageId}`;
        this.logger.trace(`Trying to get ${keyV2}`);
        const cachedMessage: CachedMessageModel = {
            messageId: messageId,
            authorId: '',
            channelId: '',
            contents: '',
            attachments: [],
        };
        const redisObj = await this.redis.hmget(keyV2, ...Object.keys(cachedMessage));
        this.logger.trace(redisObj);

        if (redisObj.length == 0 || redisObj[0] == null) return null;

        const attachments: CachedAttachmentModel[] = [];
        let index = 0;
        do {
            const attachmentKey = 'attachment' + index;
            const attachmentTypeKey = 'attachmentType' + index;
            this.logger.trace(`Trying to find attachment at: ${attachmentKey}`);
            const attachmentAtIndex = await this.redis.hgetBuffer(keyV2, attachmentKey);
            const attachmentMimeTypeAtIndex = await this.redis.hget(keyV2, attachmentTypeKey);
            if (attachmentAtIndex && attachmentMimeTypeAtIndex) {
                this.logger.trace(`Found attachment at: ${attachmentKey} with MIME type ${attachmentMimeTypeAtIndex}`);
                attachments.push({ data: attachmentAtIndex, mimeType: attachmentMimeTypeAtIndex });
                index++;
            } else break;
        } while (index);
        return {
            messageId: redisObj[0]!,
            authorId: redisObj[1]!,
            channelId: redisObj[2]!,
            contents: redisObj[3]!,
            attachments: attachments,
        };
    }

    private async cacheMessageContents(message: Message) {
        if (!message.channel) return;

        const keyV2 = `MESSAGECONTENTV2_${message.id}`;
        const valueV2 = {
            messageId: message.id,
            authorId: message.author.id,
            channelId: message.channel.id,
            contents: message.content,
        };
        const responses: Response[] = [];
        for (const attachment of message.attachments.values()) {
            const response = await fetch(attachment.url);
            responses.push(response);
        }

        await this.redis.hset(keyV2, valueV2);
        await this.redis.expire(keyV2, this.env.MESSAGE_CACHING_DURATION_IN_SECONDS);
        this.logger.trace(`Stored ${keyV2} with value ${JSON.stringify(valueV2)} and ${responses.length} attachments.`);
        let index = 0;
        for (const response of responses) {
            const attachmentKey = 'attachment' + index;
            const attachmentTypeKey = 'attachmentType' + index;
            const buffer = Buffer.from(await response.arrayBuffer());
            const mimeType = response.headers.get('content-type');
            await this.redis.hset(keyV2, attachmentKey, buffer);
            await this.redis.expire(attachmentKey, this.env.MESSAGE_CACHING_DURATION_IN_SECONDS);
            await this.redis.hset(keyV2, attachmentTypeKey, mimeType ?? 'image/jpg');
            await this.redis.expire(attachmentTypeKey, this.env.MESSAGE_CACHING_DURATION_IN_SECONDS);

            this.logger.trace(
                `Stored ${attachmentKey} with buffer size ${buffer.length} and MIME type '${mimeType}' in ${keyV2}.`
            );
            index++;
        }
    }

    private async cacheLastUserMessage(message: Message) {
        const key = `LASTMESSAGE_${message.author.id}`;
        const value = message.createdTimestamp;
        await this.redis.set(key, value);
    }
}
