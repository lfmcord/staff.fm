import { inject, injectable } from 'inversify';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { StringSelectMenuInteraction } from 'discord.js';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';

@injectable()
export class VerifyRemoveInteraction implements IMessageComponentInteraction {
    customIds = ['defer-verifyremove'];
    logger: Logger<VerifyRemoveInteraction>;
    usersRepository: UsersRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<VerifyRemoveInteraction>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository
    ) {
        this.usersRepository = usersRepository;
        this.logger = logger;
    }

    async manage(interaction: StringSelectMenuInteraction) {
        const values = interaction.values[0].split('_');
        this.logger.debug(`Interaction ID ${interaction.customId} is a verify remove interaction.`);

        const user = await this.usersRepository.getUserByUserId(values[0]);
        const verificationToDelete = user?.verifications.find((v) => v._id == values[1]);
        if (!verificationToDelete) {
            this.logger.error(
                `Provided values of user ID ${values[0]} and verifications _id ${values[1]} does not correspond to a database entry.`
            );
            await interaction.update({
                embeds: [],
                components: [],
                content: `OOPSIE WOOPSIE!! Uwu We make a fucky wucky!! A wittle fucko boingo! The code monkeys at our headquarters are working VEWY HAWD to fix this! `,
            });
            return;
        }
        this.logger.info(`Deleting verification from user ID ${user!.userId} with _id ${verificationToDelete._id}`);
        await this.usersRepository.removeVerificationFromUser(user!.userId, verificationToDelete._id);

        await interaction.update({
            embeds: [],
            components: [],
            content: `I've deleted the verification for username \`${verificationToDelete.username ?? 'NO LAST.FM ACCOUNT'}\` from <@${user!.userId}>.`,
        });
    }
}
