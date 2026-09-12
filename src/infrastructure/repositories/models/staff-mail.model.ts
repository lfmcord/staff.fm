import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { GuildTextBasedChannel, User } from 'discord.js';

export interface StaffMail {
    id: string;
    channel: GuildTextBasedChannel | null;
    user: User | null;
    userId: string;
    mode: StaffMailModeEnum;
    type: string;
    createdAt: Date;
    lastMessageAt: Date;
}
