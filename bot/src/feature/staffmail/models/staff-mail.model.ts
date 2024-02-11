import { StaffMailModeEnum } from '@src/feature/staffmail/models/staff-mail-mode.enum';
import { GuildTextBasedChannel, User } from 'discord.js';

export interface StaffMail {
    id: string;
    channel: GuildTextBasedChannel | null;
    user: User | null;
    userId: string;
    mode: StaffMailModeEnum;
    type: string;
    summary: string | null;
    createdAt: Date;
    lastMessageAt: Date;
    lastMessageId: string;
}
