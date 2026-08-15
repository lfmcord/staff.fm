import { Environment } from '@models/environment';
import { LastfmError } from '@models/lastfm-error.model';
import { Verification } from '@src/feature/commands/administration/models/verification.model';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ComponentHelper } from '@src/helpers/component.helper';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { FlagsRepository } from '@src/infrastructure/repositories/flags.repository';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    GuildMember,
    Interaction,
    Message,
    MessageContextMenuCommandInteraction,
    RoleResolvable,
    SlashCommandBuilder,
    User,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import LastFM from 'lastfm-typed';
import { Logger } from 'tslog';

@injectable()
export class VerifyCommand implements ICommand {
    name: string = 'verify';
    description: string = 'Verifies a new user. Either reply to the user or use the optional parameters.';
    permissionLevel = CommandPermissionLevel.Backstager;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .addUserOption((option) =>
            option.setName('user').setDescription('The discord user to verify').setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('lastfm')
                .setDescription('The last.fm username to verify the user with')
                .setRequired(false)
        );

    private loggingService: LoggingService;
    private lastFmClient: LastFM;
    private logger: Logger<VerifyCommand>;
    private flagsRepository: FlagsRepository;
    private usersRepository: UsersRepository;
    private env: Environment;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<VerifyCommand>,
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
    }

    validateArgs(_: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const user = interaction.options.getUser('user')!;
        return await this.verifyUser(
            interaction,
            user,
            interaction.user,
            undefined,
            interaction.options.getString('lastfm') ?? undefined
        );
    }

    async runInteraction(interaction: MessageContextMenuCommandInteraction): Promise<CommandResult> {
        return await this.verifyUser(
            interaction,
            interaction.targetMessage.author,
            interaction.member!.user as User,
            interaction.targetMessage
        );
    }

    private async verifyUser(
        trigger: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
        targetUser: User,
        verifier: User,
        verificationMessage?: Message,
        lastfmUsername?: string
    ): Promise<CommandResult> {
        const memberToVerify = await this.memberService.getGuildMemberFromUserId(targetUser.id);
        const userToVerify = await this.memberService.fetchUser(targetUser.id);
        const verifierMember = await this.memberService.getGuildMemberFromUserId(verifier.id);

        if (!userToVerify) {
            return {
                isSuccessful: false,
                replyToUser: { content: `This doesn't seem to be a valid discord user!` },
            };
        }

        if ((await this.memberService.getMemberPermissionLevel(verifierMember!)) < CommandPermissionLevel.Moderator) {
            this.logger.debug(`User is not privileged moderator, check for flagged account.`);
            const flags = await this.flagsRepository.getAllFlagTerms();
            if (
                flags.find(
                    (flaggedTerm) =>
                        verificationMessage?.content?.match(flaggedTerm) != null ||
                        lastfmUsername?.match(flaggedTerm) != null ||
                        this.memberService.checkIfMemberIsFlagged(flaggedTerm, memberToVerify ?? userToVerify)
                )
            ) {
                this.logger.debug(`Verifier is trying to verify a flagged account.`);
                return {
                    isSuccessful: false,
                    replyToUser: {
                        content: `A moderator or administrator needs to verify this user. Please let them know.`,
                        flags: 'Ephemeral',
                    },
                };
            }
        }

        if (verificationMessage) await verificationMessage.react(TextHelper.loading);
        let lastfmUser;
        if (!lastfmUsername) {
            if (!memberToVerify) {
                if (verificationMessage) await verificationMessage.reactions.removeAll();
                return {
                    isSuccessful: false,
                    replyToUser: {
                        content:
                            `I cannot verify a user that isn't on the server without a last.fm account. ` +
                            `If you know a last.fm account for this user, please link it with \`/verify ${userToVerify.id}\`.`,
                    },
                };
            }
            const wasVerified = await this.tryToVerifyUserWithoutLastfm(trigger, memberToVerify);
            if (!wasVerified) {
                this.logger.debug(`Verifying without a last.fm account was aborted or timed out.`);
                if (verificationMessage) await verificationMessage.reactions.removeAll();
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
                try {
                    if (verificationMessage) await verificationMessage.reactions.removeAll();
                } catch (e) {
                    this.logger.debug(`Reactions already removed.`);
                }
                return {
                    isSuccessful: false,
                    replyToUser: {
                        content: `The username '${lastfmUsername}' doesn't seem to be an existing Last.fm user.`,
                        flags: 'Ephemeral',
                    },
                };
            }
            this.logger.debug(`User has a playcount of ${lastfmUser.playcount}`);
            if (lastfmUser.playcount == 0) {
                await this.loggingService.logZeroPlaycountVerification(userToVerify, lastfmUser.name);
            }
            if (memberToVerify) await this.memberService.assignScrobbleRoles(memberToVerify, lastfmUser.playcount);
        }

        const verification: Verification = {
            verificationMessage: verificationMessage ?? null,
            verifyingUser: verifier,
            verifiedUser: userToVerify,
            lastfmUser: lastfmUser ?? null,
            discordAccountCreated: userToVerify.createdTimestamp,
            lastfmAccountCreated: lastfmUser?.registered ?? null,
            isReturningUser: false,
        };

        const existingUser = await this.usersRepository.getUserByUserId(verification.verifiedUser.id);
        if (!existingUser) {
            await this.usersRepository.addUser(verification);
        } else {
            verification.isReturningUser = true;
            await this.usersRepository.addVerificationToUser(verification);
        }

        if (memberToVerify) {
            await memberToVerify.roles.remove(this.env.ROLES.UNVERIFIED_ROLE_ID as RoleResolvable);
            await memberToVerify.roles.add(this.env.ROLES.VERIFIED_ROLE_ID as RoleResolvable);
        }

        try {
            if (verificationMessage) await verificationMessage.reactions.removeAll();
        } catch (e) {
            this.logger.debug(`Reactions already removed.`);
        }

        await this.loggingService.logVerification(verification);

        return {
            isSuccessful: true,
            replyToUser: {
                content: `I've verified the user <@!${userToVerify.id}>.`,
                flags: trigger.channel?.id == this.env.CHANNELS.VERIFICATION_CHANNEL_ID ? 'Ephemeral' : undefined,
            },
        };
    }

    private async tryToVerifyUserWithoutLastfm(
        trigger: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
        memberToVerify: GuildMember
    ) {
        const isInteraction = trigger instanceof MessageContextMenuCommandInteraction;
        const reply = {
            embeds: [
                new EmbedBuilder()
                    .setColor(EmbedHelper.blue)
                    .setTitle('No Last.fm Account?')
                    .setDescription(
                        `It looks like you are trying to verify someone without a last.fm account. ` +
                            `Please confirm this choice below.\n\n` +
                            `If you wish to verify them with an account, run \`/${this.name}\`.`
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
            await memberToVerify.roles.add(this.env.ROLES.NO_LASTFM_ACCOUNT_ROLE_ID as RoleResolvable);
            if (!isInteraction) {
                await noLastFmVerificationMessage?.delete();
            }
            return true;
        }
    }
}
