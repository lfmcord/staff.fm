import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import { GuildTextBasedChannel, Message } from 'discord.js';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TextHelper } from '@src/helpers/text.helper';
import { Environment } from '@models/environment';
import { MessageService } from '@src/infrastructure/services/message.service';

@injectable()
export class WhoknowsTrigger {
    logger: Logger<WhoknowsTrigger>;
    memberService: MemberService;
    usersRepository: UsersRepository;
    loggingService: LoggingService;
    messageService: MessageService;
    env: Environment;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<WhoknowsTrigger>,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.MessageService) messageService: MessageService,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.loggingService = loggingService;
        this.messageService = messageService;
        this.logger = logger;
        this.env = env;
    }

    async run(message: Message) {
        this.logger.debug(`Checking if message starting with ! is a relevant WK command...`);

        const args = message.content.split(' ');
        if (
            (message.content.startsWith('!crowns') || message.content.startsWith('!cw')) &&
            (args[1] == 'ban' || args[1] == 'unban')
        )
            await this.handleCrownsCommand(message, args);
    }

    private async handleCrownsCommand(message: Message, args: string[]) {
        this.logger.info(`New WK crowns command, updating DB...`);

        const isBan = args[1] == 'ban';
        const subjectId = TextHelper.getDiscordUserId(args[2]);
        let reason = args.slice(3).join(' ');
        if (!subjectId) {
            this.logger.info(`'${args[2]}' is not a Discord user ID`);
            await message.reply(
                `I've not ${isBan ? 'added' : 'removed'} the crowns ban flag to the user because I couldn't recognize this user. ` +
                    `If this is wrong, please use the \`${this.env.PREFIX}crowns ${isBan ? 'ban' : 'unban'}\` command.`
            );
            return;
        }
        const hasCrownsBan = (await this.usersRepository.getUserByUserId(subjectId))?.crownsBan != null;

        if ((hasCrownsBan && isBan) || (!hasCrownsBan && !isBan)) {
            this.logger.info(`DB is already up-to-date, nothing to do.`);
            return;
        }
        if (!reason || reason == '') {
            if (message.reference?.messageId != null) {
                const referenceContents = (
                    await this.messageService.getChannelMessageByMessageId(
                        message.reference.messageId,
                        message.channel as GuildTextBasedChannel
                    )
                )?.content;
                if (referenceContents) reason = referenceContents;
                else this.logger.warn(`No reference content found for ${message.reference.messageId}`);
            } else
                await message.reply(
                    `Tip: If you add the reason for the ${isBan ? 'ban' : 'unban'} directly behind the command or reply to a message with the reason for the ban I will be able to log and display it later!`
                );
        }

        isBan
            ? await this.usersRepository.addCrownBanToUser(message.author.id, subjectId, reason)
            : await this.usersRepository.removeCrownsBanFromUser(subjectId);

        const subject = await this.memberService.fetchUser(subjectId);
        if (!subject) {
            await message.reply(
                `I could not find this Discord User. I've still ${isBan ? 'added' : 'removed'} the crowns ban flag.`
            );
            return;
        }
        await this.loggingService.logCrownsBan(message.author, subject, reason, message, !isBan);
    }
}
