
import { Interactions } from '@src/feature/interactions/models/interactions';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { TYPES } from '@src/types';
import { StringSelectMenuInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { MessageService } from '@src/infrastructure/services/message.service';
import {
    IStringSelectMenuInteraction
} from '@src/feature/interactions/abstractions/string-select-menu-interaction.interface';

@injectable()
export class StaffMailFollowUpInteraction implements IStringSelectMenuInteraction {
    customIds = [
        Interactions.StaffMail.SendFollowUp,
    ];
    private logger: Logger<StaffMailFollowUpInteraction>;
    private messageService: MessageService;
    private staffMailRepository: StaffMailRepository;

    constructor(
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.BotLogger) logger: Logger<StaffMailFollowUpInteraction>,
        @inject(TYPES.MessageService) messageService: MessageService
    ) {
        this.messageService = messageService;
        this.logger = logger;
        this.staffMailRepository = staffMailRepository;
    }

    async manage(interaction: StringSelectMenuInteraction) {
        const messageId = interaction.customId.split('-').pop();
        const staffMailId = interaction.values[0];
        if(!staffMailId) {
            this.logger.warn(`StaffMail ID not found in interaction customId: ${interaction.values[0]}`);
            await interaction.reply({
                content: 'StaffMail ID not found.',
                flags: 'Ephemeral',
            });
            return;
        }

        const staffMail = await this.staffMailRepository.getStaffMailById(staffMailId);
        if (!staffMail) {
            this.logger.warn(`StaffMail with ID ${staffMailId} not found.`);
            await interaction.reply({
                content: 'StaffMail not found.',
                flags: 'Ephemeral',
            });
            return;
        }

        const message = await this.messageService.getChannelMessageByMessageId(messageId!, interaction.channel!);
        if (!message) {
            this.logger.warn(`Message with ID ${messageId} not found in channel ${interaction.channelId}.`);
            await interaction.reply({
                content: 'Message not found.',
                flags: 'Ephemeral',
            });
            return;
        }

        await staffMail.channel!.send({
            embeds: [
                EmbedHelper.getStaffMailStaffViewIncomingEmbed(
                    staffMail.mode == StaffMailModeEnum.NAMED ? interaction.user : null,
                    message.content
                ),
            ],
            files: Array.from(message.attachments.values()),
        });

        if(interaction.channel!.isSendable()) {
            await interaction.channel!.send({
                embeds: [
                    EmbedHelper.getStaffMailUserViewOutgoingEmbed(
                        interaction.user,
                        staffMail.mode == StaffMailModeEnum.ANONYMOUS,
                        message.content,
                        staffMail.type
                    ),
                ],
                files: Array.from(message.attachments.values()),
            })
        }

        await this.staffMailRepository.updateStaffMailLastMessageId(staffMail.id);

        await interaction.message.delete();
    }
}
