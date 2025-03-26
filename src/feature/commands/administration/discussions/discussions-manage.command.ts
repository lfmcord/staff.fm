import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { DiscussionsTrigger } from '@src/feature/triggers/discussions.trigger';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { DiscussionsRepository, IDiscussionsModel } from '@src/infrastructure/repositories/discussions.repository';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { TYPES } from '@src/types';
import { AttachmentBuilder, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { Logger } from 'tslog';

@injectable()
export class DiscussionsManageCommand implements ICommand {
    name: string = 'dmanage';
    description: string =
        'Manage discussions. Topics are chosen at random with preference for older topics.\n' +
        'Operations:\n' +
        '-`open`: opens a new discussion without scheduling anything.\n' +
        '-`start`: opens a new discussion and sets up automatic posting of discussions.\n' +
        '-`stop`: stops automatic discussion topic posting\n' +
        'Using no operation gives you information about the current discussion schedule.';
    usageHint: string = 'open  | start | stop';
    examples: string[] = ['', 'open', 'start', 'stop'];
    permissionLevel = CommandPermissionLevel.Moderator;
    operations = ['open', 'start', 'stop'];
    aliases = ['discussionmanage', 'discussionsmanage'];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<DiscussionsManageCommand>;
    private discussionsTrigger: DiscussionsTrigger;
    private channelService: ChannelService;
    discussionsRepository: DiscussionsRepository;
    environment: Environment;
    loggingService: LoggingService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<DiscussionsManageCommand>,
        @inject(TYPES.DiscussionsTrigger) discussionsTrigger: DiscussionsTrigger,
        @inject(TYPES.ChannelService) channelService: ChannelService,
        @inject(TYPES.ENVIRONMENT) environment: Environment,
        @inject(TYPES.DiscussionsRepository) discussionsRepository: DiscussionsRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.discussionsRepository = discussionsRepository;
        this.discussionsTrigger = discussionsTrigger;
        this.logger = logger;
        this.channelService = channelService;
        this.environment = environment;
        this.loggingService = loggingService;
    }

    validateArgs(args: string[]): Promise<void> {
        // Check if the first argument is a valid operation
        if (args[0] && !this.operations.includes(args[0])) {
            throw new ValidationError(
                `Operation type ${args[0]} not valid for discussions.`,
                `You must provide a one of the following operation types: ${this.operations.join(', ')}`
            );
        }

        return Promise.resolve();
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        if (args.length == 0) return await this.showDiscussionManagement(message);

        if (args[0] == 'stop') return await this.stopAutomaticDiscussions(message);

        const discussion = await this.discussionsRepository.getRandomDiscussionTopic();
        if (!discussion) {
            return {
                isSuccessful: false,
                replyToUser: `There are no discussion topics to open a thread for. Add more with \`${this.environment.CORE.PREFIX}dtopic add [topic]\``,
            };
        }

        let result: CommandResult;
        switch (args[0]) {
            case this.operations[0]:
                result = await this.openDiscussion(message, discussion);
                break;
            case this.operations[1]:
                result = await this.startAutomaticDiscussions(message, discussion);
                break;
            default:
                throw new ValidationError(
                    `Operation type ${args[0]} not valid.`,
                    `You must provide a one of the following operation types: ${this.operations.join(', ')}`
                );
        }

        return result;
    }

    private async openDiscussion(message: Message, discussion?: IDiscussionsModel | null) {
        let thread;
        try {
            if (!discussion) {
                return {
                    isSuccessful: false,
                    replyToUser: `There are no discussion topics to open a thread for. Add more with \`${this.environment.CORE.PREFIX}dtopic add [topic]\``,
                };
            }
            thread = await this.discussionsTrigger.createDiscussionThread(discussion, message.author!);
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

    private async startAutomaticDiscussions(message: Message, discussion: IDiscussionsModel) {
        const discussions: IDiscussionsModel[] = await this.discussionsRepository.getAllScheduledDiscussions();
        if (discussions.length > 0) {
            return {
                isSuccessful: false,
                replyToUser:
                    `There is already an automatic discussion schedule running:\n` +
                    `- "${discussions[0].topic}" (scheduled for <t:${moment(discussions[0].scheduledFor).unix()}:f>)\n` +
                    `-# Stop it with \`${this.environment.CORE.PREFIX}dmanage stop\` if this is wrong.`,
            };
        }

        const remainingTopics = await this.discussionsRepository.getAllUnusedDiscussions();
        if (remainingTopics.length == 1) {
            return {
                isSuccessful: true,
                replyToUser:
                    `There was only one discussion topic left. I've opened the discussion, but have not scheduled more. ` +
                    `Add more topics with \`${this.environment.CORE.PREFIX}dtopic add [topic]\`.`,
            };
        }
        if (remainingTopics.length == 0) {
            return {
                isSuccessful: false,
                replyToUser: `There are no discussion topics left to schedule. Add more with \`${this.environment.CORE.PREFIX}dtopic add [topic]\`.`,
            };
        }

        const thread = await this.discussionsTrigger.scheduleDiscussion(discussion, message.author);

        if (!thread) {
            return {
                isSuccessful: false,
                replyToUser: `I wasn't able to start the automatic discussion schedule. Please check if there are enough topics.`,
            };
        }

        await this.loggingService.logDiscussionScheduleChanged(message.author, true);

        return {
            isSuccessful: true,
            replyToUser:
                `I've started the automatic discussion schedule and opened a new discussion in <#${thread.id}>. ` +
                `The next topic will be posted at <t:${moment(discussion.scheduledFor).unix()}:f>.`,
        };
    }

    private async stopAutomaticDiscussions(message: Message) {
        const cancelledDiscussions = await this.discussionsTrigger.cancelDiscussionSchedule();

        if (cancelledDiscussions.length == 0) {
            return {
                isSuccessful: false,
                replyToUser: `There is no automatic discussion schedule active! Start one with \`${this.environment.CORE.PREFIX}dmanage start\`.`,
            };
        }

        await this.loggingService.logDiscussionScheduleChanged(message.author);

        let reply = `I've stopped the automatic discussion schedule.`;
        if (cancelledDiscussions.length > 1) {
            reply = `I've stopped the automatic discussion schedule and unscheduled the following topics:\n`;
            for (const discussion of cancelledDiscussions) {
                reply += `- '${discussion.topic}' (scheduled to open at <t:${moment(discussion.scheduledFor).unix()}:f>)\n`;
            }
        } else {
            reply = `I've stopped the automatic discussion schedule and unscheduled the topic '${cancelledDiscussions[0].topic}' (scheduled to open at <t:${moment(cancelledDiscussions[0].scheduledFor).unix()}:f>).`;
        }

        return {
            isSuccessful: true,
            replyToUser: reply,
        };
    }

    private async showDiscussionManagement(message: Message) {
        const allDiscussions = await this.discussionsRepository.getAllDiscussions();

        const embed = EmbedHelper.getDiscussionsManagementEmbed(
            allDiscussions,
            this.environment.DISCUSSIONS.AUTO_INTERVAL_IN_HOURS,
            this.environment.DISCUSSIONS.PING_ROLE_IDS
        );

        const topicsFile = await this.discussionsRepository.getAllDiscussionTopicsAsFile(allDiscussions);

        message.channel.send({
            embeds: [embed],
            files: topicsFile
                ? [
                      new AttachmentBuilder(topicsFile, {
                          name: `${moment().format('YYYY_MM_DD')}_discussion_topics.txt`,
                      }),
                  ]
                : [],
        });

        return {
            isSuccessful: true,
        };
    }
}
