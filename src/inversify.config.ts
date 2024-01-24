// organize-imports-ignore
// Don't reorder these imports because reflect-metadata needs to be imported before any classes that use it
import 'reflect-metadata';
import { Container } from 'inversify';
import { Client, Partials } from 'discord.js';
import { ILogObj, Logger } from 'tslog';
import { Bot } from '@src/bot';
import { TYPES } from '@src/types';
import { Ping } from '@src/feature/commands/system/Ping';
import { GuildMessageHandler } from '@src/handlers/GuildMessageHandler';
import { ICommand } from '@src/feature/commands/models/ICommand';
import { Help } from '@src/feature/commands/system/Help';
import { DirectMessageHandler } from '@src/handlers/DirectMessageHandler';
import { IHandlerFactory } from '@src/handlers/models/IHandlerFactory';
import { HandlerFactory } from '@src/handlers/HandlerFactory';
import { IHandler } from '@src/handlers/models/IHandler';
import { MongoDbConnector } from '@src/infrastructure/connectors/MongoDbConnector';
import { StaffMailCreate } from '@src/feature/staffmail/StaffMailCreate';
import { StaffMailRepository } from '@src/infrastructure/repositories/StaffMailRepository';
import { MessageService } from '@src/infrastructure/services/MessageService';

const container = new Container();

// ENVIRONMENT
container.bind<string>(TYPES.TOKEN).toConstantValue(process.env.TOKEN ?? '');
container.bind<string>(TYPES.LOG_LEVEL).toConstantValue(process.env.LOG_LEVEL ?? '');
container.bind<string>(TYPES.BOT_OWNER_ID).toConstantValue(process.env.BOT_OWNER_ID ?? '');
container.bind<string>(TYPES.GUILD_ID).toConstantValue(process.env.GUILD_ID ?? '');
container
    .bind<string>(TYPES.DB_CONNECTION_STRING)
    .toConstantValue(process.env.DB_CONNECTION_STRING ?? '');
container.bind<string>(TYPES.PREFIX).toConstantValue(process.env.PREFIX ?? '');
container
    .bind<string>(TYPES.STAFFMAIL_CATEGORY_ID)
    .toConstantValue(process.env.STAFFMAIL_CATEGORY_ID ?? '');
container
    .bind<string>(TYPES.STAFFMAIL_LOG_CHANNEL_ID)
    .toConstantValue(process.env.STAFFMAIL_LOG_CHANNEL_ID ?? '');

// CORE
container.bind<Logger<ILogObj>>(TYPES.BotLogger).toConstantValue(
    new Logger({
        name: 'Bot Runtime',
        minLevel: container.get<number>(TYPES.LOG_LEVEL),
        type: 'pretty',
    })
);
container.bind<Logger<ILogObj>>(TYPES.JobLogger).toConstantValue(
    new Logger({
        name: 'Job Runtime',
        minLevel: container.get<number>(TYPES.LOG_LEVEL),
        type: 'pretty',
    })
);
container.bind<Bot>(TYPES.Bot).to(Bot).inSingletonScope();
container.bind<Client>(TYPES.Client).toConstantValue(
    new Client({
        intents: [
            'GuildMessages',
            'GuildMessageTyping',
            'GuildMessageReactions',
            'GuildMembers',
            'GuildBans',
            'GuildModeration',
            'Guilds',
            'DirectMessages',
            'DirectMessageReactions',
            'MessageContent',
        ],
        partials: [Partials.Message, Partials.Channel],
    })
);
container.bind<MongoDbConnector>(TYPES.MongoDbConnector).to(MongoDbConnector);

// HANDLERS
container.bind<IHandlerFactory>(TYPES.HandlerFactory).to(HandlerFactory);
container.bind<IHandler>(TYPES.GuildMessageHandler).to(GuildMessageHandler);
container.bind<IHandler>(TYPES.DirectMessageHandler).to(DirectMessageHandler);

// COMMANDS
container.bind<ICommand>('Command').to(Ping);
container.bind<ICommand>('Command').to(Help);

// STAFFMAIL
container.bind<StaffMailCreate>(TYPES.StaffMailCreate).to(StaffMailCreate);

// REPOSITORIES
container.bind<StaffMailRepository>(TYPES.StaffMailRepository).to(StaffMailRepository);

// SERVICES
container.bind<MessageService>(TYPES.MessageService).to(MessageService);

export default container;
