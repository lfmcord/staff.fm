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
import { Message } from 'discord.js';
import { inject, injectable } from 'inversify';

@injectable()
export class StrikesCommand implements ICommand {
    name: string = 'strikes';
    description: string = 'Shows all strikes of a user.';
    usageHint: string = '<user ID/mention>';
    examples: string[] = ['@haiyn'];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = ['showstrikes', 'strikesshow'];
    isUsableInDms = false;
    isUsableInServer = true;

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

    async run(message: Message<true>, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0])!;
        const user = await this.memberService.fetchUser(userId);
        if (!user) {
            return {
                isSuccessful: false,
                replyToUser: `User with ID ${userId} not found.`,
            };
        }

        const member = await this.memberService.getGuildMemberFromUserId(userId);
        const strikes = await this.usersRepository.getAllStrikesOfUser(userId);

        if (strikes.length === 0) {
            return {
                isSuccessful: true,
                replyToUser: `This user has no strikes on record.`,
            };
        }

        const embed = EmbedHelper.getStrikesEmbed(strikes, user);
        if (!member) embed.setDescription(`:warning: Not in this server.\n\n` + embed.data.description);
        await message.channel.send({
            embeds: [embed],
        });

        return {
            isSuccessful: true,
        };
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length === 0) {
            throw new ValidationError(`No args provided for strikes.`, `You must provide a Discord user or ID!`);
        }
        if (!TextHelper.getDiscordUserId(args[0])) {
            throw new ValidationError(`Invalid user ID provided.`, `You must provide a valid Discord user or ID!`);
        }
        return Promise.resolve();
    }
}
