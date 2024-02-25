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
import { StaffMailCreateModalSubmitInteraction } from '@src/feature/interactions/staff-mail-create-modal-submit.interaction';
import { SelfMuteUnmuteCommand } from '@src/feature/commands/utility/self-mute-unmute.command';
import { StaffMailDmReply } from '@src/feature/staffmail/staff-mail-dm-reply';
import { StaffMailReplyCommand } from '@src/feature/commands/staffmail/staff-mail-reply.command';
import { Environment } from '@models/environment';
import { AuditService } from '@src/infrastructure/services/audit.service';
import * as process from 'process';

const container = new Container();

// ENVIRONMENT
container.bind<Environment>(TYPES.ENVIRONMENT).toConstantValue({
    TOKEN: process.env.TOKEN ?? '',
    LASTFM_API_KEY: process.env.LASTFM_API_KEY ?? '',
    LASTFM_SHARED_SECRET: process.env.LASTFM_SHARED_SECRET ?? '',
    DB_CONNECTION_STRING: process.env.DB_CONNECTION_STRING ?? '',
    DB_ROOT_USER: process.env.DB_ROOT_USER ?? '',
    DB_ROOT_PASS: process.env.DB_ROOT_PASS ?? '',
    DB_ROOT_NAME: process.env.DB_ROOT_NAME ?? '',
    DB_USER: process.env.DB_USER ?? '',
    DB_PASS: process.env.DB_PASS ?? '',
    DB_NAME: process.env.DB_NAME ?? '',
    PREFIX: process.env.PREFIX ?? '',
    BOT_OWNER_ID: process.env.BOT_OWNER_ID ?? '',
    GUILD_ID: process.env.GUILD_ID ?? '',
    MUTED_ROLE_ID: process.env.MUTED_ROLE_ID ?? '',
    BACKSTAGER_ROLE_IDS: process.env.BACKSTAGER_ROLE_IDS?.split(',') ?? [],
    HELPER_ROLE_IDS: process.env.HELPER_ROLE_IDS?.split(',') ?? [],
    STAFF_ROLE_IDS: process.env.STAFF_ROLE_IDS?.split(',') ?? [],
    UNVERIFIED_ROLE_ID: process.env.UNVERIFIED_ROLE_ID ?? '',
    NO_LASTFM_ACCOUNT_ROLE_ID: process.env.NO_LASTFM_ACCOUNT_ROLE_ID ?? '',
    SCROBBLE_MILESTONE_ROLE_IDS: process.env.SCROBBLE_MILESTONE_ROLE_IDS?.split(',') ?? [],
    SCROBBLE_MILESTONE_NUMBERS:
        process.env.SCROBBLE_MILESTONE_NUMBERS?.split(',').map((n) => Number.parseInt(n ?? 0)) ?? [],
    STAFFMAIL_CATEGORY_ID: process.env.STAFFMAIL_CATEGORY_ID ?? '',
    STAFFMAIL_PING_ROLE_IDS: process.env.STAFFMAIL_PING_ROLE_IDS?.split(',') ?? [],
    STAFFMAIL_LOG_CHANNEL_ID: process.env.STAFFMAIL_LOG_CHANNEL_ID ?? '',
    SELFMUTE_LOG_CHANNEL_ID: process.env.SELFMUTE_LOG_CHANNEL_ID ?? '',
    USER_LOG_CHANNEL_ID: process.env.USER_LOG_CHANNEL_ID ?? '',
    DELETED_MESSAGE_LOG_CHANNEL_ID: process.env.DELETED_MESSAGE_LOG_CHANNEL_ID ?? '',
    DELETED_MESSAGE_LOG_EXCLUDED_CHANNEL_IDS: process.env.DELETED_MESSAGE_LOG_EXCLUDED_CHANNEL_IDS?.split(',') ?? [],
    LOG_LEVEL: Number.parseInt(process.env.LOG_LEVEL ?? '1') ?? 1,
    MESSAGE_CACHING_DURATION_IN_SECONDS:
        Number.parseInt(process.env.MESSAGE_CACHING_DURATION_IN_SECONDS ?? '86400') ?? 86400,
});

// CORE
container.bind<Logger<ILogObj>>(TYPES.BotLogger).toConstantValue(
    new Logger({
        name: 'Bot Runtime',
        minLevel: container.get<Environment>(TYPES.ENVIRONMENT).LOG_LEVEL,
        type: 'pretty',
    })
);
container.bind<Logger<ILogObj>>(TYPES.JobLogger).toConstantValue(
    new Logger({
        name: 'Job Runtime',
        minLevel: container.get<Environment>(TYPES.ENVIRONMENT).LOG_LEVEL,
        type: 'pretty',
    })
);
container.bind<Logger<ILogObj>>(TYPES.InfrastructureLogger).toConstantValue(
    new Logger({
        name: 'Infrastructure Runtime',
        minLevel: container.get<Environment>(TYPES.ENVIRONMENT).LOG_LEVEL,
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
    new LastFM(container.get<Environment>(TYPES.ENVIRONMENT).LASTFM_API_KEY, {
        apiSecret: container.get<Environment>(TYPES.ENVIRONMENT).LASTFM_SHARED_SECRET,
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
container.bind<IInteraction>('Interaction').to(StaffMailCreateModalSubmitInteraction);

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
container.bind<AuditService>(TYPES.AuditService).to(AuditService);

export default container;
