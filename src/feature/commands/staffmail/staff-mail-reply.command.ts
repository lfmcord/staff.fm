import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { StaffMail } from '@src/infrastructure/repositories/models/staff-mail.model';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { TYPES } from '@src/types';
import { ChatInputCommandInteraction, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class StaffMailReplyCommand implements ICommand {
    name: string = 'reply';
    description: string = 'Replies to the StaffMail. Must be used in StaffMail channel.';
    usageHint: string = '<message to user>';
    examples: string[] = ['Hi, thank you for reaching out!'];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = ['areply'];
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setContexts(InteractionContextType.BotDM)
        .addStringOption((option) =>
            option.setName('content').setDescription('Add some content to your message')
        )
        .addAttachmentOption((option) =>
            option.setName('attachment').setDescription('Add an attachment to the message')
        )
        .addBooleanOption((option) =>
            option.setName('anonymous').setDescription('Send the message anonymously')
        )

    private logger: Logger<StaffMailReplyCommand>;
    channelService: ChannelService;
    private staffMailRepository: StaffMailRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StaffMailReplyCommand>,
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.ChannelService) channelService: ChannelService
    ) {
        this.channelService = channelService;
        this.logger = logger;
        this.staffMailRepository = staffMailRepository;
    }

    public validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        if(!interaction.options.getString('content') && !interaction.options.getAttachment('attachment')) {
            throw new ValidationError(`Neither content nor attachment provided.`, `You must provide either content or an attachment for the staff mail message.`);
        }

        if(!interaction.user.dmChannel?.isSendable()) {
            throw new ValidationError(`Cannot send DM to user.`, `I cannot send you a DM. Please check your privacy settings and try again.`);
        }

        return Promise.resolve();
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        this.logger.info(
            `New staffmail reply by user ${TextHelper.userLog(interaction.user)} for channel ID ${interaction.channelId}.`
        );

        const isAnonReply = interaction.options.getBoolean('anonymous') ?? false;
        const staffMail: StaffMail | null = await this.staffMailRepository.getStaffMailByChannelId(interaction.channelId);
        if (!staffMail) {
            throw new ValidationError(
                `No StaffMail in DB for channel ID ${interaction.channelId}.`,
                'You can only use this command in an open StaffMail channel!'
            );
        }

        if (!staffMail.user) {
            return {
                isSuccessful: false,
                reason: `User with user ID ${staffMail.userId} has left the guild.`,
                replyToUser: { content: `This user seems to have left the server. You can close this StaffMail.` },
            };
        }

        this.logger.debug(
            `Preparing message to user ${staffMail.mode != StaffMailModeEnum.ANONYMOUS ? TextHelper.userLog(staffMail.user) : ''}.`
        );

        const attachment = interaction.options.getAttachment('attachment');
        const content = interaction.options.getString('content');

        let messageToUser;
        try {
            messageToUser = await staffMail.user?.send({
                embeds: [
                    EmbedHelper.getStaffMailUserViewIncomingEmbed(
                        isAnonReply ? null : interaction.user,
                        staffMail.mode === StaffMailModeEnum.ANONYMOUS,
                        staffMail.type,
                        content ?? undefined,
                    ),
                ],
                files: attachment ? [attachment] : [],
            });
        } catch (e) {
            this.logger.warn(`Could not send message to user ${TextHelper.userLog(staffMail.user)}.`, e);
            return {
                isSuccessful: false,
                replyToUser: {
                    content: `I could not send a message to the user. They most likely have their DMs turned off.`,
                },
            };
        }

        this.logger.debug(`Updating staff mail in DB and staff mail channel...`);
        await this.staffMailRepository.updateStaffMailLastMessageId(staffMail.id);

        await staffMail.channel!.send({
            embeds: [
                EmbedHelper.getStaffMailStaffViewOutgoingEmbed(
                    interaction.user,
                    isAnonReply,
                    staffMail.mode === StaffMailModeEnum.ANONYMOUS ? null : staffMail.user,
                    content ?? undefined
                ),
            ],
            files: attachment ? [attachment] : [],
        });

        return {};
    }
}
