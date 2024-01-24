import { inject, injectable } from 'inversify';
import {
    Client,
    EmbedBuilder,
    italic,
    Message,
    MessageReaction,
    ReactionEmoji,
    User,
} from 'discord.js';
import { StaffMailModeEnum } from '@src/feature/staffmail/models/StaffMailMode.enum';
import { EmbedHelper } from '@src/helpers/EmbedHelper';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { IHandler } from '@src/handlers/models/IHandler';
import { TextHelper } from '@src/helpers/TextHelper';
import { StaffMailCreate } from '@src/feature/staffmail/StaffMailCreate';

@injectable()
export class DirectMessageHandler implements IHandler {
    private readonly logger: Logger<DirectMessageHandler>;
    private readonly prefix: string;
    private readonly staffMailCreate: StaffMailCreate;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<DirectMessageHandler>,
        @inject(TYPES.PREFIX) prefix: string,
        @inject(TYPES.StaffMailCreate) staffMailCreate: StaffMailCreate
    ) {
        this.staffMailCreate = staffMailCreate;
        this.prefix = prefix;
        this.logger = logger;
    }

    // TODO This needs to run only "single-threaded". How do I recognize theres already a process initiated?
    public async handle(message: Message) {
        if (message.author.bot) return;

        this.logger.trace(
            `Received a direct message by user ${message.author.username} (ID ${message.author.id})`
        );

        if (message.content.startsWith(this.prefix)) await this.handleDirectMessageCommand(message);
        else await this.staffMailCreate.createStaffMail(message);
    }

    private async handleDirectMessageCommand(message: Message) {
        await message.channel.send('❌ This command is not usable in DMs!');
        await message.react('❌');
    }
}
