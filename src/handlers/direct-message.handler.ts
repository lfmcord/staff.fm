import { inject, injectable } from 'inversify';
import { Message } from 'discord.js';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { IHandler } from '@src/handlers/models/handler.interface';
import { StaffMailCreate } from '@src/feature/staffmail/staff-mail-create';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import { TextHelper } from '@src/helpers/text.helper';

@injectable()
export class DirectMessageHandler implements IHandler {
    private readonly logger: Logger<DirectMessageHandler>;
    private scheduleService: ScheduleService;
    private readonly prefix: string;
    private readonly staffMailCreate: StaffMailCreate;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<DirectMessageHandler>,
        @inject(TYPES.PREFIX) prefix: string,
        @inject(TYPES.StaffMailCreate) staffMailCreate: StaffMailCreate,
        @inject(TYPES.ScheduleService) scheduleService: ScheduleService
    ) {
        this.scheduleService = scheduleService;
        this.staffMailCreate = staffMailCreate;
        this.prefix = prefix;
        this.logger = logger;
    }

    // TODO This needs to run only "single-threaded". How do I recognize theres already a process initiated?
    public async handle(message: Message) {
        if (message.author.bot) return;

        this.logger.trace(`Received a direct message by user ${message.author.username} (ID ${message.author.id})`);

        if (message.content.startsWith(this.prefix)) await this.handleDirectMessageCommand(message);
        else await this.staffMailCreate.createStaffMail(message);
    }

    private async handleDirectMessageCommand(message: Message) {
        let reply = `${TextHelper.failure} This command is not usable in DMs!`;
        let emoji = TextHelper.failure;
        if (message.content == this.prefix + 'unmute') {
            this.logger.info(
                `User ${message.author.username} (ID ${message.author.id}) is manually removing a selfmute via DMs.`
            );
            if (!this.scheduleService.jobExists(`SELFMUTE_${message.author.id}`))
                reply = `${TextHelper.failure} You do not currently have an active selfmute!`;
            else {
                this.scheduleService.runJob(`SELFMUTE_${message.author.id}`);
                reply = `${TextHelper.success} I've unmuted you. Welcome back!`;
                emoji = TextHelper.success;
            }
        }
        await message.channel.send(reply);
        await message.react(emoji);
    }
}
