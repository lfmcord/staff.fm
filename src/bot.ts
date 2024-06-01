import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import {
    ActivityType,
    Client,
    Collection,
    Events,
    GuildBan,
    GuildMember,
    GuildTextBasedChannel,
    Interaction,
    InteractionType,
    Message,
    PartialMessage,
    REST,
    Routes,
} from 'discord.js';
import { TYPES } from '@src/types';
import { IHandlerFactory } from '@src/handlers/models/handler-factory.interface';
import { MongoDbConnector } from '@src/infrastructure/connectors/mongo-db.connector';
import { TextHelper } from '@src/helpers/text.helper';
import { RedisConnector } from '@src/infrastructure/connectors/redis.connector';
import { Environment } from '@models/environment';
import container from '@src/inversify.config';
import { IMessageContextMenuInteraction } from '@src/feature/interactions/abstractions/message-context-menu-interaction.interface';
import { ApiRouter } from '@src/api/api-router';

@injectable()
export class Bot {
    private logger: Logger<Bot>;
    apiRouter: ApiRouter;
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
        @inject(TYPES.RedisConnector) redisConnector: RedisConnector,
        @inject(TYPES.ApiRouter) apiRouter: ApiRouter
    ) {
        this.apiRouter = apiRouter;
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
        this.apiListen();
        await this.client.login(this.env.TOKEN);
        await this.registerInteractions();
    }

    private listen(): void {
        this.client.on('messageCreate', async (message: Message) => {
            this.logger.trace(
                `Message ID ${message.id}: received\nAuthor ID: ${
                    message.author.id
                }\nContent length: ${message.content.length}\nContent: ${message.content.slice(0, 100)}`
            );
            try {
                await this.handlerFactory.createHandler('messageCreate').handle(message);
            } catch (e) {
                this.logger.fatal(
                    `Unhandled exception while trying to handle Message Create on message with ID ${message.id} ("${message.content.substring(0, 50)}") by author ${message.author?.username}`,
                    e
                );
            }
        });

        this.client.on('messageDelete', async (message: Message | PartialMessage) => {
            this.logger.trace(JSON.stringify(message));
            this.logger.trace(
                `Message ID ${message.id} deleted\nAuthor ID: ${message.author?.id}\nContent length: ${message.content?.length}\nContent: ${message.content?.slice(
                    0,
                    100
                )}`
            );
            try {
                await this.handlerFactory.createHandler('messageDelete').handle(message);
            } catch (e) {
                this.logger.fatal(`Unhandled exception while trying to handle Message Delete`, e);
            }
        });

        this.client.on(
            Events.MessageBulkDelete,
            async (messages: Collection<string, Message | PartialMessage>, channel: GuildTextBasedChannel) => {
                try {
                    await this.handlerFactory.createHandler(Events.MessageBulkDelete).handle({ messages, channel });
                } catch (e) {
                    this.logger.fatal(`Unhandled exception while trying to handle Message Bulk Delete`, e);
                }
            }
        );

        this.client.on('guildMemberAdd', async (member: GuildMember) => {
            this.logger.info(`Guild Member ${TextHelper.userLog(member.user)} joined.`);
            try {
                await this.handlerFactory.createHandler('guildMemberAdd').handle(member);
            } catch (e) {
                this.logger.fatal(`Unhandled exception while trying to handle Guild Member Add`, e);
            }
        });

        this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
            this.logger.debug(
                `Message with message ID ${interaction.id} and type '${InteractionType[interaction.type]}' was created by ${TextHelper.userLog(interaction.user)}.`
            );
            try {
                await this.handlerFactory.createHandler(Events.InteractionCreate).handle(interaction);
            } catch (e) {
                this.logger.fatal(`Unhandled exception while trying to handle Interaction Create`, e);
            }
        });

        this.client.on(Events.GuildBanAdd, async (ban: GuildBan) => {
            this.logger.info(`New ban on user with user ID ${ban.user.id} with reason ${ban.reason}.`);
            try {
                await this.handlerFactory.createHandler(Events.GuildBanAdd).handle(ban);
            } catch (e) {
                this.logger.fatal(`Unhandled exception while trying to handle Guild Ban Add`, e);
            }
        });

        this.client.on(Events.GuildBanRemove, async (ban: GuildBan) => {
            this.logger.info(`New unban for user with user ID ${ban.user.id}.`);
            try {
                await this.handlerFactory.createHandler(Events.GuildBanRemove).handle(ban);
            } catch (e) {
                this.logger.fatal(`Unhandled exception while trying to handle Guild Ban Remove`, e);
            }
        });

        this.client.on(
            Events.MessageUpdate,
            async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
                if (oldMessage.content == newMessage.content || !oldMessage) return;
                this.logger.debug(`New edited message with ID ${newMessage.id}.`);
                try {
                    await this.handlerFactory.createHandler(Events.MessageUpdate).handle({ oldMessage, newMessage });
                } catch (e) {
                    this.logger.fatal(`Unhandled exception while trying to handle Message Update`, e);
                }
            }
        );

        this.client.on('ready', async () => {
            try {
                await this.handlerFactory.createHandler('ready').handle(null);
                this.client.user?.setActivity({
                    name: `DM ${this.env.PREFIX}staffmail to contact staff!`,
                    type: ActivityType.Playing,
                });
            } catch (e) {
                this.logger.fatal(`Unhandled exception while trying to handle Ready`, e);
            }
        });
    }

    private apiListen(): void {
        this.apiRouter.listen();
    }

    private async registerInteractions() {
        const messageContextMenuInteractions = container.getAll<IMessageContextMenuInteraction>(
            'MessageContextMenuInteraction'
        );
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const jsonObjects: any[] = []; // discord.js does not expose this fuckass type
        for (const messageContextMenuInteraction of messageContextMenuInteractions) {
            jsonObjects.push(messageContextMenuInteraction.data.toJSON());
        }

        const rest = new REST().setToken(this.env.TOKEN);
        this.logger.info(`Registering ${jsonObjects.length} interaction commands...`);
        try {
            await rest.put(Routes.applicationGuildCommands(this.client.user!.id, this.env.GUILD_ID), {
                body: jsonObjects,
            });
        } catch (e) {
            this.logger.error(`Failed to register interaction commands`, e);
            return;
        }
        this.logger.info(`Registered ${jsonObjects.length} interaction commands.`);
    }
}
