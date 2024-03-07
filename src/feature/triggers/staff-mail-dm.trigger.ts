import { inject, injectable } from 'inversify';
import { Embed, inlineCode, Message } from 'discord.js';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { TYPES } from '@src/types';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { Logger } from 'tslog';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { Environment } from '@models/environment';

@injectable()
export class StaffMailDmTrigger {
    staffMailRepository: StaffMailRepository;
    logger: Logger<StaffMailDmTrigger>;
    env: Environment;
    channelService: ChannelService;

    constructor(
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.BotLogger) logger: Logger<StaffMailDmTrigger>,
        @inject(TYPES.ChannelService) channelService: ChannelService,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.env = env;
        this.channelService = channelService;
        this.logger = logger;
        this.staffMailRepository = staffMailRepository;
    }

    public async run(message: Message): Promise<void> {
        if (!message.reference) {
            await message.reply(
                `It looks like you are trying to chat with me. If you want to reply to an existing StaffMail, please reply to a pinned message. If you do not have any open StaffMails, you can create a new one with ${inlineCode(this.env.PREFIX + 'staffmail')}!`
            );
            return;
        }

        const staffMail = await this.staffMailRepository.getStaffMailByLastMessageId(message.reference!.messageId!);
        if (staffMail == null) {
            await message.reply({
                content:
                    'In order to send a reply or follow-up message in a StaffMail, please always reply to the pinned message! Check the pins in this channel to see them.',
            });
            return;
        }

        await staffMail.channel!.send({
            embeds: [
                EmbedHelper.getStaffMailStaffViewIncomingEmbed(
                    staffMail.mode == StaffMailModeEnum.NAMED ? message.author : null,
                    message.content
                ),
            ],
            files: Array.from(message.attachments.values()),
        });

        const newStaffMailMessage = await message.channel.send({
            embeds: [
                EmbedHelper.getStaffMailUserViewOutgoingEmbed(
                    message.author,
                    staffMail.mode === StaffMailModeEnum.ANONYMOUS,
                    message.content,
                    staffMail.summary,
                    staffMail.type
                ),
            ],
            files: Array.from(message.attachments.values()),
        });

        try {
            const oldStaffMailMessage = await this.channelService.getMessageFromChannelByMessageId(
                message.reference.messageId!,
                message.channel
            );
            const newEmbeds: Embed[] =
                oldStaffMailMessage?.embeds.map((e: Embed) => {
                    return { ...e.data, footer: undefined } as unknown as Embed;
                }) ?? oldStaffMailMessage!.embeds;
            await oldStaffMailMessage?.edit({ embeds: newEmbeds });
            await oldStaffMailMessage?.unpin();
        } catch (e) {
            this.logger.warn(`Could not edit old staff mail embed.`, e);
        }

        await this.channelService.pinNewStaffMailMessageInDmChannel(
            newStaffMailMessage,
            staffMail.lastMessageId,
            staffMail.user!
        );

        await this.staffMailRepository.updateStaffMailLastMessageId(staffMail.id, newStaffMailMessage.id);
        return Promise.resolve();
    }
}
