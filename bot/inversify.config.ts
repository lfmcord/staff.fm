// organize-imports-ignore
// Don't reorder these imports because reflect-metadata needs to be imported before any classes that use it
import 'reflect-metadata';
import { Container } from 'inversify';
import { Client, Partials } from 'discord.js';
import { ILogObj, Logger } from 'tslog';
import { Bot } from 'bot';
import { TYPES } from '@src/types';
import { PingCommand } from '@src/feature/commands/system/ping.command';
import { MessageCreateHandler } from '@src/handlers/message-create.handler';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { HelpCommand } from '@src/feature/commands/system/help.command';
import { IHandlerFactory } from '@src/handlers/models/handler-factory.interface';
import { HandlerFactory } from '@src/handlers/handler-factory';
import { IHandler } from '@src/handlers/models/handler.interface';
import { MongoDbConnector } from '@src/infrastructure/connectors/mongo-db.connector';
import { StaffMailCreateCommand } from '@src/feature/commands/staffmail/staff-mail-create.command';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { MessageService } from '@src/infrastructure/services/message.service';
import { SelfMutesRepository } from '@src/infrastructure/repositories/self-mutes.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import { SelfMuteCommand } from '@src/feature/commands/utility/self-mute.command';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { ReadyHandler } from '@src/handlers/ready.handler';
import { OkBuddyCommand } from '@src/feature/commands/fun/ok-buddy.command';
import { VerifyCommand } from '@src/feature/commands/utility/verify.command';
import LastFM from 'lastfm-typed';
import { GuildMemberAddHandler } from '@src/handlers/guild-member-add.handler';
import { RedisConnector } from '@src/infrastructure/connectors/redis.connector';
import { CachingRepository } from '@src/infrastructure/repositories/caching.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import Redis from 'ioredis';
import { MessageDeleteHandler } from '@src/handlers/message-delete.handler';
import { MuteRndRepository } from '@src/infrastructure/repositories/mute-rnd.repository';
import { MuteRndCommand } from '@src/feature/commands/fun/mute-rnd.command';
import { EventManagementCommand } from '@src/feature/commands/events/event-management.command';
import { IInteraction } from '@src/feature/interactions/abstractions/IInteraction.interface';
import { EventCreateInteraction } from '@src/feature/interactions/event-create.interaction';
import { InteractionCreateHandler } from '@src/handlers/interaction-create.handler';
import { StaffMailManagementCommand } from '@src/feature/commands/staffmail/staff-mail-management.command';
import { StaffMailContactCommand } from '@src/feature/commands/staffmail/staff-mail-contact.command';
import { StaffMailCloseCommand } from '@src/feature/commands/staffmail/staff-mail-close.command';
import { StaffMailCreateReportInteraction } from '@src/feature/interactions/staff-mail-create-report.interaction';
import { SelfMuteUnmuteCommand } from '@src/feature/commands/utility/self-mute-unmute.command';
import { StaffMailDmReply } from '@src/feature/staffmail/staff-mail-dm-reply';
import { StaffMailReplyCommand } from '@src/feature/commands/staffmail/staff-mail-reply.command';

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
container.bind<string>(TYPES.UNVERIFIED_ROLE_ID).toConstantValue(process.env.UNVERIFIED_ROLE_ID ?? '');
container.bind<string>(TYPES.USER_LOG_CHANNEL_ID).toConstantValue(process.env.USER_LOG_CHANNEL_ID ?? '');
container.bind<string>(TYPES.LASTFM_API_KEY).toConstantValue(process.env.LASTFM_API_KEY ?? '');
container.bind<string>(TYPES.LASTFM_SHARED_SECRET).toConstantValue(process.env.LASTFM_SHARED_SECRET ?? '');
container
    .bind<number>(TYPES.MESSAGE_CACHING_DURATION_IN_SECONDS)
    .toConstantValue(Number.parseInt(process.env.MESSAGE_CACHING_DURATION_IN_SECONDS ?? '86400') ?? 86400);
container
    .bind<string>(TYPES.DELETED_MESSAGE_LOG_CHANNEL_ID)
    .toConstantValue(process.env.DELETED_MESSAGE_LOG_CHANNEL_ID ?? '');

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
container.bind<Logger<ILogObj>>(TYPES.InfrastructureLogger).toConstantValue(
    new Logger({
        name: 'Infrastructure Runtime',
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
            'GuildIntegrations',
        ],
        partials: [Partials.Message, Partials.Channel],
    })
);
container.bind<LastFM>(TYPES.LastFmClient).toConstantValue(
    new LastFM(container.get<string>(TYPES.LASTFM_API_KEY), {
        apiSecret: container.get<string>(TYPES.LASTFM_SHARED_SECRET),
    })
);
container.bind<Redis>(TYPES.Redis).toConstantValue(new Redis());
container.bind<MongoDbConnector>(TYPES.MongoDbConnector).to(MongoDbConnector);
container.bind<RedisConnector>(TYPES.RedisConnector).to(RedisConnector);

// HANDLERS
container.bind<IHandlerFactory>(TYPES.HandlerFactory).to(HandlerFactory);
container.bind<IHandler>('Handler').to(MessageCreateHandler);
container.bind<IHandler>('Handler').to(GuildMemberAddHandler);
container.bind<IHandler>('Handler').to(ReadyHandler);
container.bind<IHandler>('Handler').to(MessageDeleteHandler);
container.bind<IHandler>('Handler').to(InteractionCreateHandler);

// COMMANDS
container.bind<ICommand>('Command').to(PingCommand);
container.bind<ICommand>('Command').to(HelpCommand);
container.bind<ICommand>('Command').to(SelfMuteCommand);
container.bind<ICommand>('Command').to(SelfMuteUnmuteCommand);
container.bind<ICommand>('Command').to(OkBuddyCommand);
container.bind<ICommand>('Command').to(VerifyCommand);
container.bind<ICommand>('Command').to(MuteRndCommand);
container.bind<ICommand>('Command').to(EventManagementCommand);
container.bind<ICommand>('Command').to(StaffMailManagementCommand);
container.bind<ICommand>('Command').to(StaffMailContactCommand);
container.bind<ICommand>('Command').to(StaffMailCloseCommand);
container.bind<ICommand>('Command').to(StaffMailCreateCommand);
container.bind<ICommand>('Command').to(StaffMailReplyCommand);

// STAFFMAIL
container.bind<StaffMailDmReply>(TYPES.StaffMailDmReply).to(StaffMailDmReply);

// INTERACTIONS
container.bind<IInteraction>('Interaction').to(EventCreateInteraction);
container.bind<IInteraction>('Interaction').to(StaffMailCreateReportInteraction);

// REPOSITORIES
container.bind<StaffMailRepository>(TYPES.StaffMailRepository).to(StaffMailRepository);
container.bind<SelfMutesRepository>(TYPES.SelfMutesRepository).to(SelfMutesRepository);
container.bind<CachingRepository>(TYPES.CachingRepository).to(CachingRepository);
container.bind<MuteRndRepository>(TYPES.MuteRndRepository).to(MuteRndRepository);

// SERVICES
container.bind<MessageService>(TYPES.MessageService).to(MessageService);
container.bind<MemberService>(TYPES.MemberService).to(MemberService);
container.bind<ScheduleService>(TYPES.ScheduleService).to(ScheduleService);
container.bind<ChannelService>(TYPES.ChannelService).to(ChannelService);
container.bind<LoggingService>(TYPES.LoggingService).to(LoggingService);

export default container;
