import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { connect } from 'mongoose';

@injectable()
export class MongoDbConnector {
    private mongoDbConnectionString: string;
    private logger: Logger<MongoDbConnector>;
    constructor(
        @inject(TYPES.DB_CONNECTION_STRING) mongoDbConnectionString: string,
        @inject(TYPES.BotLogger) logger: Logger<MongoDbConnector>
    ) {
        this.logger = logger;
        this.mongoDbConnectionString = mongoDbConnectionString;
    }

    public async connect() {
        this.logger.debug('Trying to connect to Mongo DB...');
        await connect(this.mongoDbConnectionString)
            .then(() => {
                this.logger.debug('Successfully connected to Mongo DB.');
            })
            .catch((error) => {
                this.logger.fatal('Unable to connect to Mongo DB.', error);
                process.exit(1);
            });
    }
}
