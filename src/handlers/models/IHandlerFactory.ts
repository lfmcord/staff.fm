import { IHandler } from '@src/handlers/models/IHandler';

export interface IHandlerFactory {
    createHandler(identifier: string): IHandler;
}
