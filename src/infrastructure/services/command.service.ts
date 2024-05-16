import { inject, injectable } from 'inversify';
import { GuildMember, Interaction, Message } from 'discord.js';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { TextHelper } from '@src/helpers/text.helper';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import { MemberService } from '@src/infrastructure/services/member.service';
import { CommandResult } from '@src/feature/commands/models/command-result.model';

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

    public async handleCommandErrorForMessage(message: Message, messageToUser: string = `Oops, something went wrong!`) {
        await message.reply({ content: messageToUser, allowedMentions: { repliedUser: false } });
        await message.react(TextHelper.failure);
    }

    public async handleCommandResultForMessage(
        message: Message,
        result: CommandResult,
        commandName: string,
        executionTime: number
    ) {
        if (result.isSuccessful == null) {
            this.logger.info(`Command '${commandName}' finished silently.`);
            return;
        }
        let log = result.isSuccessful
            ? `Successfully finished command '${commandName}'.`
            : `Failed to finish command '${commandName}'${result.reason ? ` (Reason: '${result.reason}')` : ''}.`;
        log += ` Execution took ${executionTime}ms.`;
        this.logger.info(log);
        const emoji = result.isSuccessful ? TextHelper.success : TextHelper.failure;
        await message.react(emoji);

        let reply: Message;
        if (result.replyToUser) {
            reply = await message.channel.send(`${result.replyToUser}`);
        }

        if (result.shouldDelete) {
            setTimeout(async () => {
                await message.delete();
                if (reply) await reply.delete();
            }, 10000);
        }
    }

    public async handleCommandErrorForInteraction(
        interaction: Interaction,
        messageToUser: string = `Oops, something went wrong!`
    ) {
        if (interaction.isRepliable())
            if (interaction.deferred) interaction.editReply({ content: messageToUser });
            else interaction.reply({ content: messageToUser, ephemeral: true });
        else if (interaction.channel) await interaction.channel.send({ content: messageToUser });
    }

    public async handleCommandResultForInteraction(
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
            if (interaction.deferred)
                interaction.editReply({
                    content: result.replyToUser ? result.replyToUser : `Done! 🫡`,
                });
            else
                interaction.reply({
                    content: result.replyToUser ? result.replyToUser : `Done! 🫡`,
                    ephemeral: result.shouldDelete || !result.replyToUser,
                });
        }
    }
}
