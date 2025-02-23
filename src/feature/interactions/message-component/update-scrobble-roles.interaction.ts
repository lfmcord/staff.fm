import { inject, injectable } from 'inversify';
import { IMessageComponentInteraction } from '@src/feature/interactions/abstractions/message-component-interaction.interface';
import { ButtonInteraction } from 'discord.js';
import { TYPES } from '@src/types';
import { Logger } from 'tslog';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { ICommand } from '@src/feature/commands/models/command.interface';
import container from '@src/inversify.config';
import { UpdateCommand } from '@src/feature/commands/utility/update.command';

@injectable()
export class UpdateScrobbleRolesInteraction implements IMessageComponentInteraction {
    customIds = ['defer-update-roles'];
    logger: Logger<UpdateScrobbleRolesInteraction>;
    usersRepository: UsersRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<UpdateScrobbleRolesInteraction>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository
    ) {
        this.usersRepository = usersRepository;
        this.logger = logger;
    }

    async manage(interaction: ButtonInteraction) {
        try {
            this.logger.debug(`Interaction ID ${interaction.customId} is a Update scrobble roles interaction.`);
            const staffmailCommand = container.getAll<ICommand>('Command').find((c) => c.name === 'update');
            (staffmailCommand as UpdateCommand)?.runInteraction(interaction);
        } catch (e) {
            this.logger.error(`Could not run update scrobble role interaction`, e);
            await interaction.reply({
                content: `Something went wrong while I was trying to dismiss the message. Whoopsie! (,,> ᴗ <,,) Please try again!`,
                ephemeral: true,
            });
        }
    }
}
