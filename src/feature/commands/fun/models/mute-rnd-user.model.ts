import { GuildMember } from 'discord.js';

export class MuteRndUser {
    member: GuildMember;
    optedIn: Date;
    winCount: number;
    constructor(member: GuildMember, optedIn: Date, winCount: number) {
        this.member = member;
        this.optedIn = optedIn;
        this.winCount = winCount;
    }
}
