import { inject, injectable } from 'inversify';
import Redis from 'ioredis';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { CachedMessageModel } from '@src/infrastructure/repositories/models/cached-message.model';
import { Environment } from '@models/environment';

@injectable()
export class CachingRepository {
    redis: Redis;
    env: Environment;
    constructor(@inject(TYPES.Redis) redis: Redis, @inject(TYPES.ENVIRONMENT) env: Environment) {
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
        const cachedMessage = await this.redis.get(`MESSAGECONTENT_${messageId}`);
        return cachedMessage ? (JSON.parse(cachedMessage) as CachedMessageModel) : null;
    }

    private async cacheMessageContents(message: Message) {
        if (!message.channel) return;
        const key = `MESSAGECONTENT_${message.id}`;
        const cache: CachedMessageModel = {
            messageId: message.id,
            authorId: message.author.id,
            channelId: message.channel.id,
            contents: message.content,
            attachments: message.attachments.map((a) => a.url),
        };
        const value = JSON.stringify(cache);
        await this.redis.set(key, value);
        await this.redis.expire(key, this.env.MESSAGE_CACHING_DURATION_IN_SECONDS);
    }

    private async cacheLastUserMessage(message: Message) {
        const key = `LASTMESSAGE_${message.author.id}`;
        const value = message.createdTimestamp;
        await this.redis.set(key, value);
    }
}