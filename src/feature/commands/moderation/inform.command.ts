import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class InformCommand implements ICommand {
    name: string = 'inform';
    description: string = 'Sends someone a neutral information message from staff.';
    permissionLevel = CommandPermissionLevel.Moderator;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption((option) =>
            option.setName('user').setDescription('The discord user to inform').setRequired(true)
        )
        .addStringOption((option) =>
            option.setName('content').setDescription('The content of the inform').setRequired(true)
        );

    private logger: Logger<InformCommand>;
    private loggingService: LoggingService;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<InformCommand>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.loggingService = loggingService;
        this.memberService = memberService;
        this.logger = logger;
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const userId = interaction.options.getUser('user')!.id;
        const member = await this.memberService.getGuildMemberFromUserId(userId);
        if (!member) {
            return {
                isSuccessful: false,
                replyToUser: { content: `I cannot inform this user because they are not in the server.` },
            };
        }
        this.logger.info(`Trying to inform user ${TextHelper.userLog(member.user)}...`);

        const content = interaction.options.getString('content')!;
        try {
            await member.send({ embeds: [EmbedHelper.getInformEmbed(content)] });
        } catch (e) {
            this.logger.warn(`Could not send message to user ${userId}`, e);
            return {
                isSuccessful: false,
                replyToUser: {
                    content: `I cannot inform this user because their DMs are closed or they have me blocked.`,
                },
            };
        }

        this.logger.info(`Sent information message to user ${TextHelper.userLog(member.user)}.`);
        await this.loggingService.logInform(member.user, interaction.user, content);

        return {
            isSuccessful: true,
            replyToUser: { content: `I have sent the information message to ${TextHelper.userDisplay(member.user)}.` },
        };
    }

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        const textLength = interaction.options.getString('content')!.length;
        if (textLength > 4000) {
            throw new ValidationError(
                `Text too long.`,
                `The text for the inform must be less than 4000 characters (currently: ${textLength}).`
            );
        }
        return Promise.resolve();
    }
}
