import { User } from 'discord.js';

export interface Flag {
    term: string;
    reason: string;
    createdAt: Date;
    createdBy: User | string;
}
