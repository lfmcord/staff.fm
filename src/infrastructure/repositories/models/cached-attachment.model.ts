export class CachedAttachmentModel {
    data: Buffer;
    mimeType: string;

    constructor(data: Buffer, mimeType: string) {
        this.data = data;
        this.mimeType = mimeType;
    }
}
