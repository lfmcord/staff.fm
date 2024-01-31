import { GuildMessageHandler } from '@src/handlers/guild-message.handler';
import { DirectMessageHandler } from '@src/handlers/direct-message.handler';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { IHandlerFactory } from '@src/handlers/models/handler-factory.interface';
import { IHandler } from '@src/handlers/models/handler.interface';
import { ReadyHandler } from '@src/handlers/ready.handler';
import { GuildMemberAddHandler } from '@src/handlers/guild-member-add.handler';

@injectable()
export class HandlerFactory implements IHandlerFactory {
    private readonly guildMessageHandler: GuildMessageHandler;
    guildMemberAddHandler: GuildMemberAddHandler;
    private readonly readyHandler: ReadyHandler;
    private readonly directMessageHandler: DirectMessageHandler;

    constructor(
        @inject(TYPES.GuildMessageHandler) guildMessageHandler: GuildMessageHandler,
        @inject(TYPES.DirectMessageHandler) directMessageHandler: DirectMessageHandler,
        @inject(TYPES.GuildMemberAddHandler) guildMemberAddHandler: GuildMemberAddHandler,
        @inject(TYPES.ReadyHandler) readyHandler: ReadyHandler
    ) {
        this.guildMemberAddHandler = guildMemberAddHandler;
        this.readyHandler = readyHandler;
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
            case 'guildMemberAdd':
                handler = this.guildMemberAddHandler;
                break;
            case 'ready':
                handler = this.readyHandler;
                break;
            default:
                throw new Error(`Handler for event type '${eventType}' is not implemented.`);
        }
        return handler;
    }
}
