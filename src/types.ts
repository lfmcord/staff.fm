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

    // HANDLERS
    HandlerFactory: Symbol('HandlerFactory'),
    Handler: Symbol('Handler'),

    // COMMANDS
    Command: Symbol('Command'),

    // TRIGGERS
    StaffMailDmTrigger: Symbol('StaffMailDmTrigger'),
    VerificationLastFmTrigger: Symbol('VerificationLastFmTrigger'),

    // REPOSITORIES
    StaffMailRepository: Symbol('StaffMailRepository'),
    SelfMutesRepository: Symbol('SelfMutesRepository'),
    CachingRepository: Symbol('CachingRepository'),
    MuteRndRepository: Symbol('MuteRndRepository'),
    FlagsRepository: Symbol('FlagsRepository'),
    UsersRepository: Symbol('UsersRepository'),

    // SERVICES
    MessageService: Symbol('MessageService'),
    MemberService: Symbol('MemberService'),
    ScheduleService: Symbol('ScheduleService'),
    ChannelService: Symbol('ChannelService'),
    LoggingService: Symbol('LoggingService'),
    AuditService: Symbol('AuditService'),
};