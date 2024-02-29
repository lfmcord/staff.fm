export class CachedMessageModel {
    authorId: string;
    channelId: string;
    contents: string;
    messageId: string;
    attachments: string[];

    constructor(messageId: string, authorId: string, channelId: string, contents: string, attachments: string[]) {
        this.messageId = messageId;
        this.channelId = channelId;
        this.authorId = authorId;
        this.contents = contents;
        this.attachments = attachments;
    }
}
