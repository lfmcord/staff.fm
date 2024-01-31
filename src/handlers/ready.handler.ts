import { IHandler } from '@src/handlers/models/handler.interface';
import { Logger } from 'tslog';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import container from '@src/inversify.config';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { SelfMuteCommand } from '@src/feature/commands/utility/self-mute.command';

@injectable()
export class ReadyHandler implements IHandler {
    eventType = 'ready';

    private logger: Logger<ReadyHandler>;
    constructor(@inject(TYPES.BotLogger) logger: Logger<ReadyHandler>) {
        this.logger = logger;
    }
    async handle() {
        await this.restoreSelfMutes();
    }

    private async restoreSelfMutes() {
        this.logger.info(`Restoring selfmutes...`);
        const command: SelfMuteCommand = (container.getAll('Command') as ICommand[]).find(
            (c: ICommand) => c.name == 'selfmute'
        ) as SelfMuteCommand;
        const count = await command.restoreSelfMutes();
        this.logger.info(`Restored ${count} selfmutes.`);
    }
}
