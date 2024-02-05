import { GuildMember, Role } from 'discord.js';

export interface SelfMute {
    member: GuildMember;
    createdAt: Date;
    endsAt: Date;
    roles: Role[];
}
