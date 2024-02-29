import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { connect } from 'mongoose';
import { Environment } from '@models/environment';

@injectable()
export class MongoDbConnector {
    private logger: Logger<MongoDbConnector>;
    env: Environment;
    constructor(
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.BotLogger) logger: Logger<MongoDbConnector>
    ) {
        this.env = env;
        this.logger = logger;
    }

    public async connect() {
        this.logger.debug('Trying to connect to Mongo DB...');
        await connect(this.env.DB_CONNECTION_STRING)
            .then(() => {
                this.logger.debug('Successfully connected to Mongo DB.');
            })
            .catch((error) => {
                this.logger.fatal('Unable to connect to Mongo DB.', error);
                process.exit(1);
            });
    }
}
