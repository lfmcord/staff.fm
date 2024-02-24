import { GuildMember, Message, User } from 'discord.js';
import { getInfo } from 'lastfm-typed/dist/interfaces/userInterface';

export class Verification {
    verifiedMember: GuildMember;
    verifyingUser: User;
    lastfmUser: getInfo | null;
    verificationMessage: Message | null;
    discordAccountCreated: number;
    lastfmAccountCreated: number | null;

    constructor(
        verifiedMember: GuildMember,
        verifyingUser: User,
        lastfmUser: getInfo | null,
        verificationMessage: Message,
        discordAccountCreated: number,
        lastfmAccountCreated: number | null
    ) {
        this.verifiedMember = verifiedMember;
        this.verifyingUser = verifyingUser;
        this.lastfmUser = lastfmUser;
        this.verificationMessage = verificationMessage;
        this.discordAccountCreated = discordAccountCreated;
        this.lastfmAccountCreated = lastfmAccountCreated;
    }
}
