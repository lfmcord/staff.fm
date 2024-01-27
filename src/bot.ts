import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { Client, Message, PartialMessage } from 'discord.js';
import { TYPES } from '@src/types';
import { IHandlerFactory } from '@src/handlers/models/handler-factory.interface';
import { MongoDbConnector } from '@src/infrastructure/connectors/mongo-db.connector';

@injectable()
export class Bot {
    private logger: Logger<Bot>;
    private mongoDbConnector: MongoDbConnector;
    private handlerFactory: IHandlerFactory;
    private readonly token: string;
    private client: Client;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<Bot>,
        @inject(TYPES.TOKEN) token: string,
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.HandlerFactory) handlerFactory: IHandlerFactory,
        @inject(TYPES.MongoDbConnector) mongoDbConnector: MongoDbConnector
    ) {
        this.mongoDbConnector = mongoDbConnector;
        this.handlerFactory = handlerFactory;
        this.token = token;
        this.client = client;
        this.logger = logger;

        this.logger.info('Initializing bot...');
        this.init().then(() => {
            this.logger.info('✅ Bot is ready!');
        });
    }

    private async init() {
        await this.mongoDbConnector.connect();
        this.listen();
        await this.client.login(this.token);
    }

    private listen(): void {
        this.client.on('messageCreate', async (message: Message) => {
            this.logger.trace(
                `Message ID ${message.id}: received\nAuthor ID: ${
                    message.author.id
                }\nContent length: ${message.content.length}\nContent: ${message.content.slice(0, 100)}`
            );

            if (message.guild) {
                await this.handlerFactory.createHandler('guildMessageCreate').handle(message);
            } else {
                await this.handlerFactory.createHandler('directMessageCreate').handle(message);
            }
        });

        this.client.on('messageDelete', async (message: Message | PartialMessage) => {
            this.logger.trace(
                `Message ID ${message.id} deleted\nAuthor ID: ${message.author?.id}\nContent length: ${message.content?.length}\nContent: ${message.content?.slice(
                    0,
                    100
                )}`
            );
            // handle message deletion
        });

        this.client.on('ready', async () => {
            await this.handlerFactory.createHandler('ready').handle(null);
        });
    }
}
