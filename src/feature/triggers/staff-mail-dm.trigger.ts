import { Environment } from '@models/environment';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { TYPES } from '@src/types';
import {
    ContainerBuilder,
    Embed,
    Message,
    inlineCode,
    SelectMenuInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { Constants } from '@models/constants';
import moment = require('moment');
import { Interactions } from '@src/feature/interactions/models/interactions';

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
        if (!message.channel.isSendable()) {
            this.logger.error(`Cannot send messages in channel ${message.channel.id}.`);
            return;
        }


        const staffMails = await this.staffMailRepository.getAllStaffMailsByUserId(message.author.id);
        if (staffMails.length == 0) {
            await message.reply({
                content:
                    'You currently don\'t have any open StaffMail threads. Please use the `/staffmail` command to start a new thread.',
            });
            return;
        }

        if (staffMails.length > 1) {
            // User has multiple staffmails open, query them which one to reply to.

            const container = new ContainerBuilder()
                .setAccentColor(EmbedHelper.blue)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(
                        'You currently have multiple open StaffMail threads open. Please select the thread you want to reply to from the dropdown below:\n\n' +
                        staffMails.map((sm, index) => `${index + 1}. ${Constants.StaffMailCategories[sm.type]} from <t:${moment(sm.createdAt).unix()}:f> (last message <t:${moment(sm.lastMessageAt).unix()}:R>) `).join('\n')
                    ),
                )

            let selectOptions = staffMails.map((sm, index) => {
                return new StringSelectMenuOptionBuilder()
                    .setLabel(`${index + 1}. ${Constants.StaffMailCategories[sm.type]}`)
                    .setDescription(`from ${moment(sm.createdAt).format("dddd, MMMM Do YYYY, hh:mm:ss")}`)
                    .setValue(sm.id.toString())
            })
            const staffMailSelection = new StringSelectMenuBuilder()
                .setCustomId(`${Interactions.StaffMail.SendFollowUp}-${message.id}`)
                .setPlaceholder('Make a selection!')
                .addOptions(selectOptions);

            container.addActionRowComponents(row => row.addComponents(staffMailSelection));

            if(staffMails.some(sm => sm.mode == StaffMailModeEnum.ANONYMOUS)) {
                container.addSeparatorComponents((separator) => separator)
                container.addTextDisplayComponents(textDisplay => textDisplay.setContent(`-# If you are replying in staffmail that is anonymous, your follow up messages will also be anonymous.`))
            }

            await message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });

            return;
        }

        const staffMail = staffMails[0];

        await staffMail.channel!.send({
            embeds: [
                EmbedHelper.getStaffMailStaffViewIncomingEmbed(
                    staffMail.mode == StaffMailModeEnum.NAMED ? message.author : null,
                    message.content
                ),
            ],
            files: Array.from(message.attachments.values()),
        });

        await message.channel.send({
            embeds: [
                EmbedHelper.getStaffMailUserViewOutgoingEmbed(
                    message.author,
                    staffMail.mode == StaffMailModeEnum.ANONYMOUS,
                    message.content,
                    staffMail.type
                ),
            ],
            files: Array.from(message.attachments.values()),
        })

        await this.staffMailRepository.updateStaffMailLastMessageId(staffMail.id);
        return Promise.resolve();
    }
}
