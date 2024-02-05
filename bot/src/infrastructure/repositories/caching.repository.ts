import { inject, injectable } from 'inversify';
import Redis from 'ioredis';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { CachedMessageModel } from '@src/infrastructure/repositories/models/cached-message.model';

@injectable()
export class CachingRepository {
    redis: Redis;
    messageCachingDuration: number;
    constructor(
        @inject(TYPES.Redis) redis: Redis,
        @inject(TYPES.MESSAGE_CACHING_DURATION_IN_SECONDS) messageCachingDuration: number
    ) {
        this.messageCachingDuration = messageCachingDuration;
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
        const cachedMessage = await this.redis.get(`MESSAGECONTENT_${messageId}`);
        return cachedMessage ? (JSON.parse(cachedMessage) as CachedMessageModel) : null;
    }

    private async cacheMessageContents(message: Message) {
        const key = `MESSAGECONTENT_${message.id}`;
        const cache: CachedMessageModel = {
            userId: message.author.id,
            channelId: message.channel.id,
            contents: message.content,
            attachments: message.attachments.map((a) => a.url),
        };
        const value = JSON.stringify(cache);
        await this.redis.set(key, value);
        await this.redis.expire(key, this.messageCachingDuration);
    }

    private async cacheLastUserMessage(message: Message) {
        const key = `LASTMESSAGE_${message.author.id}`;
        const value = message.createdTimestamp;
        await this.redis.set(key, value);
    }
}
