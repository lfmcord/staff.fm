import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { inject, injectable } from 'inversify';
import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

@injectable()
export class StrikesCommand implements ICommand {
    name: string = 'strikes';
    description: string = 'Shows all strikes of a user.';
    permissionLevel = CommandPermissionLevel.Moderator;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption((option) =>
            option.setName('user').setDescription('The discord user to check').setRequired(true)
        );

    private memberService: MemberService;
    private env: Environment;
    private usersRepository: UsersRepository;

    constructor(
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.memberService = memberService;
        this.env = env;
        this.usersRepository = usersRepository;
    }

    async validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {}

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const userId = interaction.options.getUser('user')!.id;
        const user = await this.memberService.fetchUser(userId);
        if (!user) {
            return {
                isSuccessful: false,
                replyToUser: { content: `User with ID ${userId} not found.` },
            };
        }

        const member = await this.memberService.getGuildMemberFromUserId(userId);
        const strikes = await this.usersRepository.getAllStrikesOfUser(userId);

        if (strikes.length === 0) {
            return {
                isSuccessful: true,
                replyToUser: { content: `This user has no strikes on record.` },
            };
        }

        const embed = EmbedHelper.getStrikesEmbed(strikes, user);
        if (!member) embed.setDescription(`:warning: Not in this server.\n\n` + embed.data.description);

        return {
            isSuccessful: true,
            replyToUser: {
                embeds: [embed],
            }
        };
    }
}
