import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { StaffMailType } from '@src/feature/models/staff-mail-type';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
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
    ButtonBuilder, ChatInputCommandInteraction,
    EmbedBuilder,
    Interaction, InteractionContextType,
    MessageComponentInteraction, MessageCreateOptions, PermissionFlagsBits, SlashCommandBuilder,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class StaffMailContactCommand implements ICommand {
    name: string = 'contact';
    description: string = 'Messages a user and opens a new triggers channel with them.';
    permissionLevel = CommandPermissionLevel.Moderator;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .setContexts(InteractionContextType.Guild)
        .addUserOption((option) =>
            option.setName('user').setDescription('The discord user to contact').setRequired(true)
        )
        .addStringOption((option) =>
            option.setName('content').setDescription('The content').setRequired(true)
        )
        .addAttachmentOption((option) =>
            option.setName('attachment').setDescription('Add an attachment to the message')
        )
        .addBooleanOption((option) =>
            option.setName('anonymous').setDescription('Send the message anonymously')
        )

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

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const userId = interaction.options.getUser('user')!.id;
        const member = await this.memberService.getGuildMemberFromUserId(userId);
        if (!member) {
            return {
                isSuccessful: false,
                reason: `Cannot find guild member with ID ${userId}`,
                replyToUser: { content: `I cannot find the user <@!${userId}>. Have they left the server?` },
            };
        }
        const content = interaction.options.getString('content')!;
        let description = `${bold('Recipient:')}\n<@${userId}>\n\n${bold('Content:')}\n${content}`;
        const summary = 'New Message from Staff';
        const isAnonymousStaffMember = interaction.options.getBoolean('anonymous') ?? false;
        let attachment = interaction.options.getAttachment("attachment")
        if (attachment) {
            description += `\n${bold('Attachment:')} ${attachment.proxyURL}\n`;
        }
        const embed = EmbedHelper.getStaffMailUserViewIncomingEmbed(
            isAnonymousStaffMember ? null : interaction.user,
            false,
            StaffMailType.Staff,
            content,
        );

        let messageToUser;
        try {
            messageToUser = await member.send({
                content: `📫 You've received a new message from staff!`,
                embeds: [EmbedHelper.getStaffMailOpenEmbed(true), embed],
                files: attachment ? [attachment] : [],
            });
        } catch (e) {
            this.logger.warn(`Could not send message to user ${TextHelper.userLog(member.user)}.`, e);
            return {
                isSuccessful: false,
                reason: `Could not send message to user ${TextHelper.userLog(member.user)}.`,
                replyToUser: {
                    content: `I cannot send a message to <@${userId}> because their DMs are closed or they have me blocked.`,
                },
            };
        }

        const newStaffMailChannel = await this.staffMailRepository.createStaffMailChannel(
            member.user,
            StaffMailModeEnum.NAMED
        );
        const newStaffMail = await this.staffMailRepository.createStaffMail(
            member.user,
            StaffMailType.Staff,
            StaffMailModeEnum.NAMED,
            newStaffMailChannel
        );

        const roles = await this.memberService.getRolesFromGuildMember(member);
        await newStaffMailChannel!.send({
            embeds: [
                EmbedHelper.getStaffMailStaffViewNewEmbed(
                    member,
                    interaction.user,
                    StaffMailType.Staff,
                    roles
                ),
            ],
        });
        await newStaffMailChannel!.send({
            embeds: [
                EmbedHelper.getStaffMailStaffViewOutgoingEmbed(
                    interaction.user,
                    isAnonymousStaffMember,
                    member.user,
                    content
                ),
            ],
            files: attachment ? [attachment] : [],
        });

        await this.loggingService.logStaffMailOpen(
            StaffMailType.Staff,
            member.user,
            interaction.user
        );

        return {
            isSuccessful: true,
            replyToUser: {
                content: `I've sent the message to the user and created channel <#${newStaffMailChannel.id}>.`,
            },
        };
    }

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }
}
