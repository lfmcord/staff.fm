import { StaffMailModeEnum } from '@src/feature/staffmail/models/staff-mail-mode.enum';
import { GuildTextBasedChannel, User } from 'discord.js';

export interface StaffMail {
    channel: GuildTextBasedChannel | null;
    user: User | null;
    userId: string;
    mode: StaffMailModeEnum;
    createdAt: Date;
    lastMessageAt: Date;
}
