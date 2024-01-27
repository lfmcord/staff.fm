// organize-imports-ignore
// Don't reorder these imports because reflect-metadata needs to be imported before any classes that use it
import 'reflect-metadata';
import { Container } from 'inversify';
import { Client, Partials } from 'discord.js';
import { ILogObj, Logger } from 'tslog';
import { Bot } from '@src/bot';
import { TYPES } from '@src/types';
import { PingCommand } from '@src/feature/commands/system/ping.command';
import { GuildMessageHandler } from '@src/handlers/guild-message.handler';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { HelpCommand } from '@src/feature/commands/system/help.command';
import { DirectMessageHandler } from '@src/handlers/direct-message.handler';
import { IHandlerFactory } from '@src/handlers/models/handler-factory.interface';
import { HandlerFactory } from '@src/handlers/handler-factory';
import { IHandler } from '@src/handlers/models/handler.interface';
import { MongoDbConnector } from '@src/infrastructure/connectors/mongo-db.connector';
import { StaffMailCreate } from '@src/feature/staffmail/staff-mail-create';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { MessageService } from '@src/infrastructure/services/message.service';
import { SelfMutesRepository } from '@src/infrastructure/repositories/self-mutes.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import { SelfMuteCommand } from '@src/feature/commands/utility/self-mute.command';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { ReadyHandler } from '@src/handlers/ready.handler';

const container = new Container();

// ENVIRONMENT
container.bind<string>(TYPES.TOKEN).toConstantValue(process.env.TOKEN ?? '');
container.bind<string>(TYPES.LOG_LEVEL).toConstantValue(process.env.LOG_LEVEL ?? '');
container.bind<string>(TYPES.BOT_OWNER_ID).toConstantValue(process.env.BOT_OWNER_ID ?? '');
container.bind<string>(TYPES.GUILD_ID).toConstantValue(process.env.GUILD_ID ?? '');
container.bind<string>(TYPES.DB_CONNECTION_STRING).toConstantValue(process.env.DB_CONNECTION_STRING ?? '');
container.bind<string>(TYPES.PREFIX).toConstantValue(process.env.PREFIX ?? '');
container.bind<string>(TYPES.STAFFMAIL_CATEGORY_ID).toConstantValue(process.env.STAFFMAIL_CATEGORY_ID ?? '');
container.bind<string>(TYPES.STAFFMAIL_LOG_CHANNEL_ID).toConstantValue(process.env.STAFFMAIL_LOG_CHANNEL_ID ?? '');
container.bind<string>(TYPES.MUTED_ROLE_ID).toConstantValue(process.env.MUTED_ROLE_ID ?? '');
container.bind<string>(TYPES.SELFMUTE_LOG_CHANNEL_ID).toConstantValue(process.env.SELFMUTE_LOG_CHANNEL_ID ?? '');
container.bind<string[]>(TYPES.BACKSTAGER_ROLE_IDS).toConstantValue(process.env.BACKSTAGER_ROLE_IDS?.split(',') ?? []);
container.bind<string[]>(TYPES.HELPER_ROLE_IDS).toConstantValue(process.env.HELPER_ROLE_IDS?.split(',') ?? []);
container.bind<string[]>(TYPES.STAFF_ROLE_IDS).toConstantValue(process.env.STAFF_ROLE_IDS?.split(',') ?? []);

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
container.bind<IHandler>(TYPES.ReadyHandler).to(ReadyHandler);

// COMMANDS
container.bind<ICommand>('Command').to(PingCommand);
container.bind<ICommand>('Command').to(HelpCommand);
container.bind<ICommand>('Command').to(SelfMuteCommand);

// STAFFMAIL
container.bind<StaffMailCreate>(TYPES.StaffMailCreate).to(StaffMailCreate);

// REPOSITORIES
container.bind<StaffMailRepository>(TYPES.StaffMailRepository).to(StaffMailRepository);
container.bind<SelfMutesRepository>(TYPES.SelfMutesRepository).to(SelfMutesRepository);

// SERVICES
container.bind<MessageService>(TYPES.MessageService).to(MessageService);
container.bind<MemberService>(TYPES.MemberService).to(MemberService);
container.bind<ScheduleService>(TYPES.ScheduleService).to(ScheduleService);
container.bind<ChannelService>(TYPES.ChannelService).to(ChannelService);

export default container;
