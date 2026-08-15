import { ErrorMessages } from '@models/error-messages';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { IUserModel, UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { ChatInputCommandInteraction, InteractionReplyOptions, SlashCommandBuilder, bold } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import moment = require('moment');

@injectable()
export class CrownsCommand implements ICommand {
    name: string = 'crowns';
    description: string = 'Adds, removes or checks a crowns bans flag for a user.';
    permissionLevel = CommandPermissionLevel.Helper;
    isUsableInDms = false;
    isUsableInServer = true;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('ban')
                .setDescription('Crowns bans a user')
                .addUserOption((option) => option.setName('user').setDescription('The user to ban').setRequired(true))
                .addStringOption((option) =>
                    option.setName('reason').setDescription('The reason for the ban').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('unban')
                .setDescription('Crowns unbans a user')
                .addUserOption((option) => option.setName('user').setDescription('The user to unban').setRequired(true))
                .addStringOption((option) =>
                    option.setName('reason').setDescription('The reason for the unban').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('check')
                .setDescription('Checks if a user is crowns banned')
                .addUserOption((option) => option.setName('user').setDescription('The user to check').setRequired(true))
        );

    private logger: Logger<CrownsCommand>;
    private usersRepository: UsersRepository;
    private loggingService: LoggingService;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<CrownsCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.usersRepository = usersRepository;
        this.logger = logger;
        this.loggingService = loggingService;
        this.memberService = memberService;
    }

    validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const isBan = interaction.options.getSubcommand() == 'ban';
        const userId = interaction.options.getUser('user')!.id;
        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (!indexedUser) {
            this.logger.info(`crowns command for user ID ${userId} cannot run because user is not in DB.`);
            return {
                isSuccessful: false,
                replyToUser: { embeds: [EmbedHelper.getUserNotIndexedEmbed()] },
            };
        }

        let reply: InteractionReplyOptions;
        switch (interaction.options.getSubcommand()) {
            case 'ban':
                reply = await this.ban(interaction, indexedUser);
                break;
            case 'unban':
                reply = await this.unban(interaction, indexedUser);
                break;
            case 'check':
                reply = await this.check(interaction, indexedUser);
                break;
            default:
                reply = { content: ErrorMessages.HaiynFuckedUp };
        }

        return {
            isSuccessful: true,
            replyToUser: reply,
        };
    }

    private async ban(
        interaction: ChatInputCommandInteraction,
        indexedUser: IUserModel
    ): Promise<InteractionReplyOptions> {
        const hasCrownsBan = indexedUser.crownsBan != null;
        const reason = interaction.options.getString('reason')!;
        let replyToUser;
        if (hasCrownsBan) replyToUser = `This user already has a crowns ban flag.`;
        else {
            this.logger.info(`Command is new crowns ban request, adding crowns ban to DB.`);
            await this.usersRepository.addCrownBanToUser(interaction.user.id, indexedUser.userId, reason);
            replyToUser = `<:nocrown:816944519924809779> I've added the crowns ban flag to <@!${indexedUser.userId}>.\n-# Please note that this does not mean they are banned from the WK crowns game. For that, use the WhoKnows command.`;
        }

        const member = await this.memberService.getGuildMemberFromUserId(indexedUser.userId);
        if (!member) {
            replyToUser += ` It seems like this user has left the server.`;
        } else {
            await this.loggingService.logCrownsBan(interaction.user, member?.user, reason, true);
        }

        return {
            content: replyToUser,
        };
    }

    private async unban(
        interaction: ChatInputCommandInteraction,
        indexedUser: IUserModel
    ): Promise<InteractionReplyOptions> {
        const hasCrownsBan = indexedUser.crownsBan != null;
        const reason = interaction.options.getString('reason')!;
        let replyToUser;
        if (hasCrownsBan) {
            this.logger.info(`Command is new crowns unban request, removing crowns ban from DB.`);
            await this.usersRepository.removeCrownsBanFromUser(interaction.user.id);
            replyToUser = `👑 I've removed the crowns ban flag from <@!${indexedUser.userId}>.\n-# Please note that this does not mean they can participate in the crowns game again. For that, use the WhoKnows command.`;
        } else replyToUser = `This user has no crowns ban flag.`;

        const member = await this.memberService.getGuildMemberFromUserId(indexedUser.userId);
        if (!member) {
            replyToUser += ` It seems like this user has left the server.`;
        } else {
            await this.loggingService.logCrownsBan(interaction.user, member?.user, reason, false);
        }

        return {
            content: replyToUser,
        };
    }

    private async check(
        interaction: ChatInputCommandInteraction,
        indexedUser: IUserModel
    ): Promise<InteractionReplyOptions> {
        let replyToUser = '👑 This user is not crowns banned.';
        if (indexedUser.crownsBan != null) {
            const actor = await this.memberService.fetchUser(indexedUser.crownsBan.bannedById);
            replyToUser = `<:nocrown:816944519924809779> This user has been crowns banned on <t:${moment(indexedUser.crownsBan.bannedOn).unix()}:d> by ${TextHelper.userDisplay(actor, false)}.`;
            replyToUser += `\n📝 ${bold('Reason:')} ${indexedUser.crownsBan.reason ? indexedUser.crownsBan.reason : 'No reason provided. Check the logs to find the reason.'}`;
        }

        return {
            content: replyToUser,
        };
    }
}
