import { DiscussionsTrigger } from '@src/feature/triggers/discussions.trigger';
import { MutesTrigger } from '@src/feature/triggers/mutes.trigger';
import { IHandler } from '@src/handlers/models/handler.interface';
import { TYPES } from '@src/types';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class ReadyHandler implements IHandler {
    eventType = 'ready';

    private logger: Logger<ReadyHandler>;
    private mutesTrigger: MutesTrigger;
    private discussionsTrigger: DiscussionsTrigger;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<ReadyHandler>,
        @inject(TYPES.DiscussionsTrigger) discussionsTrigger: DiscussionsTrigger,
        @inject(TYPES.MutesTrigger) mutesTrigger: MutesTrigger
    ) {
        this.mutesTrigger = mutesTrigger;
        this.discussionsTrigger = discussionsTrigger;
        this.logger = logger;
    }

    async handle() {
        await this.restoreMutes();
        await this.restoreAutoDiscussions();
    }

    private async restoreMutes() {
        this.logger.info(`Restoring mutes...`);
        const count = await this.mutesTrigger.restoreMutes();
        this.logger.info(`Restored ${count} mutes.`);
    }

    private async restoreAutoDiscussions() {
        this.logger.info(`Restoring automatic discussions...`);
        const count = await this.discussionsTrigger.restoreScheduledDiscussion();
        this.logger.info(`Restored ${count} discussions.`);
    }
}
