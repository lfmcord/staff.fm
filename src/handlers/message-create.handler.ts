import { Environment } from '@models/environment';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { AutomodTrigger } from '@src/feature/triggers/automod.trigger';
import { StaffMailDmTrigger } from '@src/feature/triggers/staff-mail-dm.trigger';
import { VerificationTrigger } from '@src/feature/triggers/verification.trigger';
import { WhoknowsTrigger } from '@src/feature/triggers/whoknows.trigger';
import { IHandler } from '@src/handlers/models/handler.interface';
import { CachingRepository } from '@src/infrastructure/repositories/caching.repository';
import { CommandService } from '@src/infrastructure/services/command.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { GuildTextBasedChannel, inlineCode, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import container from '../inversify.config';

@injectable()
export class MessageCreateHandler implements IHandler {
    eventType: string = 'messageCreate';

    private readonly logger: Logger<MessageCreateHandler>;
    private readonly automodTrigger: AutomodTrigger;
    private readonly verificationLastFmTrigger: VerificationTrigger;
    private readonly whoknowsTrigger: WhoknowsTrigger;
    private readonly env: Environment;
    private readonly staffMailDmReply: StaffMailDmTrigger;
    private readonly cachingRepository: CachingRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<MessageCreateHandler>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.CachingRepository) cachingRepository: CachingRepository,
        @inject(TYPES.StaffMailDmTrigger) staffMailDmReply: StaffMailDmTrigger,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.VerificationLastFmTrigger) verificationLastFmTrigger: VerificationTrigger,
        @inject(TYPES.WhoknowsTrigger) whoknowsTrigger: WhoknowsTrigger,
        @inject(TYPES.AutomodTrigger) automodTrigger: AutomodTrigger
    ) {
        this.automodTrigger = automodTrigger;
        this.verificationLastFmTrigger = verificationLastFmTrigger;
        this.env = env;
        this.staffMailDmReply = staffMailDmReply;
        this.cachingRepository = cachingRepository;
        this.logger = logger;
        this.whoknowsTrigger = whoknowsTrigger;
    }

    public async handle(message: Message) {
        const isBot = message.author.bot;
        const isDms = message.channel.isDMBased();
        const isVerification = message.channelId === this.env.CHANNELS.VERIFICATION_CHANNEL_ID;
        const isWhoKnowsCommand = message.content.startsWith('!');

        await this.automodTrigger.run(message);
        if (isWhoKnowsCommand) await this.whoknowsTrigger.run(message);

        if (isBot) return;
        if (isDms) {
            await this.staffMailDmReply.run(message);
        }
        if (isVerification) await this.verificationLastFmTrigger.run(message);

        // cache message if needed
        if (
            !isDms &&
            !(
                this.env.CHANNELS.DELETED_MESSAGE_LOG_EXCLUDED_CHANNEL_IDS.includes(message.channelId) ||
                this.env.CHANNELS.DELETED_MESSAGE_LOG_EXCLUDED_CHANNEL_IDS.includes(
                    (message.channel as GuildTextBasedChannel)?.parentId ?? message.channelId
                )
            )
        ) {
            void this.cachingRepository.cacheMessage(message);
        }
    }
}
