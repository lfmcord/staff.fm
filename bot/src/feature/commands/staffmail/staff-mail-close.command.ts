import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Message, MessageResolvable } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { Logger } from 'tslog';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { TYPES } from '@src/types';
import { TextHelper } from '@src/helpers/text.helper';
import { EmbedHelper } from '@src/helpers/embed.helper';

@injectable()
export class StaffMailCloseCommand implements ICommand {
    name: string = 'close';
    description: string = 'Closes a staff mail channel. Reasons are not disclosed to the user.';
    usageHint: string = '<reason>';
    examples: string[] = ['Closing because of inactivity.', 'Crowns unban request, granted.'];
    permissionLevel = CommandPermissionLevel.Staff;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<StaffMailCloseCommand>;
    private staffmailRepository: StaffMailRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StaffMailCloseCommand>,
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository
    ) {
        this.logger = logger;
        this.staffmailRepository = staffMailRepository;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        this.logger.info(
            `New staffmail close request by user ${TextHelper.userLog(message.author)} for channel ID ${message.channelId}.`
        );
        const deleted = await this.staffmailRepository.deleteStaffMail(message.channelId);
        if (deleted == null) {
            return {
                isSuccessful: false,
                reason: `Cannot find a staff mail for channel ID ${message.channelId}`,
                replyToUser: `You are not in a staff mail channel! Please run this command in a staff mail channel.`,
            };
        }
        if (deleted.user == null) {
            this.logger.debug(
                `User with ID ${deleted.userId} has left the server. StaffMail channel was closed regardless.`
            );
            return {};
        }

        try {
            await deleted.user.send({
                embeds: [EmbedHelper.getStaffMailCloseEmbed(deleted.summary, deleted.type, args.join(' '))],
            });
        } catch (e) {
            this.logger.warn(`Could not send closing message to user.`, e);
            return {
                isSuccessful: false,
                replyToUser: `I could not send the closing message to the user. Perhaps they have their DMs closed (or have blocked me 😭). `,
            };
        }

        await (await deleted.user.dmChannel?.messages.fetch(deleted.lastMessageId as MessageResolvable))?.unpin();

        this.logger.debug(`Staffmail channel was closed.`);

        // TODO: Send closing log with contents

        return {};
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}
