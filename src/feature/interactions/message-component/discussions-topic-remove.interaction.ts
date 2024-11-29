import { inject, injectable } from 'inversify';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { StringSelectMenuInteraction } from 'discord.js';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { DiscussionsRepository } from '@src/infrastructure/repositories/discussions.repository';
import * as moment from 'moment/moment';
import { MemberService } from '@src/infrastructure/services/member.service';

@injectable()
export class DiscussionsTopicRemoveInteraction implements IMessageComponentInteraction {
    customIds = ['defer-discussions-topic-remove'];
    logger: Logger<DiscussionsTopicRemoveInteraction>;
    memberService: MemberService;
    discussionsRepository: DiscussionsRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<DiscussionsTopicRemoveInteraction>,
        @inject(TYPES.DiscussionsRepository) discussionsRepository: DiscussionsRepository,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.memberService = memberService;
        this.discussionsRepository = discussionsRepository;
        this.logger = logger;
    }

    async manage(interaction: StringSelectMenuInteraction) {
        this.logger.debug(`Interaction ID ${interaction.customId} is a discussions topic remove interaction.`);
        const id = interaction.values[0];

        const discussionToDelete = await this.discussionsRepository.getDiscussionById(id);
        if (!discussionToDelete) {
            this.logger.error(`Provided values of mongo ID ${id} does not correspond to a database entry.`);
            await interaction.update({
                embeds: [],
                components: [],
                content: `OOPSIE WOOPSIE!! Uwu We make a fucky wucky!! A wittle fucko boingo! The code monkeys at our headquarters are working VEWY HAWD to fix this! `,
            });
            return;
        }
        this.logger.info(`Deleting discussion with _id ${discussionToDelete._id}`);
        await this.discussionsRepository.removeDiscussionById(id);

        const user = await this.memberService.fetchUser(discussionToDelete.addedById);

        await interaction.update({
            embeds: [],
            components: [],
            content: `I've removed the follwoing topic:\n- \`${discussionToDelete.topic}\` (added by ${user?.username ?? 'unknown'} at <t:${moment(discussionToDelete.addedAt).unix()}:f>)`,
            attachments: [],
        });
    }
}
