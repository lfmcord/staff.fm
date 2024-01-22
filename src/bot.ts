import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { Client, Guild, Interaction, Message, PartialMessage } from 'discord.js';
import { connect } from 'mongoose';
import * as process from 'process';
import { TYPES } from '@src/types';
import { MessageHandler } from '@src/handlers/MessageHandler';

@injectable()
export class Bot {
    private logger: Logger<Bot>;
    private readonly token: string;
    private readonly prefix: string;
    private dbConnectionString: string;
    private client: Client;
    private messageHandler: MessageHandler;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<Bot>,
        @inject(TYPES.TOKEN) token: string,
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.DB_CONNECTION_STRING) dbConnectionString: string,
        @inject(TYPES.PREFIX) prefix: string,
        @inject(TYPES.MessageHandler) messageHandler: MessageHandler
    ) {
        this.dbConnectionString = dbConnectionString;
        this.token = token;
        this.client = client;
        this.logger = logger;
        this.prefix = prefix;
        this.messageHandler = messageHandler;

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

        this.listen();

        await this.client.login(this.token);
    }

    private listen(): void {
        this.client.on('guildCreate', async (guild: Guild) => {
            this.logger.info(`New Guild join event: ${guild.id} - ${guild.name}`);
            // handle new guild join
        });

        this.client.on('messageCreate', async (message: Message) => {
            this.logger.trace(
                `Message ID ${message.id}: received\nAuthor ID: ${
                    message.author.id
                }\nContent length: ${message.content.length}\nContent: ${message.content.slice(
                    0,
                    100
                )}`
            );

            if (message.content.startsWith(this.prefix)) {
                await this.messageHandler.handleMessageCreate(message);
            }

            // bot was mentioned
            if (
                message.content.startsWith(`<@${this.client.user?.id}>`) ||
                message.content.startsWith(`<@!${this.client.user?.id}>`)
            ) {
                // handle bot mention
            }
        });

        this.client.on('messageDelete', async (message: Message | PartialMessage) => {
            this.logger.trace(
                `Message ID ${message.id} deleted\nAuthor ID: ${message.author?.id}\nContent length: ${message.content?.length}\nContent: ${message.content?.slice(
                    0,
                    100
                )}`
            );

            // handle deletion
        });

        this.client.on('interactionCreate', async (interaction: Interaction) => {
            this.logger.trace(
                `Interaction ID ${interaction.id} created\nCreator: ${interaction.member}\nType: ${interaction.type}`
            );
            // handle interaction
        });

        this.client.on('ready', async () => {
            // restore past content
        });
    }
}
