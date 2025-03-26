import { Environment } from '@models/environment';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { DiscussionsRepository, IDiscussionsModel } from '@src/infrastructure/repositories/discussions.repository';
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import { TYPES } from '@src/types';
import {
    BaseGuildTextChannel,
    Client,
    TextBasedChannel,
    ThreadAutoArchiveDuration,
    ThreadChannel,
    User,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { Logger } from 'tslog';

@injectable()
export class DiscussionsTrigger {
    logger: Logger<DiscussionsTrigger>;
    memberService: MemberService;
    channelService: ChannelService;
    discussionsRepository: DiscussionsRepository;
    environment: Environment;
    loggingService: LoggingService;
    scheduleService: ScheduleService;
    private client: Client;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<DiscussionsTrigger>,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.ENVIRONMENT) environment: Environment,
        @inject(TYPES.DiscussionsRepository) discussionsRepository: DiscussionsRepository,
        @inject(TYPES.ChannelService) channelService: ChannelService,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ScheduleService) scheduleService: ScheduleService,
        @inject(TYPES.Client) client: Client
    ) {
        this.client = client;
        this.memberService = memberService;
        this.channelService = channelService;
        this.discussionsRepository = discussionsRepository;
        this.environment = environment;
        this.loggingService = loggingService;
        this.logger = logger;
        this.scheduleService = scheduleService;
    }

    public async scheduleDiscussion(
        discussion: IDiscussionsModel,
        actor: User,
        shouldLog = true
    ): Promise<ThreadChannel | null> {
        this.logger.info(`Trying to schedule a new discussion.`);
        const thread = await this.createDiscussionThread(discussion, actor);

        if (!thread) {
            this.logger.error(`Couldn't open discussion thread. Ask Haiyn why.`);
            return null;
        }

        const nextTopicPostDate = moment()
            .set({ minute: 0, second: 0, millisecond: 0 })
            .add(this.environment.DISCUSSIONS.AUTO_INTERVAL_IN_HOURS, 'hours')
            .toDate();

        this.logger.debug(`Scheduling next discussion for ${nextTopicPostDate}.`);
        let newDiscussion = await this.discussionsRepository.getRandomDiscussionTopic();
        if (!newDiscussion) {
            this.logger.info(`No discussion topics found. I am not scheduling a new discussion.`);
            await this.loggingService.logNoDiscussionTopicsAlert(0);
            return thread;
        } else {
            const remainingDiscussions = await this.discussionsRepository.getAllUnusedDiscussions();
            if (remainingDiscussions.length == 1) {
                this.logger.info(`Only one discussion topic left.`);
                await this.loggingService.logNoDiscussionTopicsAlert(1);
                return thread;
            }
        }

        this.scheduleService.scheduleJob(`DISCUSSIONS_AUTO`, nextTopicPostDate, async () => {
            await this.scheduleDiscussion(newDiscussion!, this.client.user!);
        });

        newDiscussion = await this.discussionsRepository.scheduleDiscussionTopic(newDiscussion!._id, nextTopicPostDate);
        if (shouldLog) await this.loggingService.logDiscussionScheduled(newDiscussion!);

        this.logger.info(`Scheduled discussion with topic '${newDiscussion!.topic}' for ${nextTopicPostDate}.`);
        return thread;
    }

    public async cancelDiscussionSchedule() {
        const activeDiscussions = await this.discussionsRepository.getAllScheduledDiscussions();
        for (const discussion of activeDiscussions) {
            await this.discussionsRepository.unscheduleDiscussionTopic(discussion._id);
        }
        if (this.scheduleService.jobExists(`DISCUSSIONS_AUTO}`)) {
            this.logger.info(`Cancelling scheduled discussion.`);
            this.scheduleService.cancelJob(`DISCUSSIONS_AUTO}`);
        }
        return activeDiscussions;
    }

    public async createDiscussionThread(discussion: IDiscussionsModel, actor: User) {
        this.logger.info(`Opening discussion with topic '${discussion.topic}'.`);

        const channel = (await this.channelService.getGuildTextChannelById(
            this.environment.DISCUSSIONS.CHANNEL_ID
        )) as TextBasedChannel;

        if (!channel) {
            this.logger.error(`Can't find discussions channel with ID ${this.environment.DISCUSSIONS.CHANNEL_ID}.`);
            return;
        }

        const usedDiscussions = await this.discussionsRepository.getAllUsedDiscussions();

        const startMessage = await channel.send(
            `# ${usedDiscussions.length + 1}. ${discussion.topic}\n${this.environment.DISCUSSIONS.PING_ROLE_IDS.map((id) => `<@&${id}>`).join(' ')}`
        );

        const createdThread = await (channel as BaseGuildTextChannel).threads.create({
            name: `${usedDiscussions.length + 1}. ${discussion.topic}`.slice(0, 99),
            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
            startMessage: startMessage,
        });

        createdThread.send({ embeds: [EmbedHelper.getDiscussionEtiquetteEmbed()] });

        this.logger.info(`Opened discussion thread has thread ID ${createdThread.id} and name ${createdThread.name}.`);
        discussion = (await this.discussionsRepository.setDiscussionToOpened(discussion._id, createdThread.id))!;
        await this.loggingService.logDiscussionOpened(discussion, actor);

        return createdThread;
    }

    public async restoreScheduledDiscussion() {
        const discussions: IDiscussionsModel[] = await this.discussionsRepository.getAllScheduledDiscussions();

        if (discussions.length == 0) {
            this.logger.debug(`No scheduled discussion to restore.`);
            return 0;
        }

        if (discussions.length > 1) {
            this.logger.warn(`More than 1 scheduled discussion found. Only one will be restored.`);
        }

        for (const discussion of discussions.slice(1)) {
            this.logger.debug(`Unscheduling discussion with topic '${discussion.topic}'.`);
            await this.discussionsRepository.unscheduleDiscussionTopic(discussion._id);
        }

        this.logger.debug(
            `Discussion with topic '${discussions[0].topic}' should be opened at ${discussions[0].scheduledFor}.`
        );
        if (moment().isAfter(discussions[0].scheduledFor)) {
            await this.scheduleDiscussion(discussions[0], this.client.user!, false);
        } else {
            this.scheduleService.scheduleJob(`DISCUSSIONS_AUTO`, discussions[0].scheduledFor, async () => {
                await this.scheduleDiscussion(discussions[0], this.client.user!);
            });
        }
    }
}
