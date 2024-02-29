import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import Redis from 'ioredis';
import container from '../../inversify.config';

@injectable()
export class RedisConnector {
    private logger: Logger<RedisConnector>;
    constructor(@inject(TYPES.BotLogger) logger: Logger<RedisConnector>) {
        this.logger = logger;
    }

    public async connect() {
        this.logger.debug('Trying to connect to Redis...');
        try {
            const redis = new Redis();
            container.bind<Redis>(TYPES.Redis).toConstantValue(redis);
        } catch (error) {
            this.logger.fatal('Unable to connect to Redis.', error);
            process.exit(1);
        }
        this.logger.debug('Successfully connected to Redis.');
    }
}
