import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { GuildTextBasedChannel, Message, PartialMessage } from 'discord.js';
import { inject, injectable } from 'inversify';
import { MessageService } from '@src/infrastructure/services/message.service';
import { TYPES } from '@src/types';
import { MemberService } from '@src/infrastructure/services/member.service';
import { Logger } from 'tslog';
import { Verification } from '@src/feature/commands/utility/models/verification.model';
import { TextHelper } from '@src/helpers/text.helper';
import LastFM from 'lastfm-typed';
import { LoggingService } from '@src/infrastructure/services/logging.service';

@injectable()
export class VerifyCommand implements ICommand {
    name: string = 'verify';
    description: string = 'Verifies a new user.';
    usageHint: string = '<user mention/ID> [last.fm username]';
    examples: string[] = ['', 'haiyn'];
    permissionLevel = CommandPermissionLevel.Backstager;
    aliases = ['v'];
    isUsableInDms = false;
    isUsableInServer = true;

    private loggingService: LoggingService;
    private lastFmClient: LastFM;
    private logger: Logger<VerifyCommand>;
    private unverifiedRoleId: string;
    private memberService: MemberService;
    private messageService: MessageService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<VerifyCommand>,
        @inject(TYPES.MessageService) messageService: MessageService,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.UNVERIFIED_ROLE_ID) unverifiedRoleId: string,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.loggingService = loggingService;
        this.lastFmClient = lastFmClient;
        this.logger = logger;
        this.unverifiedRoleId = unverifiedRoleId;
        this.memberService = memberService;
        this.messageService = messageService;
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }

    async run(message: Message | PartialMessage, args: string[]): Promise<CommandResult> {
        if (!message.reference) {
            return {
                isSuccessful: false,
                replyToUser: `You have to reply to the user you want to verify!`,
            };
        }
        const verificationMessage = await this.messageService.getChannelMessageByMessageId(
            message.reference.messageId!,
            message.channel as GuildTextBasedChannel
        );

        const memberToVerify = verificationMessage?.member;
        if (!memberToVerify) {
            return {
                isSuccessful: false,
                replyToUser: `Looks like the user has left the server.`,
            };
        }

        const memberRoles = await this.memberService.getRolesFromGuildMember(memberToVerify);
        if (!memberRoles.find((r) => r.id === this.unverifiedRoleId)) {
            return {
                isSuccessful: false,
                replyToUser: `This user is already verified!`,
            };
        }

        // TODO: Support no last.fm account
        const lastfmUsername = TextHelper.getLastfmUsername(verificationMessage?.content);
        if (!lastfmUsername) {
            return {
                isSuccessful: false,
                replyToUser: `The message you're replying to doesn't seem to be a valid Last.fm link.`,
            };
        }

        let lastfmUser;
        try {
            lastfmUser = await this.lastFmClient.user.getInfo({ username: lastfmUsername });
            this.logger.trace(JSON.stringify(lastfmUser));
        } catch (e) {
            this.logger.error(e);
            throw Error(`Last.fm API returned an error.`);
        }
        if (!lastfmUser) {
            return {
                isSuccessful: false,
                replyToUser: `The username '${lastfmUsername}' doesn't seem to be an existing Last.fm user.`,
            };
        }

        const verification: Verification = {
            verificationMessage: verificationMessage,
            verifyingUser: message.author!,
            verifiedMember: memberToVerify,
            lastfmUser: lastfmUser ?? null,
        };

        // TODO: Save data model
        // TODO: Scrobble role assignment

        // await memberToVerify.roles.remove(this.unverifiedRoleId);

        await this.loggingService.logVerification(verification);

        return {
            isSuccessful: true,
            shouldDelete: true,
        };
    }
}
