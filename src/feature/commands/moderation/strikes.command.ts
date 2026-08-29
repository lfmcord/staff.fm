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
import {
    ActionRowBuilder,
    bold, ButtonBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder, StringSelectMenuBuilder,
} from 'discord.js';
import { StrikeHelper } from '@src/helpers/strike.helper';
import { Strike } from '@src/feature/commands/moderation/models/strike.model';
import { ComponentHelper } from '@src/helpers/component.helper';
import { ErrorMessages } from '@models/error-messages';
import { MessageService } from '@src/infrastructure/services/message.service';
import * as moment from 'moment';
import { LoggingService } from '@src/infrastructure/services/logging.service';

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
        .addSubcommand((subcommand) =>
            subcommand
                .setName('add')
                .setDescription('Manually add a strike to a user')
                .addUserOption((option) =>
                    option.setName('user').setDescription('The discord user to add a strike to').setRequired(true)
                )
                .addStringOption((option) =>
                    option.setName('reason').setDescription('The reason for the manual strike').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription('Manually remove a strike from a user')
                .addUserOption((option) =>
                    option.setName('user').setDescription('The discord user to remove a strike from').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('transfer')
                .setDescription('Transfer strikes from one user to another. Will override existing strikes.')
                .addUserOption((option) =>
                    option.setName('source').setDescription('The source discord user to transfer from').setRequired(true)
                )
                .addUserOption((option) =>
                    option.setName('target').setDescription('The target discord user to transfer to').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('appeal')
                .setDescription('Submit an appeal for a strike')
                .addUserOption((option) =>
                    option.setName('user').setDescription('The discord user to appeal a strike for').setRequired(true)
                )
                .addStringOption((option) =>
                    option.setName('reason').setDescription('The reason for the appeal').setRequired(true)
                )
        ).addSubcommand((subcommand) =>
            subcommand
                .setName('check')
                .setDescription('Check a user\'s strikes')
                .addUserOption((option) =>
                    option.setName('user').setDescription('The discord user to check').setRequired(true)
                )
        );

    private memberService: MemberService;
    private env: Environment;
    private usersRepository: UsersRepository;
    private loggingService: LoggingService;

    constructor(
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
    ) {
        this.loggingService = loggingService;
        this.memberService = memberService;
        this.env = env;
        this.usersRepository = usersRepository;
    }

    async validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {}

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        let result: CommandResult;
        switch (interaction.options.getSubcommand()) {
            case 'add':
                result = await this.add(interaction);
                break;
            case 'remove':
                result = await this.remove(interaction);
                break;
            case 'transfer':
                result = await this.transfer(interaction);
                break;
            case 'appeal':
                result = await this.appeal(interaction);
                break;
            default:
                result = await this.check(interaction);
                break;
        }

        return result;

    }

    private async add(interaction: ChatInputCommandInteraction): Promise<CommandResult> {

        const userId = interaction.options.getUser('user')!.id;
        const reason = interaction.options.getString('reason')!;
        const user = await this.memberService.fetchUser(userId);
        if (!user) {
            throw new ValidationError(`User not found.`, `I couldn't find the user you provided.`);
        }

        const indexedUser = await this.usersRepository.getUserByUserId(userId);

        const activeStrikes = StrikeHelper.getActiveStrikes(indexedUser?.strikes ?? []);
        const allStrikes = indexedUser?.strikes ?? [];
        const logMessage = await this.loggingService.logStrike(
            user,
            interaction.user,
            reason,
            activeStrikes.length + 1,
            allStrikes.length + 1,
            'no action (manually added)'
        );

        const now = moment();
        await this.usersRepository.addStrikeToUser(user, interaction.user, interaction.options.getString('reason')!, now.toDate(),
            now.add(this.env.MODERATION.STRIKE_EXPIRATION_IN_MONTHS, 'months').toDate(),
            logMessage ? TextHelper.getDiscordMessageLink(logMessage) : undefined);

        await this.usersRepository.addStrikeToUser(
            user,
            interaction.user,
            reason,
            now.toDate(),
            now.add(this.env.MODERATION.STRIKE_EXPIRATION_IN_MONTHS, 'months').toDate(),
        );

        return {
            isSuccessful: true,
            replyToUser: { content: `Successfully added a strike to ${TextHelper.userDisplay(user)} for reason: "${reason}".` },
        };
    }

    private async remove(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const userId = interaction.options.getUser('user')!.id;
        const user = await this.memberService.fetchUser(userId);
        if (!user) {
            throw new ValidationError(`User not found.`, `I couldn't find the user you provided.`);
        }

        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        const allStrikes = indexedUser?.strikes ?? [];

        const removableStrikes: Strike[] = await Promise.all(
            allStrikes.map(async (strike) => {
                return {
                    _id: strike._id,
                    actor: (await this.memberService.fetchUser(strike.createdById))!,
                    subject: (await this.memberService.fetchUser(indexedUser!.userId))!,
                    reason: strike.reason,
                    createdAt: strike.createdAt,
                    expiresOn: strike.expiresOn,
                    logMessageLink: strike.strikeLogLink,
                };
            })
        );

        return {
            isSuccessful: true,
            replyToUser: {
                content: `Which strike do you want to set to remove? Please select below. ${bold('This action will NOT inform the affected user!')}`,
                embeds: [EmbedHelper.getStrikesEmbed(allStrikes)],
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
                        ComponentHelper.strikeRemoveMenu(removableStrikes),
                    ]),
                    new ActionRowBuilder<ButtonBuilder>().addComponents(ComponentHelper.cancelButton('defer-cancel')),
                ],
            }
        };
    }

    private async transfer(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const sourceUserId = interaction.options.getUser('source')!.id;
        const sourceUser = await this.memberService.fetchUser(sourceUserId);
        if (!sourceUser) {
            throw new ValidationError(`Source user not found.`, `I couldn't find the source user you provided.`);
        }
        const indexedSourceUser = await this.usersRepository.getUserByUserId(sourceUserId);
        const sourceStrikes: Strike[] = await Promise.all(
            (indexedSourceUser?.strikes ?? []).map(async (strike) => {
                return {
                    _id: strike._id,
                    actor: (await this.memberService.fetchUser(strike.createdById))!,
                    subject: (await this.memberService.fetchUser(indexedSourceUser!.userId))!,
                    reason: strike.reason,
                    createdAt: strike.createdAt,
                    expiresOn: strike.expiresOn,
                    logMessageLink: strike.strikeLogLink,
                };
            }));
        if(sourceStrikes.length === 0) {
            return {
                isSuccessful: false,
                replyToUser: { content: `Source user has no strikes to transfer.` },
            };
        }

        const targetUserId = interaction.options.getUser('target')!.id;
        const targetUser = await this.memberService.fetchUser(targetUserId);
        if (!targetUser) {
            throw new ValidationError(`Target user not found.`, `I couldn't find the target user you provided.`);
        }
        const indexedTargetUser = await this.usersRepository.getUserByUserId(targetUserId);
        if(!indexedTargetUser) {
            return {
                isSuccessful: false,
                replyToUser: { content: ErrorMessages.UserNotIndexed },
            };
        }
        const targetStrikes = indexedTargetUser?.strikes ?? [];

        for (const targetStrike of targetStrikes) {
            await this.usersRepository.removeStrikeFromUser(targetUserId, targetStrike._id);
            // TODO: edit log message to indicate that the strike was overridden due to transfer
        }

        for (const sourceStrike of sourceStrikes) {
            await this.usersRepository.addStrikeToUser(targetUser, sourceStrike.actor, sourceStrike.reason, sourceStrike.createdAt, sourceStrike.expiresOn, sourceStrike.logMessageLink);
            // TODO: edit log message to indicate that the strike was transferred from source user
        }

        let reply = `Successfully transferred ${sourceStrikes.length} strikes from ${TextHelper.userDisplay(sourceUser)} to ${TextHelper.userDisplay(targetUser)}.`;
        if(targetStrikes.length > 0) {
            reply += `\n-# Note: ${targetStrikes.length} strikes were removed from the target user to make room for the transferred strikes.`;
        }
        return {
            isSuccessful: true,
            replyToUser: { content: reply },
        }
    }

    private async check(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
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

    private async appeal(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
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
                    expiresOn: strike.expiresOn,
                    logMessageLink: strike.strikeLogLink,
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
}
