import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Message, PartialMessage } from 'discord.js';
import { inject, injectable } from 'inversify';
import { TextHelper } from '@src/helpers/text.helper';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';

@injectable()
export class SelfMuteUnmuteCommand implements ICommand {
    name: string = 'unmute';
    description: string = 'Unmutes yourself if you currently have a selfmute active.';
    usageHint: string = '';
    examples: string[] = [];
    permissionLevel = CommandPermissionLevel.User;
    aliases = [];
    isUsableInDms = true;
    isUsableInServer = false;
    logger: Logger<SelfMuteUnmuteCommand>;
    scheduleService: ScheduleService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<SelfMuteUnmuteCommand>,
        @inject(TYPES.ScheduleService) scheduleService: ScheduleService
    ) {
        this.scheduleService = scheduleService;
        this.logger = logger;
    }

    async run(message: Message | PartialMessage): Promise<CommandResult> {
        this.logger.info(`User ${TextHelper.userLog(message.author!)} is manually removing a selfmute via DMs.`);
        if (!this.scheduleService.jobExists(`SELFMUTE_${message.author!.id}`)) {
            return {
                isSuccessful: false,
                replyToUser: `You do not currently have an active selfmute!`,
                reason: `User ${TextHelper.userLog(message.author!)} does not have an active selfmute.`,
            };
        }
        this.scheduleService.runJob(`SELFMUTE_${message.author!.id}`);

        return {
            isSuccessful: true,
            replyToUser: "I've unmuted you. Welcome back!",
        };
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}