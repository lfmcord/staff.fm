export class ValidationError {
    internalMessage: string;
    messageToUser: string;

    constructor(internalMessage: string, messageToUser: string = 'Oops, something went wrong!') {
        this.internalMessage = internalMessage;
        this.messageToUser = messageToUser;
    }
}
