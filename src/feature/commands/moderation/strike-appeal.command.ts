import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { Strike } from '@src/feature/commands/moderation/models/strike.model';
import { ComponentHelper } from '@src/helpers/component.helper';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StrikeHelper } from '@src/helpers/strike.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import {
    ActionRowBuilder,
    bold,
    ButtonBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';
import { inject, injectable } from 'inversify';

@injectable()
export class StrikeAppealCommand implements ICommand {
    name: string = 'strikeappeal';
    description: string = 'Sets a strike to appealed.';
    permissionLevel = CommandPermissionLevel.Moderator;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption((option) =>
            option.setName('user').setDescription('The discord user to appeal a strike for').setRequired(true)
        )
        .addStringOption((option) =>
            option.setName('reason').setDescription('The reason for the appeal').setRequired(true)
        );

    private usersRepository: UsersRepository;
    private env: Environment;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.env = env;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const userId = interaction.options.getUser('user')!.id;
        const user = await this.memberService.fetchUser(userId);
        if (!user) {
            throw new ValidationError(`User not found.`, `I couldn't find the user you provided.`);
        }

        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        const allStrikes = indexedUser?.strikes ?? [];
        const activeStrikes = StrikeHelper.getActiveStrikes(allStrikes);
        if (activeStrikes.length === 0) {
            return {
                isSuccessful: false,
                replyToUser: { content: `This user does not have any strikes that can be appealed.` },
            };
        }

        const appealableStrikes: Strike[] = await Promise.all(
            activeStrikes.map(async (strike) => {
                return {
                    _id: strike._id,
                    actor: (await this.memberService.fetchUser(strike.createdById))!,
                    subject: (await this.memberService.fetchUser(indexedUser!.userId))!,
                    reason: strike.reason,
                    createdAt: strike.createdAt,
                };
            })
        );

        const reason = interaction.options.getString("reason")!;

        return {
            isSuccessful: true,
            replyToUser: {
                content: `Which strike do you want to set to appealed with the reason "${reason}"? Please select below. ${bold('This action will inform the affected user!')}`,
                embeds: [EmbedHelper.getStrikesEmbed(activeStrikes)],
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
                        ComponentHelper.strikeAppealMenu(appealableStrikes),
                    ]),
                    new ActionRowBuilder<ButtonBuilder>().addComponents(ComponentHelper.cancelButton('defer-cancel')),
                ],
            }
        };
    }

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        const reasonLength = interaction.options.getString('reason')!.length;
        if (reasonLength > 1500) {
            throw new ValidationError(
                `Reason too long.`,
                `The reason for the strike must be less than 2000 characters (currently: ${reasonLength}).`
            );
        }
        return Promise.resolve();
    }
}
