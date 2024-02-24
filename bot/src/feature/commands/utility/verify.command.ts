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
    PartialMessage,
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

@injectable()
export class VerifyCommand implements ICommand {
    name: string = 'verify';
    description: string = 'Verifies a new user.';
    usageHint: string = '[user mention/ID] [last.fm username]';
    examples: string[] = ['', 'haiyn'];
    permissionLevel = CommandPermissionLevel.Backstager;
    aliases = ['v'];
    isUsableInDms = false;
    isUsableInServer = true;

    private loggingService: LoggingService;
    private lastFmClient: LastFM;
    private logger: Logger<VerifyCommand>;
    private env: Environment;
    private memberService: MemberService;
    private messageService: MessageService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<VerifyCommand>,
        @inject(TYPES.MessageService) messageService: MessageService,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
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

    async run(message: Message | PartialMessage, args: string[]): Promise<CommandResult> {
        let lastfmUsername;
        let memberToVerify;
        let verificationMessage;
        if (!message.reference) {
            if (args.length < 1)
                throw new ValidationError(
                    new Error(`args length is ${args.length}, expected length 2.`),
                    `Either reply to a user to verify them or supply the user and last.fm account name (optional)!`
                );
            const userId = TextHelper.getDiscordUserId(args[0]);
            if (!userId)
                throw new ValidationError(
                    new Error(`The supplied first argument is not a discord user: ${args[0]}`),
                    `The first argument in the command has to be a valid Discord user!`
                );
            memberToVerify = await this.memberService.getGuildMemberFromUserId(userId);
            lastfmUsername = args.length > 1 ? args[1] : null;
        } else {
            verificationMessage = await this.messageService.getChannelMessageByMessageId(
                message.reference.messageId!,
                message.channel as GuildTextBasedChannel
            );
            lastfmUsername = TextHelper.getLastfmUsername(verificationMessage!.content);
            memberToVerify = verificationMessage?.member;
        }

        if (!memberToVerify) {
            return {
                isSuccessful: false,
                replyToUser: `Looks like the user has left the server.`,
            };
        }

        const memberRoles = await this.memberService.getRolesFromGuildMember(memberToVerify);
        if (!memberRoles.find((r) => r.id === this.env.UNVERIFIED_ROLE_ID)) {
            return {
                isSuccessful: false,
                replyToUser: `This user is already verified!`,
            };
        }

        let lastfmUser;
        if (!lastfmUsername) {
            const noLastFmVerificationMessage = await message.reply({
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
            });
            const collectorFilter = (interaction: Interaction) => interaction.user.id === message.author!.id;
            let verifyInteraction: ButtonInteraction;
            try {
                verifyInteraction = (await noLastFmVerificationMessage.awaitMessageComponent({
                    filter: collectorFilter,
                    time: 120_000,
                })) as ButtonInteraction;
            } catch (e) {
                this.logger.info(`Verifying user without last.fm account has timed out.`);
                await message.delete();
                await noLastFmVerificationMessage.delete();
                return {};
            }

            await verifyInteraction.update({});
            if (verifyInteraction.customId === 'cancel') {
                this.logger.info(`Verifying user without last.fm account was cancelled.`);
                await message.delete();
                await noLastFmVerificationMessage.delete();
                return {};
            } else {
                await memberToVerify.roles.add(this.env.NO_LASTFM_ACCOUNT_ROLE_ID);
                await noLastFmVerificationMessage.delete();
            }
        } else {
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
            await this.assignScrobbleRoles(memberToVerify, lastfmUser.playcount);
        }

        const verification: Verification = {
            verificationMessage: verificationMessage ?? null,
            verifyingUser: message.author!,
            verifiedMember: memberToVerify,
            lastfmUser: lastfmUser ?? null,
            discordAccountCreated: memberToVerify.user.createdTimestamp,
            lastfmAccountCreated: lastfmUser?.registered ?? null,
        };

        // TODO: Save data model

        // await memberToVerify.roles.remove(this.unverifiedRoleId);

        await this.loggingService.logVerification(verification);

        return {
            isSuccessful: true,
            shouldDelete: true,
        };
    }

    private async assignScrobbleRoles(member: GuildMember, scrobbleCount: number) {
        if (scrobbleCount < this.env.SCROBBLE_MILESTONE_NUMBERS[0]) {
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
