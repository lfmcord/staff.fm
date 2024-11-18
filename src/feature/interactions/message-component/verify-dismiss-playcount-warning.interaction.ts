import { inject, injectable } from 'inversify';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { ButtonInteraction } from 'discord.js';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';

@injectable()
export class VerifyDismissPlaycountWarningInteraction implements IMessageComponentInteraction {
    customIds = ['defer-dismiss-playcount-warning'];
    logger: Logger<VerifyDismissPlaycountWarningInteraction>;
    usersRepository: UsersRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<VerifyDismissPlaycountWarningInteraction>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository
    ) {
        this.usersRepository = usersRepository;
        this.logger = logger;
    }

    async manage(interaction: ButtonInteraction) {
        try {
            await interaction.message.delete();
        } catch (e) {
            this.logger.error(`Could not delete zero playcount message`, e);
            await interaction.reply({
                content: `Something went wrong while I was trying to dismiss the message. Whoopsie! (,,> ᴗ <,,) Please try again!`,
                ephemeral: true,
            });
        }
    }
}
