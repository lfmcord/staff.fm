// organize-imports-ignore
// Don't reorder these imports because reflect-metadata needs to be imported before any classes that use it
import 'reflect-metadata';
import { Container } from 'inversify';
import { Client } from 'discord.js';
import { ILogObj, Logger } from 'tslog';
import { Bot } from '@src/bot';
import { TYPES } from '@src/types';
import { Ping } from '@commands/system/Ping';
import { MessageHandler } from '@src/handlers/MessageHandler';
import { ICommand } from '@commands/abstractions/ICommand';
import { Help } from '@commands/system/Help';

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
    })
);

// HANDLERS
container.bind<MessageHandler>(TYPES.MessageHandler).to(MessageHandler);

// COMMANDS
container.bind<ICommand>('Command').to(Ping);
container.bind<ICommand>('Command').to(Help);

export default container;
