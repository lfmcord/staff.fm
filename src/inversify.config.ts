// organize-imports-ignore
// Don't reorder these imports because reflect-metadata needs to be imported before any classes that use it
import 'reflect-metadata';
import { Container } from 'inversify';
import { Client } from 'discord.js';
import { ILogObj, Logger } from 'tslog';
import { Bot } from '@src/bot';
import { TYPES } from '@src/types';

const container = new Container();

// ENVIRONMENT
container.bind<string>(TYPES.TOKEN).toConstantValue(process.env.TOKEN ?? '');
container.bind<string>(TYPES.LOG_LEVEL).toConstantValue(process.env.LOG_LEVEL ?? '');
container.bind<string>(TYPES.BOT_OWNER_ID).toConstantValue(process.env.BOT_OWNER_ID ?? '');
container.bind<string>(TYPES.GUILD_ID).toConstantValue(process.env.GUILD_ID ?? '');
container
    .bind<string>(TYPES.DB_CONNECTION_STRING)
    .toConstantValue(process.env.DB_CONNECTION_STRING ?? '');

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

export default container;
