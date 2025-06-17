import { Environment } from '@models/environment';
import { TextHelper } from '@src/helpers/text.helper';
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
        this.logger.info(
            `Running automod trigger for message by ${TextHelper.userLog(message.author)} in channel ${message.channel.id}`
        );

        if (await this.checkBlockedWords(message)) return;
        await this.checkFlags(message);
    }

    async checkFlags(message: Message) {
        let textToCheck = message.content;
        if (message.embeds.length > 0) {
            for (const embed of message.embeds) {
                // only check the author field because the rest can contain banned friends
                textToCheck += JSON.stringify(embed.author) ?? '';
            }
        }
        textToCheck = textToCheck.toLowerCase();
        this.logger.trace(`Checking message content for flag automod: ${textToCheck}`);

        const flags = await this.flagsRepository.getAllFlagTerms();
        this.logger.trace(`Checking message content for ${flags.length} flagged terms.`);
        for (const flag of flags) {
            this.logger.trace(`Checking if message contains flagged term: ${flag}`);
            if (textToCheck.includes(flag)) {
                this.logger.info(`Automod detected a flagged term: ${flag}`);
                await this.loggingService.logFlaggedBotMessage(message, flag, this.client.user!);
                return; // Stop checking further if a flag is matched
            }
        }
        this.logger.debug(`Message does not contain any of the ${flags.length} flagged terms.`);
    }

    async checkBlockedWords(message: Message): Promise<boolean> {
        let textToCheck = message.content;
        if (message.embeds.length > 0) {
            for (const embed of message.embeds) {
                textToCheck += JSON.stringify(embed.data);
            }
        }
        textToCheck = textToCheck.toLowerCase();
        this.logger.trace(`Checking message content for blocked automod: ${textToCheck}`);

        const blockedWords = await this.blockedWordsRepository.getAllBlockedWords();
        for (const word of blockedWords) {
            let isBlocked = false;
            if (word.includes('*')) {
                // if the word contains any wildcards (*), transform it to valid regex and compare
                const pattern = new RegExp(word.replace(/\*/g, '.*'), 'i');
                isBlocked = pattern.test(textToCheck);
            } else {
                // if the word does not contain any wildcards (*), isolate the words and compare
                const wordRegex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'i');
                isBlocked = wordRegex.test(textToCheck);
            }
            if (isBlocked) {
                this.logger.info(`Automod detected a blocked word: ${word}`);
                // const reply = await message.reply(
                //     `${Constants.Blocked} This bot message has been removed because it contains a blocked word. Please avoid running commands on content with inappropriate words such as slurs (reclaimed or otherwise). Thank you!` +
                //         `\n-# We block certain words to keep the server inclusive and comfortable for everyone. If you think this action was a mistake, please contact staff.`
                // );
                // await message.delete();
                // await this.loggingService.logBlockedBotMessage(message, reply, word, this.client.user!);
                await this.loggingService.logBlockedBotMessage(message, message, word, this.client.user!);
                return true; // Stop checking further if a blocked word is matched
            }
        }
        this.logger.debug(`Message does not contain any of the ${blockedWords.length} blocked terms.`);
        return false;
    }
}
