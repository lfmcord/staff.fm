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
import {
    ActionRowBuilder,
    AttachmentBuilder,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { Logger } from 'tslog';
import { ComponentHelper } from '@src/helpers/component.helper';
import { MemberService } from '@src/infrastructure/services/member.service';

@injectable()
export class DiscussionsCommand implements ICommand {
    name: string = 'discussions';
    description: string = 'Manage discussions. Topics are chosen at random with preference for older topics.';
    permissionLevel = CommandPermissionLevel.Moderator;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand((subcommand) =>
            subcommand.setName('info').setDescription('Shows you info about the current scheduling and topics.')
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('open').setDescription('Opens a new discussion without scheduling anything.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('start')
                .setDescription('Opens a new discussion and sets up automatic posting of discussions.')
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('stop').setDescription('Stops automatic discussion topic posting.')
        ).addSubcommand((subcommand) =>
            subcommand
                .setName('add')
                .setDescription('Adds a discussion topic')
                .addStringOption((option) =>
                    option.setName('topic').setDescription('The topic to add').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription('Removes a discussion topic')
                .addIntegerOption((option) =>
                    option.setName('topic').setDescription('The number of the topic to remove')
                )
        );

    private logger: Logger<DiscussionsCommand>;
    private discussionsTrigger: DiscussionsTrigger;
    private channelService: ChannelService;
    discussionsRepository: DiscussionsRepository;
    environment: Environment;
    loggingService: LoggingService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<DiscussionsCommand>,
        @inject(TYPES.DiscussionsTrigger) discussionsTrigger: DiscussionsTrigger,
        @inject(TYPES.ChannelService) channelService: ChannelService,
        @inject(TYPES.ENVIRONMENT) environment: Environment,
        @inject(TYPES.DiscussionsRepository) discussionsRepository: DiscussionsRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.MemberService) private memberService: MemberService
    ) {
        this.discussionsRepository = discussionsRepository;
        this.discussionsTrigger = discussionsTrigger;
        this.logger = logger;
        this.channelService = channelService;
        this.environment = environment;
        this.loggingService = loggingService;
    }

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        if (interaction.options.getSubcommand() == 'add' && interaction.options.getString('topic')!.length > 256) {
            throw new ValidationError(`Topic too long.`, `A topic can't be longer than 256 characters.`);
        }

        return Promise.resolve();
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const discussion = await this.discussionsRepository.getRandomDiscussionTopic();
        if (!discussion) {
            return {
                isSuccessful: false,
                replyToUser: {
                    content: `There are no discussion topics to open a thread for. Add more with \`/dtopic add [topic]\``,
                },
            };
        }

        let result: CommandResult;
        switch (interaction.options.getSubcommand()) {
            case 'info':
                result = await this.showDiscussionManagement(interaction);
                break;
            case 'open':
                result = await this.openDiscussion(interaction, discussion);
                break;
            case 'start':
                result = await this.startAutomaticDiscussions(interaction, discussion);
                break;
            case 'stop':
                result = await this.stopAutomaticDiscussions(interaction);
                break;
            case 'add':
                result = await this.addDiscussionsTopic(interaction.options.getString('topic') as string, interaction);
                break;
            case 'remove':
                result = await this.removeDiscussionsTopic(interaction.options.getInteger('topic'), interaction);
                break;
            default:
                throw new ValidationError(`Operation type ${interaction.commandName} not valid.`);
        }

        return result;
    }

    private async openDiscussion(
        interaction: ChatInputCommandInteraction,
        discussion?: IDiscussionsModel | null
    ): Promise<CommandResult> {
        let thread;
        try {
            if (!discussion) {
                return {
                    isSuccessful: false,
                    replyToUser: {
                        content: `There are no discussion topics to open a thread for. Add more with \`/dtopic add [topic]\``,
                    },
                };
            }
            thread = await this.discussionsTrigger.createDiscussionThread(discussion, interaction.user);
        } catch (e) {
            this.logger.error(`Failed while trying to open a new discussion thread.`, e);
            return {
                isSuccessful: false,
                replyToUser: { content: `I wasn't able to start a new discussion.` },
            };
        }

        return {
            isSuccessful: true,
            replyToUser: { content: `I've started a new discussion in <#${thread!.id}>!` },
        };
    }

    private async startAutomaticDiscussions(
        interaction: ChatInputCommandInteraction,
        discussion: IDiscussionsModel
    ): Promise<CommandResult> {
        const discussions: IDiscussionsModel[] = await this.discussionsRepository.getAllScheduledDiscussions();
        if (discussions.length > 0) {
            return {
                isSuccessful: false,
                replyToUser: {
                    content:
                        `There is already an automatic discussion schedule running:\n` +
                        `- "${discussions[0].topic}" (scheduled for <t:${moment(discussions[0].scheduledFor).unix()}:f>)\n` +
                        `-# Stop it with \`/dmanage stop\` if this is wrong.`,
                },
            };
        }

        const remainingTopics = await this.discussionsRepository.getAllUnusedDiscussions();
        if (remainingTopics.length == 1) {
            return {
                isSuccessful: true,
                replyToUser: {
                    content:
                        `There was only one discussion topic left. I've opened the discussion, but have not scheduled more. ` +
                        `Add more topics with \`/dtopic add [topic]\`.`,
                },
            };
        }
        if (remainingTopics.length == 0) {
            return {
                isSuccessful: false,
                replyToUser: {
                    content: `There are no discussion topics left to schedule. Add more with \`/dtopic add [topic]\`.`,
                },
            };
        }

        const thread = await this.discussionsTrigger.scheduleDiscussion(discussion, interaction.user);

        if (!thread) {
            return {
                isSuccessful: false,
                replyToUser: {
                    content: `I wasn't able to start the automatic discussion schedule. Please check if there are enough topics.`,
                },
            };
        }

        await this.loggingService.logDiscussionScheduleChanged(interaction.user, true);

        return {
            isSuccessful: true,
            replyToUser: {
                content:
                    `I've started the automatic discussion schedule and opened a new discussion in <#${thread.id}>. ` +
                    `The next topic will be posted at <t:${moment(discussion.scheduledFor).unix()}:f>.`,
            },
        };
    }

    private async stopAutomaticDiscussions(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const cancelledDiscussions = await this.discussionsTrigger.cancelDiscussionSchedule();

        if (cancelledDiscussions.length == 0) {
            return {
                isSuccessful: false,
                replyToUser: {
                    content: `There is no automatic discussion schedule active! Start one with \`/dmanage start\`.`,
                },
            };
        }

        await this.loggingService.logDiscussionScheduleChanged(interaction.user);

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
            replyToUser: {
                content: reply,
            },
        };
    }

    private async showDiscussionManagement(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const allDiscussions = await this.discussionsRepository.getAllDiscussions();

        const embed = EmbedHelper.getDiscussionsManagementEmbed(
            allDiscussions,
            this.environment.DISCUSSIONS.AUTO_INTERVAL_IN_HOURS,
            this.environment.DISCUSSIONS.PING_ROLE_IDS
        );

        const topicsFile = await this.discussionsRepository.getAllDiscussionTopicsAsFile(allDiscussions);

        return {
            isSuccessful: true,
            replyToUser: {
                embeds: [embed],
                files: topicsFile
                    ? [
                          new AttachmentBuilder(topicsFile, {
                              name: `${moment().format('YYYY_MM_DD')}_discussion_topics.txt`,
                          }),
                      ]
                    : [],
            },
        };
    }

    private async addDiscussionsTopic(topic: string, interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        this.logger.info(`Adding new discussions topic '${topic}' by ${interaction.user.username}...`);

        await this.discussionsRepository.addDiscussionTopic(topic, interaction.user);

        const openTopics = await this.discussionsRepository.getAllUnusedDiscussions();

        await this.loggingService.logDiscussionTopic(interaction.user, topic, openTopics.length);

        return {
            isSuccessful: true,
            replyToUser: {
                content: `I've added the following topic: "${topic}"\n-# There are now ${openTopics.length} open topics.`,
            },
        };
    }

    private async removeDiscussionsTopic(
        numberToRemove: number | null,
        interaction: ChatInputCommandInteraction
    ): Promise<CommandResult> {
        const topics = await this.discussionsRepository.getAllUnusedDiscussions();
        if (numberToRemove) {
            const discussionToRemove = topics[numberToRemove - 1];
            if (!discussionToRemove)
                return {
                    isSuccessful: false,
                    replyToUser: { content: `This number is too high, I don't have that many topics stored!` },
                };
            this.logger.info(`Removing '${discussionToRemove.topic}' by ${interaction.user.username}...`);
            await this.discussionsRepository.removeDiscussionById(discussionToRemove._id);
            const user = await this.memberService.fetchUser(discussionToRemove.addedById);

            await this.loggingService.logDiscussionTopic(
                interaction.user,
                discussionToRemove.topic,
                topics.length - 1,
                true
            );

            return {
                isSuccessful: true,
                replyToUser: {
                    content: `I've removed the following topic at position ${numberToRemove}:\n- \`${discussionToRemove.topic}\` (added by ${user?.username ?? 'unknown'} at <t:${moment(discussionToRemove.addedAt).unix()}:f>)`,
                },
            };
        }
        this.logger.info(`No number provided, showing remove menu...`);
        const topicsFile = await this.discussionsRepository.getAllDiscussionTopicsAsFile(topics);

        if (!topicsFile) {
            return {
                isSuccessful: true,
                replyToUser: { content: `No discussion topics to remove.` },
            };
        }

        return {
            isSuccessful: true,
            replyToUser: {
                content: `Please select the topic to remove below.`,
                files: [
                    new AttachmentBuilder(topicsFile, {
                        name: `${moment().format('YYYY_MM_DD')}_discussion_topics.txt`,
                    }),
                ],
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        ComponentHelper.discussionsMenu(topics)
                    ),
                ],
            },
        };
    }
}
