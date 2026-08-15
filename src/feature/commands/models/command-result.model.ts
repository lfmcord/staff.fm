import { InteractionReplyOptions } from 'discord.js';

export class CommandResult {
    /**
     * Indicates whether the command was successful or not. If it is null, it's a silent command where the response is not relayed to the user.
     */
    public isSuccessful?: boolean;
    public reason?: string;
    public replyToUser?: InteractionReplyOptions;
    public isEphemeral?: boolean = false;

    constructor(
        isSuccessful?: boolean,
        reason?: string,
        replyToUser?: InteractionReplyOptions,
        shouldDelete?: boolean
    ) {
        this.isSuccessful = isSuccessful;
        this.reason = reason;
        this.replyToUser = replyToUser;
        this.isEphemeral = shouldDelete !== undefined;
    }
}
