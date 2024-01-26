export interface IHandler {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    handle(eventData: any): Promise<void>;
}
