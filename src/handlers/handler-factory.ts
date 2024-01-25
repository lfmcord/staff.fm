import { GuildMessageHandler } from '@src/handlers/guild-message.handler';
import { DirectMessageHandler } from '@src/handlers/direct-message.handler';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { IHandlerFactory } from '@src/handlers/models/handler-factory.interface';
import { IHandler } from '@src/handlers/models/handler.interface';

@injectable()
export class HandlerFactory implements IHandlerFactory {
    private readonly guildMessageHandler: GuildMessageHandler;
    private readonly directMessageHandler: DirectMessageHandler;
    constructor(
        @inject(TYPES.GuildMessageHandler) guildMessageHandler: GuildMessageHandler,
        @inject(TYPES.DirectMessageHandler) directMessageHandler: DirectMessageHandler
    ) {
        this.guildMessageHandler = guildMessageHandler;
        this.directMessageHandler = directMessageHandler;
    }

    public createHandler(eventType: string): IHandler {
        let handler = null;
        switch (eventType) {
            case 'directMessageCreate':
                handler = this.directMessageHandler;
                break;
            case 'guildMessageCreate':
                handler = this.guildMessageHandler;
                break;
            default:
                throw new Error(`Handler for event type '${eventType}' is not implemented.`);
        }
        return handler;
    }
}
