import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import Redis from 'ioredis';
import container from '../../inversify.config';
import { Environment } from '@models/environment';

@injectable()
export class RedisConnector {
    private logger: Logger<RedisConnector>;
    private env: Environment;

    constructor(@inject(TYPES.BotLogger) logger: Logger<RedisConnector>, @inject(TYPES.ENVIRONMENT) env: Environment) {
        this.env = env;
        this.logger = logger;
    }

    public async connect() {
        this.logger.debug('Trying to connect to Redis...');
        try {
            const redis = new Redis({ host: this.env.REDIS_HOST, port: this.env.REDIS_PORT });
            container.bind<Redis>(TYPES.Redis).toConstantValue(redis);
        } catch (error) {
            this.logger.fatal('Unable to connect to Redis.', error);
            process.exit(1);
        }
        this.logger.debug('Successfully connected to Redis.');
    }
}
