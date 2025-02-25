import { Environment } from '@models/environment';
import { VerificationTrigger } from '@src/feature/triggers/verification.trigger';
import { WhoknowsTrigger } from '@src/feature/triggers/whoknows.trigger';
import { IHandler } from '@src/handlers/models/handler.interface';
import { TYPES } from '@src/types';
import { Message, PartialMessage } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class MessageUpdateHandler implements IHandler {
    eventType = 'messageUpdate';
    private logger: Logger<MessageUpdateHandler>;
    private whoKnowsTrigger: WhoknowsTrigger;
    env: Environment;
    private verificationLastFmTrigger: VerificationTrigger;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<MessageUpdateHandler>,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.VerificationLastFmTrigger) verificationLastFmTrigger: VerificationTrigger,
        @inject(TYPES.WhoknowsTrigger) whoKnowsTrigger: WhoknowsTrigger
    ) {
        this.whoKnowsTrigger = whoKnowsTrigger;
        this.env = env;
        this.logger = logger;
        this.verificationLastFmTrigger = verificationLastFmTrigger;
    }

    async handle(message: { oldMessage: Message | PartialMessage; newMessage: Message | PartialMessage }) {
        if (message.newMessage.author?.id == this.env.CORE.WHOKNOWS_USER_ID)
            await this.whoKnowsTrigger.run(message.newMessage as Message);
        if (message.oldMessage.author?.bot) return;
        const isVerification = message.newMessage.channelId === this.env.CHANNELS.VERIFICATION_CHANNEL_ID;
        if (isVerification) await this.verificationLastFmTrigger.run(message.newMessage as Message);
        else
            this.logger.debug(
                `Edited message with ID ${message.newMessage.id} was not in verification channel. Ignoring.`
            );
    }
}
