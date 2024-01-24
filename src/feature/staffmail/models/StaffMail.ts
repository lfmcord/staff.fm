import { StaffMailModeEnum } from '@src/feature/staffmail/models/StaffMailMode.enum';
import { Channel, GuildBasedChannel, GuildTextBasedChannel, User } from 'discord.js';

export interface StaffMail {
    channel: GuildTextBasedChannel;
    user: User;
    mode: StaffMailModeEnum;
    createdAt: Date;
    lastMessageAt: Date;
}
