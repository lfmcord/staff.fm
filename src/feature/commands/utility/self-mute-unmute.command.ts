import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { TextHelper } from '@src/helpers/text.helper';
import { MutesRepository } from '@src/infrastructure/repositories/mutes.repository';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ModerationService } from '@src/infrastructure/services/moderation.service';
import { TYPES } from '@src/types';
import {
    ButtonInteraction,
    ChatInputCommandInteraction, InteractionContextType,
    Message,
    PartialMessage,
    Role,
    SlashCommandBuilder,
    User,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';

@injectable()
export class SelfMuteUnmuteCommand implements ICommand {
    name: string = 'unmute';
    description: string = 'Unmutes yourself if you currently have a selfmute active.';
    permissionLevel = CommandPermissionLevel.User;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setContexts(InteractionContextType.BotDM);

    private logger: Logger<SelfMuteUnmuteCommand>;
    private memberService: MemberService;
    private moderationService: ModerationService;
    private mutesRepository: MutesRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<SelfMuteUnmuteCommand>,
        @inject(TYPES.ModerationService) moderationService: ModerationService,
        @inject(TYPES.MutesRepository) mutesRepository: MutesRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
    ) {
        this.memberService = memberService;
        this.mutesRepository = mutesRepository;
        this.moderationService = moderationService;
        this.logger = logger;
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        if (!interaction.deferred) await interaction.deferReply();
        return await this.tryToEndSelfmute(interaction.user!, `User used unmute command.`);
    }

    public async runInteraction(interaction: ButtonInteraction) {
        if (!interaction.deferred) await interaction.deferUpdate();
        const result = await this.tryToEndSelfmute(interaction.user, `User used end selfmute button.`);
        if (result.replyToUser) {
            await interaction.editReply({
                content: result.replyToUser.content,
            });
        } else {
            await interaction.editReply({});
        }
        if (result.isSuccessful)
            await interaction.message.reply({
                content: interaction.message.content,
                components: [],
            });
    }

    private async tryToEndSelfmute(user: User, reason: string): Promise<CommandResult> {
        this.logger.info(`User ${TextHelper.userLog(user)} is trying to manually remove a selfmute via DMs.`);

        const existingSelfMute = await this.mutesRepository.getMuteByUserId(user.id);
        if (!existingSelfMute || existingSelfMute.actorId !== user.id) {
            return {
                isSuccessful: false,
                replyToUser: { content: `You do not currently have an active selfmute!` },
                reason: `User ${TextHelper.userLog(user)} does not have an active selfmute.`,
            };
        }
        if (existingSelfMute?.isStrict) {
            return {
                isSuccessful: false,
                replyToUser: { content: `You have requested a strict selfmute. You cannot unmute yourself early.\n-# Please contact staff if you think this is a mistake.` },
            };
        }

        const member = await this.memberService.getGuildMemberFromUserId(user.id);
        if (!member) {
            return {
                isSuccessful: false,
                replyToUser: { content: `I cannot unmute you because you are not in the server.` },
            };
        }

        const roles: Role[] = [];
        for (const roleId of existingSelfMute.roleIds) {
            const role = member.guild.roles.cache.get(roleId);
            if (role) {
                roles.push(role);
            }
        }

        await this.moderationService.unmuteGuildMember(
            member!,
            roles,
            member!.user,
            {
                content: `🔊 Your selfmute has ended and I've unmuted you. Welcome back!`,
            },
            reason,
        );

        return {
            isSuccessful: true,
        };
    }

    validateArgs(_: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }
}
