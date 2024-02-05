import { StaffMailModeEnum } from '@src/feature/staffmail/models/staff-mail-mode.enum';
import { GuildTextBasedChannel, User } from 'discord.js';

export interface StaffMail {
    channel: GuildTextBasedChannel;
    user: User;
    mode: StaffMailModeEnum;
    createdAt: Date;
    lastMessageAt: Date;
}
