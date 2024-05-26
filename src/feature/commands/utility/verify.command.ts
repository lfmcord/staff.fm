import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    EmbedBuilder,
    GuildMember,
    GuildTextBasedChannel,
    Interaction,
    Message,
    MessageContextMenuCommandInteraction,
    RoleResolvable,
    User,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { MessageService } from '@src/infrastructure/services/message.service';
import { TYPES } from '@src/types';
import { MemberService } from '@src/infrastructure/services/member.service';
import { Logger } from 'tslog';
import { Verification } from '@src/feature/commands/utility/models/verification.model';
import { TextHelper } from '@src/helpers/text.helper';
import LastFM from 'lastfm-typed';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { ComponentHelper } from '@src/helpers/component.helper';
import { Environment } from '@models/environment';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LastfmError } from '@models/lastfm-error.model';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';

@injectable()
export class VerifyCommand implements ICommand {
    name: string = 'verify';
    description: string = 'Verifies a new user. Either reply to the user or use the optional parameters.';
    usageHint: string = '[user mention/ID] [last.fm username]';
    examples: string[] = ['', '@haiyn haiyn'];
    permissionLevel = CommandPermissionLevel.Backstager;
    aliases = ['v'];
    isUsableInDms = false;
    isUsableInServer = true;

    private loggingService: LoggingService;
    private lastFmClient: LastFM;
    private logger: Logger<VerifyCommand>;
    private flagsRepository: FlagsRepository;
    private usersRepository: UsersRepository;
    private env: Environment;
    private memberService: MemberService;
    private messageService: MessageService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<VerifyCommand>,
        @inject(TYPES.MessageService) messageService: MessageService,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.FlagsRepository) flagsRepository: FlagsRepository
    ) {
        this.flagsRepository = flagsRepository;
        this.usersRepository = usersRepository;
        this.env = env;
        this.loggingService = loggingService;
        this.lastFmClient = lastFmClient;
        this.logger = logger;
        this.memberService = memberService;
        this.messageService = messageService;
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        if (message.reference) {
            const verificationMessage = await this.messageService.getChannelMessageByMessageId(
                message.reference.messageId!,
                message.channel as GuildTextBasedChannel
            );
            if (!verificationMessage) {
                return {
                    isSuccessful: false,
                    replyToUser: `Something went wrong while I was trying to get the message you replied to. :/`,
                };
            }
            return await this.verifyUser(message, verificationMessage, verificationMessage.author, message.author);
        } else {
            if (args.length < 1)
                throw new ValidationError(
                    `args length is ${args.length}, expected length 2.`,
                    `Either reply to a user to verify them or supply the user and last.fm account name (optional)!`
                );
            const userId = TextHelper.getDiscordUserId(args[0]);
            if (!userId)
                throw new ValidationError(
                    `The supplied first argument is not a discord user: ${args[0]}`,
                    `The first argument in the command has to be a valid Discord user!`
                );
            const memberToVerify = await this.memberService.getGuildMemberFromUserId(userId);
            if (!memberToVerify) {
                throw new ValidationError(
                    `No guild member for: ${args[0]}`,
                    `I can't find the user you are trying to verify!`
                );
            }
            return await this.verifyUser(message, message, memberToVerify?.user, message.author, args[1]);
        }
    }

    async runInteraction(interaction: MessageContextMenuCommandInteraction): Promise<CommandResult> {
        return await this.verifyUser(
            interaction,
            interaction.targetMessage,
            interaction.targetMessage.author,
            interaction.member!.user as User
        );
    }

    private async verifyUser(
        trigger: Message | MessageContextMenuCommandInteraction,
        verificationMessage: Message,
        targetUser: User,
        verifier: User,
        lastfmUsername?: string
    ): Promise<CommandResult> {
        const memberToVerify = await this.memberService.getGuildMemberFromUserId(targetUser.id);
        if (!lastfmUsername) lastfmUsername = TextHelper.getLastfmUsername(verificationMessage.content) ?? undefined;

        if (!memberToVerify) {
            return {
                isSuccessful: false,
                replyToUser: `I cannot find this user!`,
                shouldDelete: true,
            };
        }

        // const memberRoles = await this.memberService.getRolesFromGuildMember(memberToVerify);
        // if (!memberRoles.find((r) => r.id === this.env.UNVERIFIED_ROLE_ID)) {
        //     return {
        //         isSuccessful: false,
        //         replyToUser: `This user is already verified!`,
        //         shouldDelete: true,
        //     };
        // }

        if (
            (await this.memberService.getMemberPermissionLevel(verificationMessage.member!)) <
            CommandPermissionLevel.Moderator
        ) {
            this.logger.debug(`User is not privileged moderator, check for flagged account.`);
            const flags = await this.flagsRepository.getAllFlags();
            if (
                flags.find(
                    (flag) =>
                        verificationMessage?.content?.match(flag.term) != null ||
                        lastfmUsername?.match(flag.term) != null
                )
            ) {
                this.logger.debug(`Verifier is trying to verify a flagged account.`);
                return {
                    isSuccessful: false,
                    replyToUser: `A moderator or administrator needs to verify this user. Please let them know.`,
                    shouldDelete: true,
                };
            }
        }

        await verificationMessage.react(TextHelper.loading);
        let lastfmUser;
        if (!lastfmUsername) {
            const wasVerified = await this.tryToVerifyUserWithoutLastfm(trigger, memberToVerify);
            if (!wasVerified) {
                this.logger.debug(`Verifying without a last.fm account was aborted or timed out.`);
                await verificationMessage.reactions.removeAll();
                return {};
            }
        } else {
            try {
                lastfmUser = await this.lastFmClient.user.getInfo({ username: lastfmUsername });
            } catch (e) {
                if ((e as LastfmError).code == '6') {
                    this.logger.info(`Last.fm user with name '${lastfmUsername}' could not be found.`);
                } else {
                    this.logger.error('Last.fm returned an error that is not code 6 (not found)', e);
                    throw Error(`Last.fm API returned an error.`);
                }
            }
            if (!lastfmUser) {
                return {
                    isSuccessful: false,
                    replyToUser: `The username '${lastfmUsername}' doesn't seem to be an existing Last.fm user.`,
                    shouldDelete: true,
                };
            }
            this.logger.debug(`User has a playcount of ${lastfmUser.playcount}`);
            await this.assignScrobbleRoles(memberToVerify, lastfmUser.playcount);
        }

        const verification: Verification = {
            verificationMessage: verificationMessage ?? null,
            verifyingUser: verifier,
            verifiedMember: memberToVerify,
            lastfmUser: lastfmUser ?? null,
            discordAccountCreated: memberToVerify.user.createdTimestamp,
            lastfmAccountCreated: lastfmUser?.registered ?? null,
            isReturningUser: false,
        };

        const existingUser = await this.usersRepository.getUserByUserId(verification.verifiedMember.id);
        if (!existingUser) {
            await this.usersRepository.addUser(verification);
        } else {
            verification.isReturningUser = true;
            await this.usersRepository.addVerificationToUser(verification);
        }

        await memberToVerify.roles.remove(this.env.UNVERIFIED_ROLE_ID as RoleResolvable);

        try {
            await verificationMessage.reactions.removeAll();
        } catch (e) {
            this.logger.debug(`Reactions already removed.`);
        }

        await this.loggingService.logVerification(verification);

        return {
            isSuccessful: true,
            shouldDelete: true,
        };
    }

    private async tryToVerifyUserWithoutLastfm(
        trigger: Message | MessageContextMenuCommandInteraction,
        memberToVerify: GuildMember
    ) {
        const isInteraction = trigger instanceof MessageContextMenuCommandInteraction;
        const reply = {
            embeds: [
                new EmbedBuilder()
                    .setColor(EmbedHelper.blue)
                    .setTitle('No Last.fm Account?')
                    .setDescription(
                        `It looks like you are trying to verify someone without a last.fm account. Please confirm this choice below.\n\nIf you wish to verify them with an account, run \`${this.env.PREFIX}${this.name} ${this.usageHint}\`.`
                    ),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().setComponents([
                    new ButtonBuilder().setCustomId(`verify`).setLabel('Verify').setStyle(ButtonStyle.Success),
                    ComponentHelper.cancelButton('cancel'),
                ]),
            ],
        };
        let noLastFmVerificationMessage;
        if (isInteraction) noLastFmVerificationMessage = await trigger.editReply(reply);
        else noLastFmVerificationMessage = await trigger.reply(reply);
        const collectorFilter = (interaction: Interaction) => interaction.user.id === trigger.member?.user.id;
        let verifyInteraction: ButtonInteraction;
        try {
            verifyInteraction = (await noLastFmVerificationMessage.awaitMessageComponent({
                filter: collectorFilter,
                time: 120_000,
            })) as ButtonInteraction;
        } catch (e) {
            this.logger.info(`Verifying user without last.fm account has timed out.`);
            if (!isInteraction) {
                await noLastFmVerificationMessage?.delete();
            }
            return false;
        }

        await verifyInteraction.update({});
        if (verifyInteraction.customId === 'cancel') {
            this.logger.info(`Verifying user without last.fm account was cancelled.`);
            if (!isInteraction) {
                await noLastFmVerificationMessage?.delete();
            }
            return false;
        } else {
            this.logger.info(`Verifying user '${memberToVerify.user.username}' without last.fm.`);
            await memberToVerify.roles.add(this.env.NO_LASTFM_ACCOUNT_ROLE_ID as RoleResolvable);
            if (!isInteraction) {
                await noLastFmVerificationMessage?.delete();
            }
            return true;
        }
    }

    private async assignScrobbleRoles(member: GuildMember, scrobbleCount: number) {
        if (scrobbleCount < this.env.SCROBBLE_MILESTONE_NUMBERS[1]) {
            await member.roles.add(this.env.SCROBBLE_MILESTONE_ROLE_IDS[0]);
            return;
        }
        for (const num of this.env.SCROBBLE_MILESTONE_NUMBERS) {
            const index = this.env.SCROBBLE_MILESTONE_NUMBERS.indexOf(num);
            if (index === 0) continue; // we skip the lowest scrobble role
            if (scrobbleCount >= num) await member.roles.add(this.env.SCROBBLE_MILESTONE_ROLE_IDS[index]);
            else break;
        }
    }
}
