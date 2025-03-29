import { User } from 'discord.js';

export interface Strike {
    subject: User;
    reason: string;
    createdAt: Date;
    actor: User;
    _id: string;
}
