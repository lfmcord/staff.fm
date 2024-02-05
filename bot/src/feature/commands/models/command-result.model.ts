export class CommandResult {
    public isSuccessful: boolean;
    public reason?: string;
    public replyToUser?: string;
    public shouldDelete?: boolean = false;
    constructor(isSuccessful: boolean, reason?: string, replyToUser?: string, shouldDelete?: boolean) {
        this.isSuccessful = isSuccessful;
        this.reason = reason;
        this.replyToUser = replyToUser;
        this.shouldDelete = shouldDelete !== undefined;
    }
}
