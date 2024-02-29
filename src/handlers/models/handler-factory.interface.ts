import { IHandler } from '@src/handlers/models/handler.interface';

export interface IHandlerFactory {
    createHandler(identifier: string): IHandler;
}
