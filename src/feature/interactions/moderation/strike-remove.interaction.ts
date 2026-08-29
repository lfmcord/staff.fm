import { Environment } from '@models/environment';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { StrikeHelper } from '@src/helpers/strike.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { MutesRepository } from '@src/infrastructure/repositories/mutes.repository';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ModerationService } from '@src/infrastructure/services/moderation.service';
import { TYPES } from '@src/types';
import { StringSelectMenuInteraction, User } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { Logger } from 'tslog';

@injectable()
export class StrikeRemoveInteraction implements IMessageComponentInteraction {
    customIds = ['defer-strike-remove'];
    private logger: Logger<StrikeRemoveInteraction>;
    private memberService: MemberService;
    private usersRepository: UsersRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StrikeRemoveInteraction>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
    ) {
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.logger = logger;
    }

    async manage(interaction: StringSelectMenuInteraction) {
        const values = interaction.values[0].split('_');
        const userId = values[0];
        const strikeId = values[1];
        this.logger.debug(
            `Interaction ID ${interaction.customId} is a strike remove from user ${userId} for strike ID ${strikeId}.`
        );
        const member = await this.memberService.getGuildMemberFromUserId(userId);
        const user = await this.memberService.fetchUser(userId);

        if (!user) {
            this.logger.warn(`User ID ${userId} not found.`);
            await interaction.update({ content: 'User not found.', components: [], embeds: [] });
            return;
        }

        const removedStrike = await this.usersRepository.removeStrikeFromUser(userId, strikeId);
        if (!removedStrike) {
            this.logger.warn(`Failed to remove strike ID ${strikeId} from user ID ${TextHelper.userLog(user)}.`);
            await interaction.update({ content: 'Failed to remove strike.', components: [], embeds: [] });
            return;
        }

        const content = `Strike has been removed from user ${TextHelper.userDisplay(user)}.`;

        try {
            await interaction.update({
                content:content,
                components: [],
                embeds: [],
            });
        } catch (e) {
            await interaction.update({});
            if(interaction.channel?.isSendable()) await interaction.channel.send(content);
        }

        this.logger.info(`Appeal for ${TextHelper.userLog(user)} has been processed.`);
    }
}
