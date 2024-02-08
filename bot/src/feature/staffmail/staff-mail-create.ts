import { Client, italic, Message } from 'discord.js';
import { StaffMailModeEnum } from '@src/feature/staffmail/models/staff-mail-mode.enum';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { MessageService } from '@src/infrastructure/services/message.service';
import { StaffMail } from '@src/feature/staffmail/models/staff-mail.model';

@injectable()
export class StaffMailCreate {
    private logger: Logger<StaffMailCreate>;
    private messageService: MessageService;
    private staffMailRepository: StaffMailRepository;
    private client: Client;
    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StaffMailCreate>,
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.MessageService) messageService: MessageService
    ) {
        this.messageService = messageService;
        this.staffMailRepository = staffMailRepository;
        this.client = client;
        this.logger = logger;
    }
    public async createStaffMail(message: Message) {
        this.logger.info(`New staff mail message received.`);
        const start = new Date().getTime();

        let staffMail = await this.staffMailRepository.getStaffMailByUserId(message.author.id);

        if (!staffMail) {
            staffMail = await this.createNewStaffMail(message);
            if (!staffMail) return;
        } else if (staffMail.channel == null) {
            await this.sendStaffMailMessage(staffMail, message);
        }

        const messageForStaff = EmbedHelper.getStaffMailNewChannelEmbed(
            staffMail.mode === StaffMailModeEnum.ANONYMOUS ? null : message.author,
            staffMail.mode === StaffMailModeEnum.ANONYMOUS ? null : message.author
        ).setDescription(message.content);
        await staffMail.channel!.send({ embeds: [messageForStaff] });

        const messageForUser = EmbedHelper.getStaffMailEmbed(message.author, false, false, message.content);
        await message.channel.send({ embeds: [messageForUser] });

        const end = new Date().getTime();

        this.logger.info(`Staff mail message processed. Processing took ${end - start}ms.`);
    }

    private async createNewStaffMail(message: Message): Promise<StaffMail | null> {
        // TODO: Send intro message too
        const query = EmbedHelper.getUserStaffMailEmbed(this.client).setDescription(
            `Hello! Looks like you are trying to send a message to the Lastcord Staff team. How do you want to send it?\n\nPlease react to this message with the according emoji:\n1️⃣ With my name\n2️⃣ Anonymous\n❌ Abort\n\n${italic('Note: Please be aware that sending an anonymous message might make it harder for the staff team to handle your issue.')}`
        );
        // TODO: Use buttons instead?
        const userReply = await this.messageService.getUserReplyInChannel(
            { embeds: [query] },
            message.author,
            message.channel,
            ['1️⃣', '2️⃣', '❌'],
            true
        );

        if (userReply == null) {
            this.logger.debug(`User confirmation to open a StaffMail was negative.`);
            return null;
        }

        const mode = userReply === '1️⃣' ? StaffMailModeEnum.NAMED : StaffMailModeEnum.ANONYMOUS;

        this.logger.debug(
            `User confirmation was positive. Trying to create Staff Mail channel in mode '${mode.toString()}'...`
        );
        const staffMail = await this.staffMailRepository.createStaffMail(message.author, mode);

        // TODO: Send new ticket log

        this.logger.info(
            `New staff mail channel has been created for user for user '${staffMail.mode === StaffMailModeEnum.ANONYMOUS ? 'Anonymous' : message.author.username}' (ID ${StaffMailModeEnum.ANONYMOUS ? '0' : message.author.id}) in mode '${staffMail.mode.toString()}'.`
        );

        return staffMail;
    }

    private async sendStaffMailMessage(staffMail: StaffMail, message: Message) {
        const messageToSend = EmbedHelper.getStaffMailEmbed(
            staffMail.mode === StaffMailModeEnum.NAMED ? staffMail.user : null,
            false,
            true,
            message.content
        );
        await staffMail.channel!.send({ embeds: [messageToSend] });
    }
}
