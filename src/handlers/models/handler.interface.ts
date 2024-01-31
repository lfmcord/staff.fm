export interface IHandler {
    eventType: string;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    handle(eventData: any): Promise<void>;
}
