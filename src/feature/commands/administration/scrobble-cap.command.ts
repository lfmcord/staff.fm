import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { findValueInMap } from '@src/helpers/map.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { IUserModel, UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { ChatInputCommandInteraction, Role, SlashCommandBuilder } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { Logger } from 'tslog';

@injectable()
export class ScrobbleCapCommand implements ICommand {
    name: string = 'scrobblecap';
    description: string = 'Gets, sets or removes a maximum scrobble role cap for a user.';
    permissionLevel = CommandPermissionLevel.Moderator;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('set')
                .setDescription('Sets a scrobble cap')
                .addUserOption((option) => option.setName('user').setDescription('The user to cap').setRequired(true))
                .addRoleOption((option) =>
                    option.setName('role').setDescription('The role to cap the user at (inclusive)').setRequired(true)
                )
                .addStringOption((option) => option.setName('reason').setDescription('An optional reason'))
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('unset')
                .setDescription('Unsets a scrobble cap')
                .addUserOption((option) => option.setName('user').setDescription('The user to uncap').setRequired(true))
                .addStringOption((option) => option.setName('reason').setDescription('An optional reason'))
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('check')
                .setDescription('Checks if a user has a scrobble cap')
                .addUserOption((option) => option.setName('user').setDescription('The user to check').setRequired(true))
        );

    private env: Environment;
    private usersRepository: UsersRepository;
    private loggingService: LoggingService;
    private logger: Logger<ScrobbleCapCommand>;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.BotLogger) logger: Logger<ScrobbleCapCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.env = env;
        this.loggingService = loggingService;
        this.logger = logger;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.description += `\nAvailable scrobble caps are: ${[...this.env.ROLES.SCROBBLE_MILESTONES.keys()].join(',')}.`;
    }

    async validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        if (interaction.options.getSubcommand() == 'set') {
            const roleId = interaction.options.getRole('role')!.id;
            let isMilestone = false;
            for (const value of this.env.ROLES.SCROBBLE_MILESTONES.values()) {
                if (value == roleId) {
                    isMilestone = true;
                    break;
                }
            }
            if (!isMilestone)
                throw new ValidationError(
                    `Role ID ${roleId} is not in scrobble milestones.`,
                    `Please choose a scrobble milestone role.`
                );
        }

        return;
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        const userId = interaction.options.getUser('user')!.id;
        const indexedUser = await this.usersRepository.getUserByUserId(userId);
        if (indexedUser == null) {
            return {
                isSuccessful: false,
                replyToUser: {
                    embeds: [EmbedHelper.getUserNotIndexedEmbed()],
                },
            };
        }

        let result: CommandResult;
        switch (interaction.options.getSubcommand()) {
            case 'set':
                result = await this.setScrobbleCap(
                    indexedUser,
                    interaction,
                    interaction.options.getRole('role')! as Role,
                    interaction.options.getString('reason') ?? undefined
                );
                break;
            case 'unset':
                result = await this.unsetScrobbleCap(
                    indexedUser,
                    interaction,
                    interaction.options.getString('reason') ?? undefined
                );
                break;
            default:
                result = await this.getScrobbleCap(indexedUser);
                break;
        }

        return result;
    }

    async getScrobbleCap(indexedUser: IUserModel): Promise<CommandResult> {
        if (!indexedUser.scrobbleCap)
            return {
                isSuccessful: true,
                replyToUser: { content: `This user has no scrobble cap set.` },
            };
        const scrobbleRoleNumber = findValueInMap(
            this.env.ROLES.SCROBBLE_MILESTONES,
            indexedUser.scrobbleCap.roleId
        ) as number;
        if (!scrobbleRoleNumber) {
            throw new Error(`Scrobble role number not found for role ID ${indexedUser.scrobbleCap!.roleId}.`);
        }
        return {
            isSuccessful: true,
            replyToUser: {
                content: indexedUser.scrobbleCap
                    ? `🚫 <@!${indexedUser.userId}> has a scrobble cap set at ${TextHelper.numberWithCommas(scrobbleRoleNumber)} scrobbles on <t:${moment(indexedUser.scrobbleCap.setOn).unix()}:d> by <@!${indexedUser.scrobbleCap.setBy}>: ${indexedUser.scrobbleCap.reason}.`
                    : 'This user has no scrobble cap set.',
            },
        };
    }

    async setScrobbleCap(
        indexedUser: IUserModel,
        interaction: ChatInputCommandInteraction,
        cap: Role,
        reason?: string
    ): Promise<CommandResult> {
        if (indexedUser.scrobbleCap) {
            return {
                isSuccessful: false,
                replyToUser: {
                    content:
                        `🚫 <@!${indexedUser.userId}> already has a scrobble cap set at <@&${cap.id}> on <t:${moment(indexedUser.scrobbleCap.setOn).unix()}:d> by <@!${indexedUser.scrobbleCap.setBy}>: ${indexedUser.scrobbleCap.reason}.` +
                        `\nPlease unset it first with \`/scrobblecap unset\`.`,
                },
            };
        }

        const discordUser = await this.memberService.fetchUser(indexedUser.userId);
        if (!discordUser)
            return {
                isSuccessful: false,
                replyToUser: { content: `Cannot find user with user ID ${indexedUser.userId}.` },
            };

        this.logger.info(`Setting scrobble cap of user ${indexedUser.userId}.`);
        const roleId = cap.id;
        await this.usersRepository.addScrobbleCapToUser(indexedUser.userId, interaction.user.id, roleId, reason);
        await this.loggingService.logScrobbleCap(discordUser, interaction.user, reason, roleId);

        return {
            isSuccessful: true,
            replyToUser: {
                content:
                    `🚫 I've set the scrobble cap of <@!${indexedUser.userId}> to <@&${cap.id}>.` + reason
                        ? ' Reason: ' + reason
                        : '',
            },
        };
    }

    async unsetScrobbleCap(
        indexedUser: IUserModel,
        interaction: ChatInputCommandInteraction,
        reason?: string
    ): Promise<CommandResult> {
        if (!indexedUser.scrobbleCap) {
            return {
                isSuccessful: false,
                replyToUser: { content: `This user has no scrobble cap set.` },
            };
        }

        const discordUser = await this.memberService.fetchUser(indexedUser.userId);
        if (!discordUser)
            return {
                isSuccessful: false,
                replyToUser: { content: `Cannot find user with user ID ${indexedUser.userId}.` },
            };

        this.logger.info(`Removing scrobble cap from user ${indexedUser.userId}.`);
        await this.usersRepository.removeScrobbleCapFromUser(indexedUser.userId);
        await this.loggingService.logScrobbleCap(discordUser, interaction.user, reason);

        return {
            isSuccessful: true,
            replyToUser: {
                content:
                    `☑️ I've removed the scrobble cap from <@!${indexedUser.userId}>.` + reason
                        ? ' Reason: ' + reason
                        : '',
            },
        };
    }
}
