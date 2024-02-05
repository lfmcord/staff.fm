export class ValidationError {
    error: Error;
    messageToUser: string;

    constructor(error: Error, messageToUser: string) {
        this.error = error;
        this.messageToUser = messageToUser;
    }
}
