import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { DiscussionsTrigger } from '@src/feature/triggers/discussions.trigger';
import { TextHelper } from '@src/helpers/text.helper';
import { DiscussionsRepository, IDiscussionsModel } from '@src/infrastructure/repositories/discussions.repository';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { TYPES } from '@src/types';
import { Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { Logger } from 'tslog';

@injectable()
export class DiscussionsManageCommand implements ICommand {
    name: string = 'dmanage';
    description: string =
        'Manage discussions. Topics are chosen at random with preference for older topics.\n' +
        '-`open` opens a new discussion.\n' +
        '-`close`: closes an open discussions thread\n' +
        '-`auto`: schedules automatic discussion topic posting every 48 hours as long as there are topics.\n' +
        '-`stop`: stops automatic discussion topic posting\n' +
        '-`active`: shows all discussions that are currently active (scheduled or not).';
    usageHint: string = 'open  | close [thread or thread ID] | auto | stop | active';
    examples: string[] = ['open', 'close 1115081240165486632', 'auto', 'stop', 'active'];
    permissionLevel = CommandPermissionLevel.Moderator;
    operations = ['open', 'close', 'auto', 'stop', 'active'];
    aliases = ['discussionmanage', 'discussionsmanage'];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<DiscussionsManageCommand>;
    private discussionsTrigger: DiscussionsTrigger;
    private channelService: ChannelService;
    discussionsRepository: DiscussionsRepository;
    environment: Environment;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<DiscussionsManageCommand>,
        @inject(TYPES.DiscussionsTrigger) discussionsTrigger: DiscussionsTrigger,
        @inject(TYPES.ChannelService) channelService: ChannelService,
        @inject(TYPES.ENVIRONMENT) environment: Environment,
        @inject(TYPES.DiscussionsRepository) discussionsRepository: DiscussionsRepository
    ) {
        this.discussionsRepository = discussionsRepository;
        this.discussionsTrigger = discussionsTrigger;
        this.logger = logger;
        this.channelService = channelService;
        this.environment = environment;
    }

    validateArgs(args: string[]): Promise<void> {
        // Check if the first argument is a valid operation
        if (args[0] && !this.operations.includes(args[0])) {
            throw new ValidationError(
                `Operation type ${args[0]} not valid for discussions.`,
                `You must provide a one of the following operation types: ${this.operations.join(', ')}`
            );
        }

        // Check if the 'close' operation is provided without a thread ID
        if (args[0] == this.operations[1] && args.length <= 1) {
            throw new ValidationError(
                `Operation close with no further args for discussions.`,
                `You must provide a discussions thread or thread ID!`
            );
        }

        return Promise.resolve();
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        let result: CommandResult;
        switch (args[0]) {
            case this.operations[0]:
                result = await this.openDiscussionThread();
                break;
            case this.operations[1]:
                result = await this.closeDiscussionThread(args[1]);
                break;
            case this.operations[2]:
                result = await this.startAutomaticDiscussions();
                break;
            case this.operations[3]:
                result = await this.stopAutomaticDiscussions();
                break;
            case this.operations[4]:
                result = await this.showActiveDiscussions();
                break;
            default:
                throw new ValidationError(
                    `Operation type ${args[0]} not valid.`,
                    `You must provide a one of the following operation types: ${this.operations.join(', ')}`
                );
        }

        return result;
    }

    private async openDiscussionThread() {
        const discussions: IDiscussionsModel[] = await this.discussionsRepository.getAllScheduledDiscussions();
        if (discussions.length > 0) {
            return {
                isSuccessful: false,
                replyToUser:
                    `There is an automatic discussion schedule running:\n` +
                    `- "${discussions[0].topic}" (closes <t:${moment(discussions[0].scheduledToCloseAt).unix()}:f>)\n` +
                    `-# Stop it with \`${this.environment.CORE.PREFIX}stop\` if you want to manually start a new discussion!`,
            };
        }

        let thread;
        try {
            const discussion = await this.discussionsRepository.getRandomDiscussionTopic();

            if (!discussion) {
                return {
                    isSuccessful: false,
                    replyToUser: `There are no discussion topics to open a thread for. Add more with \`${this.environment.CORE.PREFIX}dtopic add [topic]\``,
                };
            }
            thread = await this.discussionsTrigger.scheduleDiscussionOnce(discussion);
        } catch (e) {
            this.logger.error(`Failed while trying to open a new discussion thread.`, e);
            return {
                isSuccessful: false,
                replyToUser: `I wasn't able to start a new discussion.`,
            };
        }

        return {
            isSuccessful: true,
            replyToUser: `I've started a new discussion in <#${thread!.id}>!`,
        };
    }

    private async closeDiscussionThread(unsanitizedThreadId: string) {
        const threadId = TextHelper.getDiscordThreadId(unsanitizedThreadId);
        this.logger.debug(`Thread ID is ${threadId}`);

        if (!threadId) {
            throw new ValidationError(
                `Could not recognize ${unsanitizedThreadId} as a discord thread id.`,
                `${unsanitizedThreadId} doesn't seem to be a discussions thread.`
            );
        }

        const thread = await this.channelService.getGuildThreadById(this.environment.DISCUSSIONS.CHANNEL_ID, threadId);

        if (!thread) {
            throw new ValidationError(
                `Could not recognize ${threadId} as a discord thread.`,
                `<#${threadId}> doesn't seem to be a discussions thread.`
            );
        }

        const discussion = await this.discussionsRepository.getDiscussionByThreadId(threadId);

        if (!discussion) {
            throw new ValidationError(
                `Could not find discussion with thread ID ${threadId}.`,
                `This thread doesn't seem to be a discussions thread.`
            );
        }

        if (discussion.closedAt) {
            throw new ValidationError(
                `Discussion with thread ID ${threadId} is already closed.`,
                `This thread is already closed.`
            );
        }

        try {
            await this.discussionsTrigger.closeDiscussion(discussion);
        } catch (e) {
            this.logger.error(`Failed while trying to close the discussion in thread ${threadId}.`, e);
            return {
                isSuccessful: false,
                replyToUser: `I wasn't able to close the discussion in <#${threadId}>.`,
            };
        }

        return {
            isSuccessful: true,
            replyToUser: `I've closed the discussion in <#${threadId}>!`,
        };
    }

    private async startAutomaticDiscussions() {
        const discussions: IDiscussionsModel[] = await this.discussionsRepository.getAllScheduledDiscussions();
        if (discussions.length > 0) {
            return {
                isSuccessful: false,
                replyToUser:
                    `There is already an automatic discussion schedule running:\n` +
                    `- "${discussions[0].topic}" (closes <t:${moment(discussions[0].scheduledToCloseAt).unix()}:f>)\n` +
                    `-# Stop it with \`${this.environment.CORE.PREFIX}stop if this is wrong.`,
            };
        }

        const discussion = await this.discussionsTrigger.scheduleDiscussion();

        if (!discussion) {
            return {
                isSuccessful: false,
                replyToUser: `I wasn't able to start the automatic discussion schedule. Please check if there are enough topics.`,
            };
        }

        return {
            isSuccessful: true,
            replyToUser: `I've started the automatic discussion schedule and opened a new discussion in <#${discussion!.threadId}>. The next topic will be posted at <t:${moment(discussion.scheduledToCloseAt).unix()}:f>.`,
        };
    }

    private async stopAutomaticDiscussions() {
        const cancelledDiscussions = await this.discussionsTrigger.cancelDiscussionSchedule();
        const wasCancelled = cancelledDiscussions.length > 0;
        let reply;
        if (wasCancelled) {
            reply = `I've stopped the automatic discussion schedule and disabled automating closing for ${cancelledDiscussions.length} discussions:\n`;
            for (const discussion of cancelledDiscussions) {
                reply += `- <#${discussion.threadId}> (scheduled to close at <t:${moment(discussion.scheduledToCloseAt).unix()}:f>)\n`;
            }
        } else {
            reply = `There is no automatic discussion schedule running.`;
        }
        return {
            isSuccessful: wasCancelled,
            replyToUser: reply,
        };
    }

    private async showActiveDiscussions() {
        const activeDiscussions = await this.discussionsRepository.getAllActiveDiscussions();

        if (activeDiscussions.length === 0) {
            return {
                isSuccessful: true,
                replyToUser: `There are no active discussions.`,
            };
        }

        let reply = `Here are the active discussions:\n`;
        for (const discussion of activeDiscussions) {
            reply += `- <#${discussion.threadId}>`;
            if (discussion.scheduledToCloseAt) {
                reply += ` (closes <t:${moment(discussion.scheduledToCloseAt).unix()}:f>)`;
            }
            reply += '\n';
        }

        return {
            isSuccessful: true,
            replyToUser: reply,
        };
    }
}
