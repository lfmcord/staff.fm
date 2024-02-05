import { GuildMember, Message, User } from 'discord.js';
import { getInfo } from 'lastfm-typed/dist/interfaces/userInterface';

export class Verification {
    verifiedMember: GuildMember;
    verifyingUser: User;
    lastfmUser: getInfo | null;
    verificationMessage: Message;
    constructor(
        verifiedMember: GuildMember,
        verifyingUser: User,
        lastfmUser: getInfo | null,
        verificationMessage: Message
    ) {
        this.verifiedMember = verifiedMember;
        this.verifyingUser = verifyingUser;
        this.lastfmUser = lastfmUser;
        this.verificationMessage = verificationMessage;
    }
}
