import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { ComponentHelper } from '@src/helpers/component.helper';
import { DiscussionsRepository } from '@src/infrastructure/repositories/discussions.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
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

@injectable()
export class DiscussionsTopicCommand implements ICommand {
    name: string = 'dtopic';
    description: string = 'Adds or removes a discussion topic.';
    usageHint: string = 'add [topic] | remove [(optional) number to remove] | remove | show';
    examples: string[] = ["add Who's the best artist of all time?", 'remove', 'remove 2', 'show'];
    permissionLevel = CommandPermissionLevel.Helper;
    operations = ['add', 'remove', 'show'];
    aliases = ['discussiontopic', 'discussiontopics', 'discussionstopics', 'dtopics'];
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand((subcommand) =>
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
        )
        .addSubcommand((subcommand) => subcommand.setName('show').setDescription('Shows all discussion topics'));

    private logger: Logger<DiscussionsTopicCommand>;
    private discussionsRepository: DiscussionsRepository;
    private loggingService: LoggingService;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<DiscussionsTopicCommand>,
        @inject(TYPES.DiscussionsRepository) discussionsRepository: DiscussionsRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.discussionsRepository = discussionsRepository;
        this.logger = logger;
        this.loggingService = loggingService;
        this.memberService = memberService;
    }

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        if (interaction.options.getSubcommand() == 'add' && interaction.options.getString('topic')!.length > 256) {
            throw new ValidationError(`Topic too long.`, `A topic can't be longer than 256 characters.`);
        }

        return Promise.resolve();
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        let result: CommandResult;
        switch (interaction.options.getSubcommand()) {
            case this.operations[0]:
                result = await this.addDiscussionsTopic(interaction.options.getString('topic') as string, interaction);
                break;
            case this.operations[1]:
                result = await this.removeDiscussionsTopic(interaction.options.getInteger('topic'), interaction);
                break;
            case this.operations[2]:
                result = await this.showDiscussionsTopics(interaction);
                break;
            default:
                result = await this.showDiscussionsTopics(interaction);
        }

        return result;
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

    async showDiscussionsTopics(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        this.logger.info(`Showing all discussion topics...`);
        const topics = await this.discussionsRepository.getAllDiscussions();
        if (topics.length == 0) {
            return {
                isSuccessful: true,
                replyToUser: { content: `No discussion topics available.` },
            };
        }
        const topicsFile = await this.discussionsRepository.getAllDiscussionTopicsAsFile(topics);
        const unopenedTopicsLength = topics.filter((t) => !t.openedAt).length;

        return {
            isSuccessful: true,
            replyToUser: {
                content: `There are currently ${unopenedTopicsLength} open topics (${topics.length - unopenedTopicsLength} used). Current discussion topics (oldest to newest):`,
                files: [
                    new AttachmentBuilder(topicsFile!, {
                        name: `${moment().format('YYYY_MM_DD')}_discussion_topics.txt`,
                    }),
                ],
            },
        };
    }
}
