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
import { ActionRowBuilder, bold, ButtonBuilder, Message, StringSelectMenuBuilder } from 'discord.js';
import { inject, injectable } from 'inversify';

@injectable()
export class StrikeAppealCommand implements ICommand {
    name: string = 'strikeappeal';
    description: string = 'Sets a strike to appealed.';
    usageHint: string = '<user id/mention> <reason>';
    examples: string[] = ['@haiyn resolved together and learned from it :)'];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = ['appealstrike'];
    isUsableInDms = false;
    isUsableInServer = true;

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

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0])!;
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
                replyToUser: `This user does not have any strikes that can be appealed.`,
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

        const reason = args.slice(1).join(' ');
        message.channel.send({
            content: `Which strike do you want to set to appealed with the reason "${reason}"? Please select below. ${bold('This action will inform the affected user!')}`,
            embeds: [EmbedHelper.getStrikesEmbed(activeStrikes)],
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
                    ComponentHelper.strikeAppealMenu(appealableStrikes),
                ]),
                new ActionRowBuilder<ButtonBuilder>().addComponents(ComponentHelper.cancelButton('defer-cancel')),
            ],
        });

        return {};
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length < 2) {
            throw new ValidationError(
                `No args provided for strike.`,
                `You must provide a user ID or mention in addition to a reason!`
            );
        }
        if (TextHelper.getDiscordUserId(args[0]) === null) {
            throw new ValidationError(`Invalid user ID or mention.`, `You must provide a valid user ID or mention!`);
        }
        return Promise.resolve();
    }
}
