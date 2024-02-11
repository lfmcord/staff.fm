import { inject, injectable } from 'inversify';
import { Message, MessageResolvable, MessageType } from 'discord.js';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { TYPES } from '@src/types';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StaffMailModeEnum } from '@src/feature/staffmail/models/staff-mail-mode.enum';

@injectable()
export class StaffMailDmReply {
    staffMailRepository: StaffMailRepository;

    constructor(@inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository) {
        this.staffMailRepository = staffMailRepository;
    }

    public async reply(message: Message): Promise<void> {
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
        });
        await newStaffMailMessage.pin();
        await (await message.channel.messages.fetch(staffMail.lastMessageId as MessageResolvable)).unpin();
        await message.channel.messages.cache
            .filter((m: Message) => (m.type = MessageType.ChannelPinnedMessage))
            .last()
            ?.delete();
        await this.staffMailRepository.updateStaffMailLastMessageId(staffMail.id, newStaffMailMessage.id);
        return Promise.resolve();
    }
}
