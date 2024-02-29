export class CommandResult {
    /**
     * Indicates whether the command was successful or not. If it is null, it's a silent command where the response is not relayed to the user.
     */
    public isSuccessful?: boolean;
    public reason?: string;
    public replyToUser?: string;
    /**
     * Whether the trigger and reply should be deleted automatically.
     */
    public shouldDelete?: boolean = false;
    constructor(isSuccessful?: boolean, reason?: string, replyToUser?: string, shouldDelete?: boolean) {
        this.isSuccessful = isSuccessful;
        this.reason = reason;
        this.replyToUser = replyToUser;
        this.shouldDelete = shouldDelete !== undefined;
    }
}
