import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { Client, Events, GuildMember, Interaction, InteractionType, Message, PartialMessage } from 'discord.js';
import { TYPES } from '@src/types';
import { IHandlerFactory } from '@src/handlers/models/handler-factory.interface';
import { MongoDbConnector } from '@src/infrastructure/connectors/mongo-db.connector';
import { TextHelper } from '@src/helpers/text.helper';
import { RedisConnector } from '@src/infrastructure/connectors/redis.connector';
import { Environment } from '@models/environment';

@injectable()
export class Bot {
    private logger: Logger<Bot>;
    redisConnector: RedisConnector;
    private mongoDbConnector: MongoDbConnector;
    private handlerFactory: IHandlerFactory;
    private readonly env: Environment;
    private client: Client;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<Bot>,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.HandlerFactory) handlerFactory: IHandlerFactory,
        @inject(TYPES.MongoDbConnector) mongoDbConnector: MongoDbConnector,
        @inject(TYPES.RedisConnector) redisConnector: RedisConnector
    ) {
        this.redisConnector = redisConnector;
        this.mongoDbConnector = mongoDbConnector;
        this.handlerFactory = handlerFactory;
        this.env = env;
        this.client = client;
        this.logger = logger;

        this.logger.info('Initializing bot...');
        this.init().then(() => {
            this.logger.info('✅ Bot is ready!');
        });
    }

    private async init() {
        await this.mongoDbConnector.connect();
        await this.redisConnector.connect();
        this.listen();
        await this.client.login(this.env.TOKEN);
    }

    private listen(): void {
        this.client.on('messageCreate', async (message: Message) => {
            this.logger.trace(
                `Message ID ${message.id}: received\nAuthor ID: ${
                    message.author.id
                }\nContent length: ${message.content.length}\nContent: ${message.content.slice(0, 100)}`
            );

            await this.handlerFactory.createHandler('messageCreate').handle(message);
        });

        this.client.on('messageDelete', async (message: Message | PartialMessage) => {
            this.logger.trace(JSON.stringify(message));
            this.logger.trace(
                `Message ID ${message.id} deleted\nAuthor ID: ${message.author?.id}\nContent length: ${message.content?.length}\nContent: ${message.content?.slice(
                    0,
                    100
                )}`
            );
            await this.handlerFactory.createHandler('messageDelete').handle(message);
        });

        this.client.on('guildMemberAdd', async (member: GuildMember) => {
            this.logger.info(`Guild Member ${TextHelper.userLog(member.user)} joined.`);
            await this.handlerFactory.createHandler('guildMemberAdd').handle(member);
        });

        this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
            this.logger.debug(
                `Message with message ID ${interaction.id} and type '${InteractionType[interaction.type]}' was created by ${TextHelper.userLog(interaction.user)}.`
            );
            await this.handlerFactory.createHandler(Events.InteractionCreate).handle(interaction);
        });

        this.client.on('ready', async () => {
            await this.handlerFactory.createHandler('ready').handle(null);
        });
    }
}
