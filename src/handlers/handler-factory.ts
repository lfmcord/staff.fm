import { injectable } from 'inversify';
import { IHandlerFactory } from '@src/handlers/models/handler-factory.interface';
import { IHandler } from '@src/handlers/models/handler.interface';
import container from '../inversify.config';

@injectable()
export class HandlerFactory implements IHandlerFactory {
    private readonly handlers: IHandler[];

    constructor() {
        this.handlers = container.getAll('Handler');
    }

    public createHandler(eventType: string): IHandler {
        const foundHandler = this.handlers.find((h) => h.eventType == eventType);
        if (!foundHandler) throw Error(`Cannot find a handler for eventType '${eventType}'`);
        return foundHandler;
    }
}
