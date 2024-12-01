import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { MemberService } from '@src/infrastructure/services/member.service';
import { Environment } from '@models/environment';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { TYPES } from '@src/types';
import { DiscussionsRepository, IDiscussionsModel } from '@src/infrastructure/repositories/discussions.repository';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { BaseGuildTextChannel, TextBasedChannel, ThreadAutoArchiveDuration } from 'discord.js';
import * as moment from 'moment';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';

@injectable()
export class DiscussionsTrigger {
    logger: Logger<DiscussionsTrigger>;
    memberService: MemberService;
    channelService: ChannelService;
    discussionsRepository: DiscussionsRepository;
    environment: Environment;
    loggingService: LoggingService;
    scheduleService: ScheduleService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<DiscussionsTrigger>,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.ENVIRONMENT) environment: Environment,
        @inject(TYPES.DiscussionsRepository) discussionsRepository: DiscussionsRepository,
        @inject(TYPES.ChannelService) channelService: ChannelService,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ScheduleService) scheduleService: ScheduleService
    ) {
        this.memberService = memberService;
        this.channelService = channelService;
        this.discussionsRepository = discussionsRepository;
        this.environment = environment;
        this.loggingService = loggingService;
        this.logger = logger;
        this.scheduleService = scheduleService;
    }

    public async scheduleDiscussion(previousDiscussion?: IDiscussionsModel) {
        this.logger.info(`Trying to schedule a new discussion.`);

        if (this.scheduleService.jobExists(`DISCUSSIONS_AUTO}`)) {
            this.logger.info(`Discussion is already scheduled. I am not starting a new discussion.`);
            return null;
        }

        if (previousDiscussion) {
            await this.closeDiscussion(previousDiscussion, true, true);
        }

        let newDiscussion = await this.discussionsRepository.getRandomDiscussionTopic();

        if (!newDiscussion) {
            this.logger.info(`No discussion topics found. I am not starting a new discussion.`);
            if (previousDiscussion) await this.loggingService.logNoDiscussionTopicsAlert();
            return null;
        }

        const nextTopicPostDate = moment()
            .set({ hour: 14, minute: 0, second: 0, millisecond: 0 })
            .add(this.environment.DISCUSSIONS_AUTO_INTERVAL_IN_DAYS, 'days')
            .toDate();

        newDiscussion.scheduledToCloseAt = nextTopicPostDate;

        const thread = await this.openDiscussion(newDiscussion!);

        if (!thread) {
            this.logger.error(`Couldn't open discussion thread. I am not starting a new discussion.`);
            return null;
        }

        this.logger.debug(`Scheduling next discussion for ${nextTopicPostDate}.`);
        newDiscussion = await this.discussionsRepository.openDiscussionById(
            newDiscussion._id,
            nextTopicPostDate,
            thread?.id
        );

        this.scheduleService.scheduleJob(`DISCUSSIONS_AUTO`, nextTopicPostDate, async () => {
            await this.scheduleDiscussion(newDiscussion!);
        });

        this.logger.info(`Scheduled discussion with topic '${newDiscussion!.topic}' for ${nextTopicPostDate}.`);
        return newDiscussion;
    }

    public async scheduleDiscussionOnce(discussion: IDiscussionsModel) {
        this.logger.info(`Trying to schedule a new discussion one-time.`);

        if (this.scheduleService.jobExists(`DISCUSSIONS_AUTO}`)) {
            this.logger.info(`Discussion is already scheduled. I am not starting a new discussion.`);
            return null;
        }

        const closeDate = moment()
            .set({ hour: 14, minute: 0, second: 0, millisecond: 0 })
            .add(this.environment.DISCUSSIONS_AUTO_INTERVAL_IN_DAYS, 'days')
            .toDate();

        discussion.scheduledToCloseAt = closeDate;

        const thread = await this.openDiscussion(discussion);

        if (!thread) {
            this.logger.error(`Couldn't open discussion thread. I am not starting a new discussion.`);
            return null;
        }

        this.logger.debug(`Scheduling one-time discussion to close at ${closeDate}.`);
        await this.discussionsRepository.openDiscussionById(discussion._id, closeDate, thread.id);

        this.scheduleService.scheduleJob(`DISCUSSIONS_AUTO`, closeDate, async () => {
            await this.closeDiscussion(discussion);
        });

        this.logger.info(`Scheduled discussion with topic '${discussion.topic}' for ${closeDate}.`);
        return thread;
    }

    public async cancelDiscussionSchedule() {
        if (this.scheduleService.jobExists(`DISCUSSIONS_AUTO}`)) {
            this.logger.info(`Cancelling scheduled discussion.`);
            const activeDiscussions = await this.discussionsRepository.getAllScheduledDiscussions();
            for (const discussion of activeDiscussions) {
                await this.discussionsRepository.removeClosingScheduleForDiscussionById(discussion._id);
            }
            this.scheduleService.cancelJob(`DISCUSSIONS_AUTO}`);
            return activeDiscussions;
        }
        return [];
    }

    public async openDiscussion(discussion: IDiscussionsModel) {
        this.logger.info(`Opening discussion with topic '${discussion.topic}'.`);

        const channel = (await this.channelService.getGuildTextChannelById(
            this.environment.DISCUSSIONS_CHANNEL_ID
        )) as TextBasedChannel;

        if (!channel) {
            this.logger.error(`Can't find discussions channel with ID ${this.environment.DISCUSSIONS_CHANNEL_ID}.`);
            return;
        }

        const startMessage = await channel.send(
            `# ${moment().format('YYYY-MM-DD')}: ${discussion.topic}\n<@&${this.environment.DISCUSSIONS_PING_ROLE_ID}>`
        );

        const createdThread = await (channel as BaseGuildTextChannel).threads.create({
            name: `${moment().format('YYYY-MM-DD')}: ${discussion.topic}`.slice(0, 99),
            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
            startMessage: startMessage,
        });

        createdThread.send(
            `## Welcome to the discussion! Please remember our Discussions Etiquette:\n` +
                `1. **Be Respectful** – Disagreements should be about ideas, not individuals.\n` +
                `2. **Use Constructive Criticism** – If critiquing, offer insights, not just complaints.\n` +
                `3. **Don't Gatekeep** – Welcome all levels of knowledge and musical tastes.\n` +
                `4. **Be Open-Minded** – Embrace different genres, styles, and interpretations.\n` +
                `5. **Stay on Topic** – Keep discussions focused on music and related subjects.\n\n` +
                `Closes at: <t:${moment(discussion.scheduledToCloseAt).unix()}:f>\n\n` +
                `Enjoy! :tada:`
        );

        this.logger.info(`Opened discussion thread has thread ID ${createdThread.id} and name ${createdThread.name}.`);

        return createdThread;
    }

    public async closeDiscussion(discussion: IDiscussionsModel, isAutomatic = true, makeActivityCheck = false) {
        this.logger.info(`Closing discussion with topic '${discussion.topic}'.`);
        discussion = (await this.discussionsRepository.getDiscussionById(discussion._id))!;

        if (discussion.closedAt) {
            this.logger.info(`Discussion is already closed. I am not closing it.`);
            return false;
        }
        const thread = await this.channelService.getGuildThreadById(
            this.environment.DISCUSSIONS_CHANNEL_ID,
            discussion.threadId
        );

        if (!thread) {
            this.logger.error(`Couldn't find thread with ID ${discussion.threadId}. I didn't close it.`);
            return false;
        }

        if (makeActivityCheck) {
            const messages = await thread.messages.fetch({ limit: 1 });
            const latestMessage = messages.first();

            if (moment().diff(latestMessage?.createdAt, 'hours') < 1) {
                this.logger.info(`Last message was less than 1 hour ago. I am not closing the discussion.`);
                await this.discussionsRepository.removeClosingScheduleForDiscussionById(discussion._id);
                await this.loggingService.logDiscussionStillActiveAlert(discussion);
                return false;
            }
            this.logger.debug(`Last message was more than 1 hour ago. Closing the discussion.`);
        }

        await thread.send(
            `## This discussion has been closed.\nStay up-to-date with the latest discussions in <#${this.environment.DISCUSSIONS_CHANNEL_ID}> and by grabbing the Discussions ping role!`
        );
        await thread.setLocked(true, isAutomatic ? 'Automatic' : 'Manually closed by moderator.');

        await this.discussionsRepository.closeDiscussionById(discussion._id);

        this.logger.info(`Closed discussion thread with ID ${discussion.threadId}.`);

        return true;
    }

    public async restoreScheduledDiscussion() {
        const discussions: IDiscussionsModel[] = await this.discussionsRepository.getAllScheduledDiscussions();

        switch (discussions.length) {
            case 0:
                this.logger.debug(`No scheduled discussion to restore.`);
                return 0;
            case 1:
                this.logger.debug(
                    `Discussion with topic '${discussions[0].topic}' should be closed at ${discussions[0].scheduledToCloseAt}.`
                );
                break;
            default:
                this.logger.warn(`More than 1 scheduled discussion found.`);
                break;
        }

        let count = 0;
        for (const discussion of discussions) {
            if (moment().isAfter(discussion.scheduledToCloseAt)) {
                this.logger.debug(`Scheduled discussion expired, trying to close.`);
                if (!this.scheduleService.jobExists(`DISCUSSIONS_AUTO}`)) {
                    await this.scheduleDiscussion(discussion);
                }
            } else {
                if (!this.scheduleService.jobExists(`DISCUSSIONS_AUTO}`)) {
                    this.scheduleService.scheduleJob(`DISCUSSIONS_AUTO`, discussion.scheduledToCloseAt, async () => {
                        await this.scheduleDiscussion(discussion);
                    });
                }
            }
            count++;
        }

        return count;
    }
}
