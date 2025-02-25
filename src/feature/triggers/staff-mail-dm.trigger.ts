import { Environment } from '@models/environment';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { TYPES } from '@src/types';
import { Embed, Message, inlineCode } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

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
                `It looks like you are trying to chat with me.\n` +
                    `- If you want to reply to an existing StaffMail, please check your pinned messages for instructions.\n` +
                    `- If you want to report a message, you can report it with ${inlineCode(this.env.CORE.PREFIX + 'report')}. You can also right-click/tap-and-hold the message in the server you want to report and select Apps -> Report Message.\n` +
                    `- If you do not have any open StaffMails, you can create a new one with ${inlineCode(this.env.CORE.PREFIX + 'staffmail')}!`
            );
            return;
        }

        const staffMail = await this.staffMailRepository.getStaffMailByLastMessageId(message.reference!.messageId!);
        if (staffMail == null) {
            await message.reply({
                content:
                    'In order to send a reply or follow-up message in a StaffMail, please always reply to latest message you sent or received! Check the pins in this channel to see a link to it.',
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
            let mainMessage =
                (await this.channelService.getMessageFromChannelByMessageId(
                    staffMail.mainMessageId,
                    newStaffMailMessage.channel
                )) ?? undefined;
            mainMessage = await mainMessage?.edit({
                embeds: [mainMessage.embeds[0], EmbedHelper.getStaffMailLinkToLatestMessage(newStaffMailMessage)],
            });
            const oldStaffMailMessage =
                staffMail.mainMessageId === message.reference.messageId
                    ? mainMessage
                    : await this.channelService.getMessageFromChannelByMessageId(
                          message.reference.messageId!,
                          message.channel
                      );
            const newEmbeds: Embed[] =
                oldStaffMailMessage?.embeds.map((e: Embed) => {
                    return { ...e.data, footer: undefined } as unknown as Embed;
                }) ?? oldStaffMailMessage!.embeds;
            await oldStaffMailMessage?.edit({ embeds: newEmbeds });
        } catch (e) {
            this.logger.warn(`Could not edit old staff mail embeds.`, e);
        }

        await this.staffMailRepository.updateStaffMailLastMessageId(staffMail.id, newStaffMailMessage.id);
        return Promise.resolve();
    }
}
