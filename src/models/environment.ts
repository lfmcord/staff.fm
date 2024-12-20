export interface Environment {
    TOKEN: string;
    LASTFM_API_KEY: string;
    LASTFM_SHARED_SECRET: string;
    DB_CONNECTION_STRING: string;
    DB_ROOT_USER: string;
    DB_ROOT_PASS: string;
    DB_ROOT_NAME: string;
    DB_USER: string;
    DB_PASS: string;
    DB_NAME: string;
    PREFIX: string;
    BOT_OWNER_ID: string;
    GUILD_ID: string;
    MUTED_ROLE_ID: string;
    BACKSTAGER_ROLE_IDS: string[];
    HELPER_ROLE_IDS: string[];
    ADMIN_ROLE_IDS: string[];
    MODERATOR_ROLE_IDS: string[];
    UNVERIFIED_ROLE_ID: string;
    NO_LASTFM_ACCOUNT_ROLE_ID: string;
    SCROBBLE_MILESTONE_ROLE_IDS: string[];
    SCROBBLE_MILESTONE_NUMBERS: number[];
    VERIFICATION_CHANNEL_ID: string;
    BACKSTAGE_CHANNEL_ID: string;
    STAFFMAIL_CATEGORY_ID: string;
    STAFFMAIL_PING_ROLE_IDS: string[];
    STAFFMAIL_LOG_CHANNEL_ID: string;
    SELFMUTE_LOG_CHANNEL_ID: string;
    USER_LOG_CHANNEL_ID: string;
    DELETED_MESSAGE_LOG_CHANNEL_ID: string;
    DELETED_MESSAGE_LOG_EXCLUDED_CHANNEL_IDS: string[];
    LASTFM_AGE_ALERT_IN_DAYS: number;
    LOG_LEVEL: number;
    MESSAGE_CACHING_DURATION_IN_SECONDS: number;
    REDIS_HOST: string;
    REDIS_PORT: number;
    SELFMUTED_ROLE_ID: string;
    WHOKNOWS_USER_ID: string;
    CROWNS_LOG_CHANNEL_ID: string;
    INACTIVE_ROLE_ID: string;
    HELPERS_CHANNEL_ID: string;
    DISCUSSIONS_CHANNEL_ID: string;
    DISCUSSIONS_AUTO_INTERVAL_IN_DAYS: number;
    DISCUSSIONS_PING_ROLE_ID: string;
}
