import { IHandler } from '@src/handlers/models/handler.interface';
import { Logger } from 'tslog';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import container from '../inversify.config';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { SelfMuteCommand } from '@src/feature/commands/utility/self-mute.command';
import { DiscussionsTrigger } from '@src/feature/triggers/discussions.trigger';

@injectable()
export class ReadyHandler implements IHandler {
    eventType = 'ready';

    private logger: Logger<ReadyHandler>;
    discussionsTrigger: DiscussionsTrigger;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<ReadyHandler>,
        @inject(TYPES.DiscussionsTrigger) discussionsTrigger: DiscussionsTrigger
    ) {
        this.discussionsTrigger = discussionsTrigger;
        this.logger = logger;
    }

    async handle() {
        await this.restoreSelfMutes();
        await this.restoreAutoDiscussions();
    }

    private async restoreSelfMutes() {
        this.logger.info(`Restoring selfmutes...`);
        const command: SelfMuteCommand = (container.getAll('Command') as ICommand[]).find(
            (c: ICommand) => c.name == 'selfmute'
        ) as SelfMuteCommand;
        const count = await command.restoreSelfMutes();
        this.logger.info(`Restored ${count} selfmutes.`);
    }

    private async restoreAutoDiscussions() {
        this.logger.info(`Restoring automatic discussions...`);
        const count = await this.discussionsTrigger.restoreScheduledDiscussion();
        this.logger.info(`Restored ${count} discussions.`);
    }
}
