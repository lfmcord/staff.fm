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

    // CORE
    Bot: Symbol('Bot'),
    Client: Symbol('Client'),
    MongoDbConnector: Symbol('MongoDbConnector'),
    BotLogger: Symbol('BotLogger'),
    JobLogger: Symbol('JobLogger'),

    // HANDLERS
    HandlerFactory: Symbol('HandlerFactory'),
    GuildMessageHandler: Symbol('GuildMessageHandler'),
    DirectMessageHandler: Symbol('DirectMessageHandler'),

    // STAFFMAIL
    StaffMailCreate: Symbol('StaffMailCreate'),

    // REPOSITORIES
    StaffMailRepository: Symbol('StaffMailRepository'),
    SelfMutesRepository: Symbol('SelfMutesRepository'),

    // SERVICES
    MessageService: Symbol('MessageService'),
    MemberService: Symbol('MemberService'),
    ScheduleService: Symbol('ScheduleService'),
};
