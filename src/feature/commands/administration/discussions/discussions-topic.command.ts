import { inject, injectable } from 'inversify';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import { ActionRowBuilder, AttachmentBuilder, Message, StringSelectMenuBuilder } from 'discord.js';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { DiscussionsRepository } from '@src/infrastructure/repositories/discussions.repository';
import * as moment from 'moment';
import { ComponentHelper } from '@src/helpers/component.helper';

@injectable()
export class DiscussionsTopicCommand implements ICommand {
    name: string = 'dtopic';
    description: string = 'Adds or removes a discussion topic for automatic posting in the discussions channel.';
    usageHint: string = 'add [topic] | remove [(optional) number to remove] | remove | show';
    examples: string[] = ["add Who's the best artist of all time?", 'remove', 'remove 2', 'show'];
    permissionLevel = CommandPermissionLevel.Helper;
    operations = ['add', 'remove', 'show'];
    aliases = ['discussiontopic', 'discussiontopics', 'discussionstopics', 'dtopics'];
    isUsableInDms = false;
    isUsableInServer = true;

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

    validateArgs(args: string[]): Promise<void> {
        if (args[0] && !this.operations.includes(args[0])) {
            throw new ValidationError(
                `Operation type ${args[0]} not valid for discussions.`,
                `You must provide a one of the following operation types: ${this.operations.join(', ')}`
            );
        }

        if (args[0] == this.operations[0] && args.length <= 1) {
            throw new ValidationError(
                `Operation add with no further args for discussions.`,
                `You must provide a discussion topic to add!`
            );
        }

        if (args[0] == this.operations[1] && args.length > 1) {
            try {
                if (Number.parseInt(args[1]) < 1)
                    throw new ValidationError(
                        `Operation remove with second argument ${args[1]} is too small for discussions.`,
                        `You must a valid number or pass no second argument!`
                    );
            } catch (e) {
                throw new ValidationError(
                    `Operation remove with second argument ${args[1]} is not a number for discussions.`,
                    `You must a valid number or pass no second argument!`
                );
            }
        }

        return Promise.resolve();
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        let result: CommandResult;
        switch (args[0]) {
            case this.operations[0]:
                result = await this.addDiscussionsTopic(args.slice(1).join(' '), message);
                break;
            case this.operations[1]:
                result = await this.removeDiscussionsTopic(args, message);
                break;
            case this.operations[2]:
                result = await this.showDiscussionsTopics(message);
                break;
            default:
                result = await this.showDiscussionsTopics(message);
        }

        return result;
    }

    private async addDiscussionsTopic(topic: string, message: Message): Promise<CommandResult> {
        this.logger.info(`Adding new discussions topic '${topic}' by ${message.author.username}...`);

        await this.discussionsRepository.addDiscussionTopic(topic, message.author);

        return {
            isSuccessful: true,
            replyToUser: `I've added the following topic:\n- \`${topic}\``,
        };
    }

    private async removeDiscussionsTopic(args: string[], message: Message): Promise<CommandResult> {
        const topics = await this.discussionsRepository.getAllUnusedDiscussions();
        if (args[1]) {
            const numberToRemove = Number.parseInt(args[1]);
            const discussionToRemove = topics[numberToRemove - 1];
            if (!discussionToRemove)
                return {
                    isSuccessful: false,
                    replyToUser: `This number is too high, I don't have that many topics stored!`,
                };
            this.logger.info(`Removing '${discussionToRemove.topic}' by ${message.author.username}...`);
            await this.discussionsRepository.removeDiscussionById(discussionToRemove._id);
            const user = await this.memberService.fetchUser(discussionToRemove.addedById);

            return {
                isSuccessful: true,
                replyToUser: `I've removed the following topic at position ${numberToRemove}:\n- \`${discussionToRemove.topic}\` (added by ${user?.username ?? 'unknown'} at <t:${moment(discussionToRemove.addedAt).unix()}:f>)`,
            };
        }
        this.logger.info(`No number provided, showing remove menu...`);
        const topicsFile = await this.discussionsRepository.getAllDiscussionTopicsAsFile(topics);

        if (!topicsFile) {
            return {
                isSuccessful: true,
                replyToUser: `No discussion topics to remove.`,
            };
        }

        await message.channel.send({
            content: `Please select the topic to remove below.`,
            files: [
                new AttachmentBuilder(topicsFile, {
                    name: `${moment().format('YYYY_MM_DD')}_discussion_topics.txt`,
                }),
            ],
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(ComponentHelper.discussionsMenu(topics)),
            ],
        });
        return {};
    }

    async showDiscussionsTopics(message: Message) {
        this.logger.info(`Showing all discussion topics...`);
        const topicsFile = await this.discussionsRepository.getAllDiscussionTopicsAsFile();

        if (!topicsFile) {
            return {
                isSuccessful: true,
                replyToUser: `No discussion topics available.`,
            };
        }

        await message.channel.send({
            content: `Current discussion topics (oldest to newest):`,
            files: [
                new AttachmentBuilder(topicsFile, {
                    name: `${moment().format('YYYY_MM_DD')}_discussion_topics.txt`,
                }),
            ],
        });

        return {
            isSuccessful: true,
        };
    }
}
