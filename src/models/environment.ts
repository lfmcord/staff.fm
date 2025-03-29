export interface Environment {
    SECRETS: {
        TOKEN: string;
        LASTFM_API_KEY: string;
        LASTFM_SHARED_SECRET: string;
    };
    MONGODB: {
        CONNECTION_STRING: string;
        ROOT_USER: string;
        ROOT_PASS: string;
        ROOT_NAME: string;
    };
    REDIS: {
        REDIS_HOST: string;
        REDIS_PORT: number;
    };
    CORE: {
        PREFIX: string;
        BOT_OWNER_ID: string;
        GUILD_ID: string;
        WHOKNOWS_USER_ID: string;
    };
    ROLES: {
        MUTED_ROLE_ID: string;
        SELFMUTED_ROLE_ID: string;
        BACKSTAGER_ROLE_IDS: string[];
        HELPER_ROLE_IDS: string[];
        ADMIN_ROLE_IDS: string[];
        MODERATOR_ROLE_IDS: string[];
        INACTIVE_ROLE_ID: string;
        NO_LASTFM_ACCOUNT_ROLE_ID: string;
        UNVERIFIED_ROLE_ID: string;
        SCROBBLE_MILESTONES: Map<number, string>;
    };
    CHANNELS: {
        HELPERS_CHANNEL_ID: string;
        VERIFICATION_CHANNEL_ID: string;
        BACKSTAGE_CHANNEL_ID: string;
        SELFMUTE_LOG_CHANNEL_ID: string;
        STAFFMAIL_LOG_CHANNEL_ID: string;
        USER_LOG_CHANNEL_ID: string;
        CROWNS_LOG_CHANNEL_ID: string;
        DELETED_MESSAGE_LOG_CHANNEL_ID: string;
        DELETED_MESSAGE_LOG_EXCLUDED_CHANNEL_IDS: string[];
        DISCUSSIONS_LOG_CHANNEL_ID: string;
    };
    DISCUSSIONS: {
        CHANNEL_ID: string;
        AUTO_INTERVAL_IN_HOURS: number;
        PING_ROLE_IDS: string[];
    };
    STAFFMAIL: {
        CATEGORY_ID: string;
        PING_ROLE_IDS: string[];
    };
    MODERATION: {
        STRIKE_MUTE_DURATIONS: Map<number, number[]>;
        STRIKE_EXPIRATION_IN_MONTHS: number;
    };
    LOGGING: {
        LOG_LEVEL: number;
    };
    MISC: {
        MESSAGE_CACHING_DURATION_IN_SECONDS: number;
        LASTFM_AGE_ALERT_IN_DAYS: number;
    };
}
