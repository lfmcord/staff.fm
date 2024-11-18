import { Message, User } from 'discord.js';
import { getInfo } from 'lastfm-typed/dist/interfaces/userInterface';

export class Verification {
    verifiedUser: User;
    verifyingUser: User;
    lastfmUser: getInfo | null;
    verificationMessage: Message | null;
    discordAccountCreated: number;
    lastfmAccountCreated: number | null;
    isReturningUser: boolean;

    constructor(
        verifiedMember: User,
        verifyingUser: User,
        lastfmUser: getInfo | null,
        verificationMessage: Message,
        discordAccountCreated: number,
        lastfmAccountCreated: number | null,
        isReturningUser: boolean
    ) {
        this.verifiedUser = verifiedMember;
        this.verifyingUser = verifyingUser;
        this.lastfmUser = lastfmUser;
        this.verificationMessage = verificationMessage;
        this.discordAccountCreated = discordAccountCreated;
        this.lastfmAccountCreated = lastfmAccountCreated;
        this.isReturningUser = isReturningUser;
    }
}
