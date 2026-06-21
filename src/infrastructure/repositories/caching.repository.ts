import { Environment } from '@models/environment';
import { EncryptionHelper } from '@src/infrastructure/encryption/encryption.helper';
import { CachedAttachmentModel } from '@src/infrastructure/repositories/models/cached-attachment.model';
import { CachedMessageModel } from '@src/infrastructure/repositories/models/cached-message.model';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import Redis from 'ioredis';
import { Logger } from 'tslog';

@injectable()
export class CachingRepository {
    redis: Redis;
    logger: Logger<CachingRepository>;
    env: Environment;
    encryption: EncryptionHelper;

    constructor(
        @inject(TYPES.Redis) redis: Redis,
        @inject(TYPES.InfrastructureLogger) logger: Logger<CachingRepository>,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.logger = logger;
        this.env = env;
        this.redis = redis;
        // Requires MISC.CACHE_ENCRYPTION_KEY to be added to the Environment model/config.
        this.encryption = new EncryptionHelper(this.env.MISC.CACHE_ENCRYPTION_KEY);
    }

    public async cacheMessage(message: Message) {
        await this.cacheMessageContents(message);
        await this.cacheLastUserMessage(message);
    }

    public async getCachedLastUserMessage(userId: string): Promise<number | null> {
        const timestamp = await this.redis.get(`LASTMESSAGE_${userId}`);
        return timestamp ? Number.parseInt(this.tryDecrypt(timestamp)) : null;
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
                const mimeType = this.tryDecrypt(attachmentMimeTypeAtIndex);
                this.logger.trace(`Found attachment at: ${attachmentKey} with MIME type ${mimeType}`);
                attachments.push({ data: this.tryDecryptBuffer(attachmentAtIndex), mimeType: mimeType });
                index++;
            } else break;
        } while (index);
        return {
            messageId: redisObj[0]!,
            authorId: this.tryDecrypt(redisObj[1]!),
            channelId: this.tryDecrypt(redisObj[2]!),
            contents: this.tryDecrypt(redisObj[3]!),
            attachments: attachments,
        };
    }

    private async cacheMessageContents(message: Message) {
        if (!message.channel) return;

        const keyV2 = `MESSAGECONTENTV2_${message.id}`;
        const valueV2 = {
            messageId: message.id,
            authorId: this.encryption.encrypt(message.author.id),
            channelId: this.encryption.encrypt(message.channel.id),
            contents: this.encryption.encrypt(message.content),
        };
        const responses: Response[] = [];
        for (const attachment of message.attachments.values()) {
            const response = await fetch(attachment.url);
            responses.push(response);
        }

        await this.redis.hset(keyV2, valueV2);
        await this.redis.expire(keyV2, this.env.MISC.MESSAGE_CACHING_DURATION_IN_SECONDS);
        this.logger.trace(`Stored ${keyV2} with ${responses.length} attachments (encrypted at rest).`);
        let index = 0;
        for (const response of responses) {
            const attachmentKey = 'attachment' + index;
            const attachmentTypeKey = 'attachmentType' + index;
            const buffer = Buffer.from(await response.arrayBuffer());
            const mimeType = response.headers.get('content-type');
            await this.redis.hset(keyV2, attachmentKey, this.encryption.encryptBuffer(buffer));
            await this.redis.expire(attachmentKey, this.env.MISC.MESSAGE_CACHING_DURATION_IN_SECONDS);
            await this.redis.hset(keyV2, attachmentTypeKey, this.encryption.encrypt(mimeType ?? 'image/jpg'));
            await this.redis.expire(attachmentTypeKey, this.env.MISC.MESSAGE_CACHING_DURATION_IN_SECONDS);

            this.logger.trace(
                `Stored ${attachmentKey} with buffer size ${buffer.length} and MIME type '${mimeType}' in ${keyV2}.`
            );
            index++;
        }
    }

    private async cacheLastUserMessage(message: Message) {
        const key = `LASTMESSAGE_${message.author.id}`;
        const value = this.encryption.encrypt(message.createdTimestamp.toString());
        await this.redis.set(key, value);
    }

    /** Decrypts a cached value, falling back to the raw value for legacy (unencrypted) entries. */
    private tryDecrypt(value: string): string {
        try {
            return this.encryption.decrypt(value);
        } catch {
            this.logger.trace(`Cached value is not encrypted (legacy); returning as-is.`);
            return value;
        }
    }

    /** Decrypts a cached buffer, falling back to the raw buffer for legacy (unencrypted) entries. */
    private tryDecryptBuffer(value: Buffer): Buffer {
        try {
            return this.encryption.decryptBuffer(value);
        } catch {
            this.logger.trace(`Cached buffer is not encrypted (legacy); returning as-is.`);
            return value;
        }
    }
}
