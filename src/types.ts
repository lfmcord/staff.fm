export const TYPES = {
    // ENVIRONMENT
    TOKEN: Symbol('TOKEN'),
    LOG_LEVEL: Symbol('LOG_LEVEL'),
    BOT_OWNER_ID: Symbol('BOT_OWNER_ID'),
    GUILD_ID: Symbol('GUILD_ID'),
    DB_CONNECTION_STRING: Symbol('DB_CONNECTION_STRING'),
    PREFIX: Symbol('PREFIX'),

    // CORE
    Bot: Symbol('Bot'),
    Client: Symbol('Client'),
    BotLogger: Symbol('BotLogger'),
    JobLogger: Symbol('JobLogger'),

    // HANDLES
    MessageHandler: Symbol('MessageHandler'),

    // COMMANDS
    Ping: Symbol('PingCommand'),
};
