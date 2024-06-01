import { IHandler } from '@src/handlers/models/handler.interface';
import { Logger } from 'tslog';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { Message, PartialMessage } from 'discord.js';
import { Environment } from '@models/environment';
import { VerificationLastFmTrigger } from '@src/feature/triggers/verification-lastfm.trigger';

@injectable()
export class MessageUpdateHandler implements IHandler {
    eventType = 'messageUpdate';
    private logger: Logger<MessageUpdateHandler>;
    env: Environment;
    private verificationLastFmTrigger: VerificationLastFmTrigger;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<MessageUpdateHandler>,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.VerificationLastFmTrigger) verificationLastFmTrigger: VerificationLastFmTrigger
    ) {
        this.env = env;
        this.logger = logger;
        this.verificationLastFmTrigger = verificationLastFmTrigger;
    }
    async handle(message: { oldMessage: Message | PartialMessage; newMessage: Message | PartialMessage }) {
        if (message.oldMessage.author?.bot) return;
        const isVerification = message.newMessage.channelId === this.env.VERIFICATION_CHANNEL_ID;
        if (isVerification) await this.verificationLastFmTrigger.run(message.newMessage as Message);
        else
            this.logger.debug(
                `Edited message with ID ${message.newMessage.id} was not in verification channel. Ignoring.`
            );
    }
}
