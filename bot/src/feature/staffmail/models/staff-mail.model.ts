import { StaffMailModeEnum } from '@src/feature/staffmail/models/staff-mail-mode.enum';
import { GuildTextBasedChannel, User } from 'discord.js';
import { StaffMailType } from '@src/feature/staffmail/models/staff-mail-type.enum';

export interface StaffMail {
    id: string;
    channel: GuildTextBasedChannel | null;
    user: User | null;
    userId: string;
    mode: StaffMailModeEnum;
    type: StaffMailType;
    summary: string;
    createdAt: Date;
    lastMessageAt: Date;
    lastMessageId: string;
}
