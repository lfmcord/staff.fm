export class ValidationError {
    internalMessage: string;
    messageToUser: string;

    constructor(internalMessage: string, messageToUser: string) {
        this.internalMessage = internalMessage;
        this.messageToUser = messageToUser;
    }
}
