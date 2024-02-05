export class CachedMessageModel {
    userId: string;
    channelId: string;
    contents: string;
    attachments: string[];

    constructor(userId: string, channelId: string, contents: string, attachments: string[]) {
        this.channelId = channelId;
        this.userId = userId;
        this.contents = contents;
        this.attachments = attachments;
    }
}
