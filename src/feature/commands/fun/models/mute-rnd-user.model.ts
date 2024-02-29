import { GuildMember } from 'discord.js';

export class MuteRndUser {
    member: GuildMember;
    isActive: boolean;
    optInDate: Date;
    winCount: number;

    constructor(member: GuildMember, optInDate: Date, isActive: boolean, winCount: number) {
        this.isActive = isActive;
        this.member = member;
        this.optInDate = optInDate;
        this.winCount = winCount;
    }
}
