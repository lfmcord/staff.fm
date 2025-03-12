import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { StaffMailCustomIds } from '@src/feature/interactions/models/staff-mail-custom-ids';
import { StaffMailType } from '@src/feature/interactions/models/staff-mail-type';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { ComponentHelper } from '@src/helpers/component.helper';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import {
    ActionRowBuilder,
    bold,
    ButtonBuilder,
    EmbedBuilder,
    Interaction,
    Message,
    MessageComponentInteraction,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class StaffMailContactCommand implements ICommand {
    name: string = 'contact';
    description: string = 'Messages a user and opens a new triggers channel with them.';
    usageHint: string = '<user/id> <message to user>';
    examples: string[] = ['356178941913858049 Hello, we would like to speak to you!'];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<StaffMailContactCommand>;
    environment: Environment;
    loggingService: LoggingService;
    channelService: ChannelService;
    staffMailRepository: StaffMailRepository;
    memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StaffMailContactCommand>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.ChannelService) channelService: ChannelService,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.ENVIRONMENT) environment: Environment
    ) {
        this.environment = environment;
        this.loggingService = loggingService;
        this.channelService = channelService;
        this.staffMailRepository = staffMailRepository;
        this.memberService = memberService;
        this.logger = logger;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0]);
        if (!userId) {
            throw new ValidationError(
                `Cannot get user ID from string '${args[0]}'`,
                `${args[0]} doesn't seem to be a user mention or a valid user ID.`
            );
        }
        const member = await this.memberService.getGuildMemberFromUserId(userId);
        if (!member) {
            return {
                isSuccessful: false,
                reason: `Cannot find guild member with ID ${userId}`,
                replyToUser: `I cannot find the user <@!${userId}>. Have they left the server?`,
            };
        }

        const content = args.slice(1).join(' ');
        const sendButton = ComponentHelper.sendButton(StaffMailCustomIds.ContactMemberSend);
        const sendAnonButton = ComponentHelper.sendAnonButton(StaffMailCustomIds.ContactMemberSendAnon);
        const cancelButton = ComponentHelper.cancelButton(StaffMailCustomIds.ContactMemberCancel);
        let description = `${bold('Recipient:')}\n<@${userId}>\n\n${bold('Content:')}\n${content}`;
        if (message.attachments.size > 0) {
            let attachmentCount = 1;
            message.attachments.forEach((attachment) => {
                description += `\n${bold('Attachment ' + attachmentCount + ':')} ${attachment.proxyURL}\n`;
            });
            attachmentCount++;
        }
        const response = await message.reply({
            embeds: [
                new EmbedBuilder().setTitle(`Are you sure you want to send this message?`).setDescription(description),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents([sendButton, sendAnonButton, cancelButton]),
            ],
        });

        let confirmation: MessageComponentInteraction;
        const collectorFilter = (interaction: Interaction) => interaction.user.id === message.author.id;
        try {
            confirmation = await response.awaitMessageComponent({
                filter: collectorFilter,
                time: 60_000,
            });
        } catch (e) {
            await response.edit({
                content: 'Confirmation not received within 1 minute, cancelling.',
                components: [],
            });
            return {};
        }

        if (confirmation!.customId == 'contact-member-cancel') {
            await response.edit({ content: `You cancelled contacting the member.`, embeds: [], components: [] });
            await confirmation!.reply({ ephemeral: true, content: 'Cancelled.' });
            return {};
        }
        const summary = 'New Message from Staff';
        const isAnonymousStaffMember = confirmation.customId.includes('anon');
        const embed = EmbedHelper.getStaffMailUserViewIncomingEmbed(
            isAnonymousStaffMember ? null : message.author,
            false,
            content,
            summary,
            StaffMailType.Staff
        );

        let messageToUser;
        try {
            messageToUser = await member.send({
                content: `📫 You've received a new message from staff!`,
                embeds: [EmbedHelper.getStaffMailOpenEmbed(true), EmbedHelper.getStaffMailLinkToLatestMessage()],
            });
        } catch (e) {
            this.logger.warn(`Could not send message to user ${TextHelper.userLog(member.user)}.`, e);
            await response.edit({
                content: `I could not send a message to the user. They most likely have their DMs turned off.`,
                embeds: [],
                components: [],
            });
            return {};
        }

        await messageToUser.pin();
        const incomingMessage = await member.send({ embeds: [embed], files: Array.from(message.attachments.values()) });
        const newStaffMailChannel = await this.staffMailRepository.createStaffMailChannel(
            member.user,
            StaffMailModeEnum.NAMED
        );
        await messageToUser.edit({
            embeds: [messageToUser.embeds[0], EmbedHelper.getStaffMailLinkToLatestMessage(incomingMessage)],
        });
        const newStaffMail = await this.staffMailRepository.createStaffMail(
            member.user,
            StaffMailType.Staff,
            StaffMailModeEnum.NAMED,
            summary,
            messageToUser,
            incomingMessage,
            newStaffMailChannel
        );

        await newStaffMailChannel!.send({
            embeds: [
                EmbedHelper.getStaffMailStaffViewNewEmbed(
                    member.user,
                    message.author,
                    StaffMailType.Staff,
                    'Manually contacted member',
                    this.environment.CORE.PREFIX
                ),
            ],
        });
        await newStaffMailChannel!.send({
            embeds: [
                EmbedHelper.getStaffMailStaffViewOutgoingEmbed(
                    message.author,
                    isAnonymousStaffMember,
                    member.user,
                    content
                ),
            ],
            files: Array.from(message.attachments.values()),
        });

        await this.loggingService.logStaffMailEvent(
            true,
            'Manually contacted member',
            StaffMailType.Staff,
            member.user,
            message.author,
            null
        );
        await response.edit({
            content: `I've sent the message to the user and created channel <#${newStaffMailChannel.id}>.`,
            embeds: [],
            components: [],
        });

        return {
            isSuccessful: true,
        };
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length < 2) {
            throw new ValidationError(
                'Not enough arguments supplied for contact command.',
                'You must supply both a user to contact and the message to send them!'
            );
        }
        if (!TextHelper.isDiscordUser(args[0])) {
            throw new ValidationError(
                `'${args[0]}' is not a valid discord user mention or ID!`,
                `Your first argument must be either a mention or a user ID.`
            );
        }
        this.logger.trace(args);
        return Promise.resolve();
    }
}
