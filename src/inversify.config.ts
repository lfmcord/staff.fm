// organize-imports-ignore
// Don't reorder these imports because reflect-metadata needs to be imported before any classes that use it
import 'reflect-metadata';
import { Container } from 'inversify';
import { Client, Partials } from 'discord.js';
import { ILogObj, Logger } from 'tslog';
import { Bot } from './bot';
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
import { VerifyCommand } from '@src/feature/commands/administration/verify.command';
import LastFM from 'lastfm-typed';
import { GuildMemberAddHandler } from '@src/handlers/guild-member-add.handler';
import { RedisConnector } from '@src/infrastructure/connectors/redis.connector';
import { CachingRepository } from '@src/infrastructure/repositories/caching.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import Redis from 'ioredis';
import { MessageDeleteHandler } from '@src/handlers/message-delete.handler';
import { MuteRndRepository } from '@src/infrastructure/repositories/mute-rnd.repository';
import { MuteRndCommand } from '@src/feature/commands/fun/mute-rnd.command';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { InteractionCreateHandler } from '@src/handlers/interaction-create.handler';
import { StaffMailManagementCommand } from '@src/feature/commands/staffmail/staff-mail-management.command';
import { StaffMailContactCommand } from '@src/feature/commands/staffmail/staff-mail-contact.command';
import { StaffMailCloseCommand } from '@src/feature/commands/staffmail/staff-mail-close.command';
import { StaffMailCreateModalSubmitInteraction } from '@src/feature/interactions/modal-submit/staff-mail-create-modal-submit.interaction';
import { SelfMuteUnmuteCommand } from '@src/feature/commands/utility/self-mute-unmute.command';
import { StaffMailDmTrigger } from '@src/feature/triggers/staff-mail-dm.trigger';
import { StaffMailReplyCommand } from '@src/feature/commands/staffmail/staff-mail-reply.command';
import { Environment } from '@models/environment';
import { AuditService } from '@src/infrastructure/services/audit.service';
import * as process from 'process';
import { VerificationTrigger } from '@src/feature/triggers/verification.trigger';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { FlagCommand } from '@src/feature/commands/moderation/flag.command';
import { FlagsCommand } from '@src/feature/commands/moderation/flags.command';
import { UnflagCommand } from '@src/feature/commands/moderation/unflag.command';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { GuildBanAddHandler } from '@src/handlers/guild-ban-add.handler';
import { GuildBanRemoveHandler } from '@src/handlers/guild-ban-remove.handler';
import { WhoisCommand } from '@src/feature/commands/administration/whois.command';
import { StaffMailCreateButtonInteraction } from '@src/feature/interactions/message-component/staff-mail-create-button.interaction';
import { StaffMailCreateUrgentReportButtonInteraction } from '@src/feature/interactions/message-component/staff-mail-create-urgentreport-button.interaction';
import { StaffMailCreateModalShowInteraction } from '@src/feature/interactions/message-component/staff-mail-create-modal-show.interaction';
import { IModalSubmitInteraction } from '@src/feature/interactions/abstractions/modal-submit-interaction.interface';
import { IMessageContextMenuInteraction } from '@src/feature/interactions/abstractions/message-context-menu-interaction.interface';
import { VerifyContextMenuInteraction } from '@src/feature/interactions/message-context-menu/verify-context-menu.interaction';
import { CommandService } from '@src/infrastructure/services/command.service';
import { ApiRouter } from '@src/api/api-router';
import { UserController } from '@src/api/user.controller';
import { IApiRouter } from '@src/api/abstraction/api-router.interface';
import { MessageUpdateHandler } from '@src/handlers/message-update.handler';
import { MessageBulkDeleteHandler } from '@src/handlers/message-bulk-delete.handler';
import { StaffMailReportCommand } from '@src/feature/commands/staffmail/staff-mail-report.command';
import { StaffMailReportInteraction } from '@src/feature/interactions/message-context-menu/staff-mail-report.interaction';
import { CrownsCommand } from '@src/feature/commands/administration/crowns.command';
import { CrownsBanHasCommand } from '@src/feature/commands/administration/crownsban-has.command';
import { WhoknowsTrigger } from '@src/feature/triggers/whoknows.trigger';
import { ImportsCommand } from '@src/feature/commands/administration/imports.command';
import { VerifyRemoveCommand } from '@src/feature/commands/administration/verify-remove.command';
import { VerifyRemoveInteraction } from '@src/feature/interactions/message-component/verify-remove.interaction';
import { VerifyDismissPlaycountWarningInteraction } from '@src/feature/interactions/message-component/verify-dismiss-playcount-warning.interaction';
import { IsInactiveCommand } from '@src/feature/commands/administration/is-inactive.command';
import { SetInactiveCommand } from '@src/feature/commands/administration/set-inactive.command';
import { SetActiveCommand } from '@src/feature/commands/administration/set-active.command';
import { DiscussionsRepository } from '@src/infrastructure/repositories/discussions.repository';
import { DiscussionsTopicCommand } from '@src/feature/commands/administration/discussions/discussions-topic.command';
import { DiscussionsTopicRemoveInteraction } from '@src/feature/interactions/message-component/discussions-topic-remove.interaction';
import { DiscussionsTrigger } from '@src/feature/triggers/discussions.trigger';
import { DiscussionsManageCommand } from '@src/feature/commands/administration/discussions/discussions-manage.command';
import { IndexCommand } from '@src/feature/commands/administration/index.command';
import { LastFmService } from '@src/infrastructure/services/lastfm.service';
import { UpdateCommand } from '@src/feature/commands/utility/update.command';

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
    ADMIN_ROLE_IDS: process.env.ADMIN_ROLE_IDS?.split(',') ?? [],
    MODERATOR_ROLE_IDS: process.env.MODERATOR_ROLE_IDS?.split(',') ?? [],
    UNVERIFIED_ROLE_ID: process.env.UNVERIFIED_ROLE_ID ?? '',
    NO_LASTFM_ACCOUNT_ROLE_ID: process.env.NO_LASTFM_ACCOUNT_ROLE_ID ?? '',
    SCROBBLE_MILESTONE_ROLE_IDS: process.env.SCROBBLE_MILESTONE_ROLE_IDS?.split(',') ?? [],
    SCROBBLE_MILESTONE_NUMBERS:
        process.env.SCROBBLE_MILESTONE_NUMBERS?.split(',').map((n) => Number.parseInt(n ?? 0)) ?? [],
    VERIFICATION_CHANNEL_ID: process.env.VERIFICATION_CHANNEL_ID ?? '',
    BACKSTAGE_CHANNEL_ID: process.env.BACKSTAGE_CHANNEL_ID ?? '',
    STAFFMAIL_CATEGORY_ID: process.env.STAFFMAIL_CATEGORY_ID ?? '',
    STAFFMAIL_PING_ROLE_IDS: process.env.STAFFMAIL_PING_ROLE_IDS?.split(',') ?? [],
    STAFFMAIL_LOG_CHANNEL_ID: process.env.STAFFMAIL_LOG_CHANNEL_ID ?? '',
    SELFMUTE_LOG_CHANNEL_ID: process.env.SELFMUTE_LOG_CHANNEL_ID ?? '',
    USER_LOG_CHANNEL_ID: process.env.USER_LOG_CHANNEL_ID ?? '',
    DELETED_MESSAGE_LOG_CHANNEL_ID: process.env.DELETED_MESSAGE_LOG_CHANNEL_ID ?? '',
    DELETED_MESSAGE_LOG_EXCLUDED_CHANNEL_IDS: process.env.DELETED_MESSAGE_LOG_EXCLUDED_CHANNEL_IDS?.split(',') ?? [],
    LASTFM_AGE_ALERT_IN_DAYS: parseInt(process.env.LASTFM_AGE_ALERT_IN_DAYS || '30', 10),
    LOG_LEVEL: parseInt(process.env.LOG_LEVEL ?? '1') ?? 1,
    MESSAGE_CACHING_DURATION_IN_SECONDS: parseInt(process.env.MESSAGE_CACHING_DURATION_IN_SECONDS || '86400', 10),
    REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT || '6380', 10),
    SELFMUTED_ROLE_ID: process.env.SELFMUTED_ROLE_ID ?? '',
    WHOKNOWS_USER_ID: process.env.WHOKNOWS_USER_ID ?? '',
    CROWNS_LOG_CHANNEL_ID: process.env.CROWNS_LOG_CHANNEL_ID ?? '',
    INACTIVE_ROLE_ID: process.env.INACTIVE_ROLE_ID ?? '',
    DISCUSSIONS_CHANNEL_ID: process.env.DISCUSSIONS_CHANNEL_ID ?? '',
    HELPERS_CHANNEL_ID: process.env.HELPERS_CHANNEL_ID ?? '',
    DISCUSSIONS_AUTO_INTERVAL_IN_DAYS: parseInt(process.env.DISCUSSIONS_AUTO_INTERVAL_IN_DAYS || '2', 10),
    DISCUSSIONS_PING_ROLE_ID: process.env.DISCUSSIONS_PING_ROLE_ID ?? '',
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
container.bind<Logger<ILogObj>>(TYPES.ApiLogger).toConstantValue(
    new Logger({
        name: 'API',
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
container.bind<Redis>(TYPES.Redis).toConstantValue(
    new Redis({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number.parseInt(process.env.REDIS_PORT ?? '6380') ?? 6380,
    })
);
container.bind<MongoDbConnector>(TYPES.MongoDbConnector).to(MongoDbConnector);
container.bind<RedisConnector>(TYPES.RedisConnector).to(RedisConnector);
container.bind<IApiRouter>(TYPES.ApiRouter).to(ApiRouter).inSingletonScope();

// HANDLERS
container.bind<IHandlerFactory>(TYPES.HandlerFactory).to(HandlerFactory);
container.bind<IHandler>('Handler').to(MessageCreateHandler);
container.bind<IHandler>('Handler').to(GuildMemberAddHandler);
container.bind<IHandler>('Handler').to(ReadyHandler);
container.bind<IHandler>('Handler').to(MessageDeleteHandler);
container.bind<IHandler>('Handler').to(InteractionCreateHandler);
container.bind<IHandler>('Handler').to(GuildBanAddHandler);
container.bind<IHandler>('Handler').to(GuildBanRemoveHandler);
container.bind<IHandler>('Handler').to(MessageUpdateHandler);
container.bind<IHandler>('Handler').to(MessageBulkDeleteHandler);

// COMMANDS
container.bind<ICommand>('Command').to(PingCommand);
container.bind<ICommand>('Command').to(HelpCommand);
container.bind<ICommand>('Command').to(SelfMuteCommand);
container.bind<ICommand>('Command').to(SelfMuteUnmuteCommand);
container.bind<ICommand>('Command').to(OkBuddyCommand);
container.bind<ICommand>('Command').to(VerifyCommand);
container.bind<ICommand>('Command').to(MuteRndCommand);
container.bind<ICommand>('Command').to(StaffMailManagementCommand);
container.bind<ICommand>('Command').to(StaffMailContactCommand);
container.bind<ICommand>('Command').to(StaffMailCloseCommand);
container.bind<ICommand>('Command').to(StaffMailCreateCommand);
container.bind<ICommand>('Command').to(StaffMailReplyCommand);
container.bind<ICommand>('Command').to(FlagCommand);
container.bind<ICommand>('Command').to(FlagsCommand);
container.bind<ICommand>('Command').to(UnflagCommand);
container.bind<ICommand>('Command').to(WhoisCommand);
container.bind<ICommand>('Command').to(StaffMailReportCommand);
container.bind<ICommand>('Command').to(ImportsCommand);
container.bind<ICommand>('Command').to(CrownsCommand);
container.bind<ICommand>('Command').to(CrownsBanHasCommand);
container.bind<ICommand>('Command').to(VerifyRemoveCommand);
container.bind<ICommand>('Command').to(IsInactiveCommand);
container.bind<ICommand>('Command').to(SetInactiveCommand);
container.bind<ICommand>('Command').to(SetActiveCommand);
container.bind<ICommand>('Command').to(DiscussionsTopicCommand);
container.bind<ICommand>('Command').to(DiscussionsManageCommand);
container.bind<ICommand>('Command').to(IndexCommand);
container.bind<ICommand>('Command').to(UpdateCommand);

// TRIGGERS
container.bind<StaffMailDmTrigger>(TYPES.StaffMailDmTrigger).to(StaffMailDmTrigger);
container.bind<VerificationTrigger>(TYPES.VerificationLastFmTrigger).to(VerificationTrigger);
container.bind<WhoknowsTrigger>(TYPES.WhoknowsTrigger).to(WhoknowsTrigger);
container.bind<DiscussionsTrigger>(TYPES.DiscussionsTrigger).to(DiscussionsTrigger);

// INTERACTIONS
container.bind<IModalSubmitInteraction>('ModalSubmitInteraction').to(StaffMailCreateModalSubmitInteraction);
container.bind<IMessageComponentInteraction>('MessageComponentInteraction').to(StaffMailCreateButtonInteraction);
container
    .bind<IMessageComponentInteraction>('MessageComponentInteraction')
    .to(StaffMailCreateUrgentReportButtonInteraction);
container.bind<IMessageComponentInteraction>('MessageComponentInteraction').to(StaffMailCreateModalShowInteraction);
container.bind<IMessageContextMenuInteraction>('MessageContextMenuInteraction').to(VerifyContextMenuInteraction);
container.bind<IMessageContextMenuInteraction>('MessageContextMenuInteraction').to(StaffMailReportInteraction);
container.bind<IMessageComponentInteraction>('MessageComponentInteraction').to(VerifyRemoveInteraction);
container
    .bind<IMessageComponentInteraction>('MessageComponentInteraction')
    .to(VerifyDismissPlaycountWarningInteraction);
container.bind<IMessageComponentInteraction>('MessageComponentInteraction').to(DiscussionsTopicRemoveInteraction);

// REPOSITORIES
container.bind<StaffMailRepository>(TYPES.StaffMailRepository).to(StaffMailRepository);
container.bind<SelfMutesRepository>(TYPES.SelfMutesRepository).to(SelfMutesRepository);
container.bind<CachingRepository>(TYPES.CachingRepository).to(CachingRepository).inSingletonScope();
container.bind<MuteRndRepository>(TYPES.MuteRndRepository).to(MuteRndRepository);
container.bind<FlagsRepository>(TYPES.FlagsRepository).to(FlagsRepository);
container.bind<UsersRepository>(TYPES.UsersRepository).to(UsersRepository);
container.bind<DiscussionsRepository>(TYPES.DiscussionsRepository).to(DiscussionsRepository);

// SERVICES
container.bind<MessageService>(TYPES.MessageService).to(MessageService);
container.bind<MemberService>(TYPES.MemberService).to(MemberService);
container.bind<ScheduleService>(TYPES.ScheduleService).to(ScheduleService);
container.bind<ChannelService>(TYPES.ChannelService).to(ChannelService);
container.bind<LoggingService>(TYPES.LoggingService).to(LoggingService);
container.bind<AuditService>(TYPES.AuditService).to(AuditService);
container.bind<CommandService>(TYPES.CommandService).to(CommandService);
container.bind<LastFmService>(TYPES.LastFmService).to(LastFmService);

// CONTROLLERS
container.bind<UserController>(TYPES.UserController).to(UserController);

export default container;
