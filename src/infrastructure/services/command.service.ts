import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { TextHelper } from '@src/helpers/text.helper';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { GuildMember, Interaction } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class CommandService {
    memberService: MemberService;
    logger: Logger<CommandService>;

    constructor(
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.BotLogger) logger: Logger<CommandService>
    ) {
        this.memberService = memberService;
        this.logger = logger;
    }

    public async isPermittedToRun(member: GuildMember, commandToRun: ICommand): Promise<boolean> {
        const permissionLevel = await this.memberService.getMemberPermissionLevel(member!);
        if (
            /* permissionLevel === CommandPermissionLevel.User */
            permissionLevel < commandToRun.permissionLevel
        ) {
            this.logger.info(
                `User ${TextHelper.userLog(member.user)} is trying to run a command that requires permission level '${commandToRun.permissionLevel}', but has permission level '${permissionLevel}'.`
            );
            return false;
        }
        return true;
    }

    public async handleError(interaction: Interaction, messageToUser: string = `Oops, something went wrong!`) {
        if (interaction.isRepliable())
            if (interaction.deferred) interaction.editReply({ content: messageToUser });
            else interaction.reply({ content: messageToUser, ephemeral: true });
        else if (interaction.channel && interaction.channel.isSendable())
            interaction.channel.send({ content: messageToUser });
    }

    public async handleResult(
        interaction: Interaction,
        result: CommandResult,
        commandName: string,
        executionTime: number
    ) {
        let log = result.isSuccessful
            ? `Successfully finished interaction command '${commandName}'.`
            : `Failed to finish interaction command '${commandName}'${result.reason ? ` (Reason: '${result.reason}')` : ''}.`;
        log += ` Execution took ${executionTime}ms.`;
        this.logger.info(log);

        if (interaction.isRepliable()) {
            if (interaction.deferred && interaction.replied)
                interaction.editReply({
                    content: result.replyToUser?.content ? result.replyToUser.content : `Done! 🫡`,
                    components: result.replyToUser?.components,
                    embeds: result.replyToUser?.embeds,
                });
            else if(!interaction.replied)
                interaction.reply({
                    ...result.replyToUser,
                    content: result.replyToUser?.content ? result.replyToUser.content : `Done! 🫡`,
                    ephemeral: result.isEphemeral || !result.replyToUser,
                });
        }
    }
}
