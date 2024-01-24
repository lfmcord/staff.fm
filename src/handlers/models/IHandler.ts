export interface IHandler {
    handle(eventData: any): Promise<void>;
}
