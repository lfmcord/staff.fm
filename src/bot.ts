import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { Client } from 'discord.js';
import { connect } from 'mongoose';
import * as process from 'process';
import { TYPES } from '@src/types';

@injectable()
export class Bot {
    private logger: Logger<Bot>;
    private dbConnectionString: string;
    private token: string;
    //private client: Client;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<Bot>,
        @inject(TYPES.TOKEN) token: string,
        //@inject(TYPES.Client) client: Client,
        @inject(TYPES.DB_CONNECTION_STRING) dbConnectionString: string
    ) {
        this.dbConnectionString = dbConnectionString;
        this.token = token;
        //this.client = client;
        this.logger = logger;

        this.init().then(() => {
            this.logger.info('✅ Bot is ready!');
        });
    }

    private async init() {
        this.logger.info('Initializing bot...');

        await connect(this.dbConnectionString)
            .then(() => {
                this.logger.debug('Successfully connected to Mongo DB.');
            })
            .catch((error) => {
                this.logger.fatal('Unable to connect to Mongo DB.', error);
                process.exit(1);
            });
    }
}
