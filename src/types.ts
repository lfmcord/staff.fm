export const TYPES = {
    // ENVIRONMENT
    ENVIRONMENT: Symbol('ENVIRONMENT'),

    // CORE
    Bot: Symbol('Bot'),
    Client: Symbol('Client'),
    LastFmClient: Symbol('LastFmClient'),
    Redis: Symbol('Redis'),
    MongoDbConnector: Symbol('MongoDbConnector'),
    RedisConnector: Symbol('RedisConnector'),
    BotLogger: Symbol('BotLogger'),
    JobLogger: Symbol('JobLogger'),
    InfrastructureLogger: Symbol('InfrastructureLogger'),
    ApiLogger: Symbol('ApiLogger'),
    ApiRouter: Symbol('ApiRouter'),

    // HANDLERS
    HandlerFactory: Symbol('HandlerFactory'),
    Handler: Symbol('Handler'),

    // COMMANDS
    Command: Symbol('Command'),

    // TRIGGERS
    StaffMailDmTrigger: Symbol('StaffMailDmTrigger'),
    VerificationLastFmTrigger: Symbol('VerificationLastFmTrigger'),
    WhoknowsTrigger: Symbol('WhoknowsTrigger'),
    DiscussionsTrigger: Symbol('DiscussionsTrigger'),
    MutesTrigger: Symbol('MutesTrigger'),
    AutomodTrigger: Symbol('AutomodTrigger'),

    // REPOSITORIES
    StaffMailRepository: Symbol('StaffMailRepository'),
    CachingRepository: Symbol('CachingRepository'),
    MuteRndRepository: Symbol('MuteRndRepository'),
    FlagsRepository: Symbol('FlagsRepository'),
    UsersRepository: Symbol('UsersRepository'),
    DiscussionsRepository: Symbol('DiscussionsRepository'),
    MutesRepository: Symbol('MutesRepository'),
    BlockedWordsRepository: Symbol('BlockedWordsRepository'),

    // SERVICES
    MessageService: Symbol('MessageService'),
    MemberService: Symbol('MemberService'),
    ScheduleService: Symbol('ScheduleService'),
    ChannelService: Symbol('ChannelService'),
    LoggingService: Symbol('LoggingService'),
    AuditService: Symbol('AuditService'),
    CommandService: Symbol('CommandService'),
    LastFmService: Symbol('LastFmService'),
    ModerationService: Symbol('ModerationService'),

    // CONTROLLERS
    UserController: Symbol('UserController'),
};
