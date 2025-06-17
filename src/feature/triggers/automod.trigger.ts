import { Environment } from '@models/environment';
import { BlockedWordsRepository } from '@src/infrastructure/repositories/blocked-words.repository';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { Client, GuildTextBasedChannel, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class AutomodTrigger {
    logger: Logger<AutomodTrigger>;
    client: Client;
    memberService: MemberService;
    blockedWordsRepository: BlockedWordsRepository;
    flagsRepository: FlagsRepository;
    env: Environment;
    loggingService: LoggingService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<AutomodTrigger>,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.FlagsRepository) flagsRepository: FlagsRepository,
        @inject(TYPES.BlockedWordsRepository) blockedWordsRepository: BlockedWordsRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.Client) client: Client
    ) {
        this.client = client;
        this.memberService = memberService;
        this.blockedWordsRepository = blockedWordsRepository;
        this.flagsRepository = flagsRepository;
        this.env = env;
        this.loggingService = loggingService;
        this.logger = logger;
    }

    async run(message: Message) {
        if (!message.author.bot || message.author.id == this.client.user?.id) return; // Ignore messages from non-bots as they are handled by Discord automod
        try {
            const categoryId = (message.channel as GuildTextBasedChannel).parentId;
            if (
                categoryId &&
                !this.env.MODERATION.AUTOMOD.ENABLED_CHANNEL_IDS.includes(categoryId) &&
                !this.env.MODERATION.AUTOMOD.ENABLED_CHANNEL_IDS.includes(message.channelId)
            )
                return;
        } catch (e) {
            this.logger.warn(`Could not fetch category for channel ID ${message.channel.id}.`);
            if (!this.env.MODERATION.AUTOMOD.ENABLED_CHANNEL_IDS.includes(message.channelId)) return;
        }

        let textToCheck = message.content.toLowerCase();
        if (message.embeds.length > 0) {
            for (const embed of message.embeds) {
                textToCheck += JSON.stringify(embed.data);
            }
        }

        this.logger.trace(`Checking message content for automod: ${textToCheck}`);
        if (await this.checkBlockedWords(message, textToCheck)) return;
        await this.checkFlags(message, textToCheck);
    }

    async checkFlags(message: Message, textToCheck: string) {
        const flags = await this.flagsRepository.getAllFlags();
        for (const flag of flags) {
            if (textToCheck.toLowerCase().includes(flag.term)) {
                this.logger.info(`Automod detected a flagged term: ${flag.term}`);
                await this.loggingService.logFlaggedBotMessage(message, flag.term, this.client.user!);
                return; // Stop checking further if a flag is matched
            }
        }
    }

    async checkBlockedWords(message: Message, textToCheck: string): Promise<boolean> {
        const blockedWords = await this.blockedWordsRepository.getAllBlockedWords();
        for (const word of blockedWords) {
            let isBlocked = false;
            if (word.includes('*')) {
                // if the word contains any wildcards (*), transform it to valid regex and compare
                const pattern = new RegExp(word.replace(/\*/g, '.*'), 'i');
                isBlocked = pattern.test(textToCheck);
            } else {
                // if the word does not contain any wildcards (*), isolate the words and compare
                const words = textToCheck.toLowerCase().split(/\s+/);
                isBlocked = words.some((w) => {
                    const cleaned = w.replace(/[*_`|~>#\[\](){}]/g, ''); // replace any formatting in the word
                    return cleaned === word.toLowerCase();
                });
            }
            if (isBlocked) {
                this.logger.info(`Automod detected a blocked word: ${word}`);
                // TODO: Comment in after testing
                // const reply = await message.reply(
                //     `${Constants.Blocked} This bot message contained a word we block on the server and has been removed. Please avoid running commands on content with inappropriate words such as slurs. Thank you!` +
                //         `\n-# We block certain words to keep the server inclusive and comfortable for everyone. If you think this is a mistake, please contact the server staff.`
                // );
                // await message.delete();
                // await this.loggingService.logBlockedBotMessage(message, reply, word, this.client.user!);
                await this.loggingService.logBlockedBotMessage(message, message, word, this.client.user!);
                return true; // Stop checking further if a blocked word is matched
            }
        }
        return false;
    }
}
