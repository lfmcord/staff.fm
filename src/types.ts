export const TYPES = {
    // ENVIRONMENT
    TOKEN: Symbol('TOKEN'),
    LOG_LEVEL: Symbol('LOG_LEVEL'),
    BOT_OWNER_ID: Symbol('BOT_OWNER_ID'),
    GUILD_ID: Symbol('GUILD_ID'),
    DB_CONNECTION_STRING: Symbol('DB_CONNECTION_STRING'),
    PREFIX: Symbol('PREFIX'),
    STAFFMAIL_CATEGORY_ID: Symbol('STAFFMAIL_CATEGORY_ID'),
    STAFFMAIL_LOG_CHANNEL_ID: Symbol('STAFFMAIL_LOG_CHANNEL_ID'),
    MUTED_ROLE_ID: Symbol('MUTED_ROLE_ID'),
    SELFMUTE_LOG_CHANNEL_ID: Symbol('SELFMUTE_LOG_CHANNEL_ID'),
    BACKSTAGER_ROLE_IDS: Symbol('BACKSTAGER_ROLE_IDS'),
    HELPER_ROLE_IDS: Symbol('HELPER_ROLE_IDS'),
    STAFF_ROLE_IDS: Symbol('STAFF_ROLE_IDS'),
    UNVERIFIED_ROLE_ID: Symbol('UNVERIFIED_ROLE_ID'),
    USER_LOG_CHANNEL_ID: Symbol('USER_LOG_CHANNEL_ID'),
    LASTFM_API_KEY: Symbol('LASTFM_API_KEY'),
    LASTFM_SHARED_SECRET: Symbol('LASTFM_SHARED_SECRET'),

    // CORE
    Bot: Symbol('Bot'),
    Client: Symbol('Client'),
    LastFmClient: Symbol('LastFmClient'),
    MongoDbConnector: Symbol('MongoDbConnector'),
    BotLogger: Symbol('BotLogger'),
    JobLogger: Symbol('JobLogger'),

    // HANDLERS
    HandlerFactory: Symbol('HandlerFactory'),
    GuildMessageHandler: Symbol('GuildMessageHandler'),
    DirectMessageHandler: Symbol('DirectMessageHandler'),
    ReadyHandler: Symbol('ReadyHandler'),

    // STAFFMAIL
    StaffMailCreate: Symbol('StaffMailCreate'),

    // REPOSITORIES
    StaffMailRepository: Symbol('StaffMailRepository'),
    SelfMutesRepository: Symbol('SelfMutesRepository'),

    // SERVICES
    MessageService: Symbol('MessageService'),
    MemberService: Symbol('MemberService'),
    ScheduleService: Symbol('ScheduleService'),
    ChannelService: Symbol('ChannelService'),
};
