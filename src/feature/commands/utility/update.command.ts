import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ButtonInteraction, GuildMember, Message, PartialMessage } from 'discord.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { MemberService } from '@src/infrastructure/services/member.service';
import { Logger } from 'tslog';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { Environment } from '@models/environment';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LastFmService } from '@src/infrastructure/services/lastfm.service';
import { CommandService } from '@src/infrastructure/services/command.service';

@injectable()
export class UpdateCommand implements ICommand {
    name: string = 'update';
    description: string =
        "Updates your scrobble role. If you are a privileged user, you can also update other peoples' scrobble roles.";
    usageHint: string = '[(optional) user ID/mention]';
    examples: string[] = ['', '356178941913858049', '@haiyn'];
    permissionLevel = CommandPermissionLevel.Helper;
    aliases = [];
    isUsableInDms = true;
    isUsableInServer = true;

    private usersRepository: UsersRepository;
    private env: Environment;
    private loggingService: LoggingService;
    private logger: Logger<UpdateCommand>;
    private memberService: MemberService;
    private lastFmService: LastFmService;
    private commandService: CommandService;

    constructor(
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.BotLogger) logger: Logger<UpdateCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.LastFmService) lastFmService: LastFmService,
        @inject(TYPES.CommandService) commandService: CommandService
    ) {
        this.env = env;
        this.loggingService = loggingService;
        this.logger = logger;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.lastFmService = lastFmService;
        this.commandService = commandService;
    }

    async runInteraction(interaction: ButtonInteraction) {
        this.logger.info(`New update button interaction`);
        const member = interaction.member;
        if (!member) {
            await interaction.reply(`I can't determine if you are allowed to use this.`);
            return;
        }

        try {
            const result = await this.privilegedUpdate(interaction.member as GuildMember, [
                interaction.customId.split('-')[3],
            ]);
            await interaction.reply(result.replyToUser ?? 'Something happened, but I have no idea what. Oops.');
        } catch (e) {
            if (e instanceof ValidationError) await interaction.reply(e.messageToUser);
            else await interaction.reply(`Teehee... I fucky-uppy! <@${this.env.BOT_OWNER_ID}> pls fixy!! (◕‿◕✿)`);
            return;
        }
    }

    async run(message: Message | PartialMessage, args: string[]): Promise<CommandResult> {
        await message.react(TextHelper.loading);
        const member = (await this.memberService.getGuildMemberFromUserId(message.author!.id))!;
        let result: CommandResult;
        if (args.length >= 1) {
            if (TextHelper.getDiscordUserId(args[0]) == message.author?.id) result = await this.selfUpdate(member);
            else result = await this.privilegedUpdate(member, args);
        } else {
            result = await this.selfUpdate(member);
        }

        await message.reactions.removeAll();

        return result;
    }

    async validateArgs(args: string[]): Promise<void> {
        if (args.length > 0) {
            if (!TextHelper.isDiscordUser(args[0]))
                throw new ValidationError('Invalid user ID.', `\`${args[0]}\` is not a valid Discord user ID.`);
        }
    }

    private async privilegedUpdate(member: GuildMember, args: string[]): Promise<CommandResult> {
        if (!(await this.commandService.isPermittedToRun(member, this))) {
            throw new ValidationError(
                'Insufficient permissions.',
                "You do not have the required permissions to update other users' scrobble roles."
            );
        }

        const memberToUpdateId = TextHelper.getDiscordUserId(args[0])!;
        const memberToUpdate = await this.memberService.getGuildMemberFromUserId(memberToUpdateId);
        if (!member)
            throw new ValidationError(
                `No discord member found for ${memberToUpdateId}`,
                `Cannot find user with user ID ${memberToUpdateId}. Has the user left the guild?`
            );

        const lastFmUser = await this.lastFmService.getLastFmUserByUserId(memberToUpdateId);
        if (lastFmUser === null) {
            return {
                isSuccessful: false,
                replyToUser: `I cannot find any information on this user. Please index them with \`${this.env.PREFIX}link ${memberToUpdateId} [last.fm username]\`.`,
            };
        }
        if (lastFmUser === undefined) {
            const latestUsername = await this.usersRepository.getLatestVerificationOfUser(memberToUpdateId);
            return {
                isSuccessful: false,
                replyToUser: `No last.fm user found for their latest last.fm username \`${latestUsername}\`. Have they changed their username?`,
            };
        }
        if (lastFmUser.playcount == 0) {
            return {
                isSuccessful: false,
                replyToUser: `This user has no scrobbles or last.fm gave me a wrong playcount of 0.`,
            };
        }

        const isAllowed = await this.isAllowedToGetNewRoles(member, lastFmUser.playcount);
        if (!isAllowed) {
            return {
                isSuccessful: false,
                replyToUser: `This user has a scrobble cap and isn't allowed to get a higher role.`,
            };
        }

        const assignedRoles = await this.memberService.updateScrobbleRoles(memberToUpdate!, lastFmUser.playcount);
        if (assignedRoles.length == 0) {
            return {
                isSuccessful: true,
                replyToUser: `This user is already up-to-date.`,
            };
        }

        return {
            isSuccessful: true,
            replyToUser: `I've updated the scrobble roles of <@!${memberToUpdateId}>. Added roles: ${assignedRoles.join(', ')}`,
        };
    }

    private async selfUpdate(member: GuildMember): Promise<CommandResult> {
        const lastFmUser = await this.lastFmService.getLastFmUserByUserId(member.user.id);
        if (lastFmUser === null) {
            return {
                isSuccessful: false,
                replyToUser:
                    `I don't know your Last.fm username yet! ` +
                    `Please login to the WhoKnows bot with \`!login [your last.fm username]\` and try again. ` +
                    `If you're already logged in, please ask to have your roles updated in the <#1147234492533182554> channel.`,
            };
        }
        if (lastFmUser === undefined) {
            const latestUsername = await this.usersRepository.getLatestVerificationOfUser(member.user.id);
            return {
                isSuccessful: false,
                replyToUser:
                    `I can't find any last.fm account for your latest username \`${latestUsername}\`. ` +
                    `Please post your current last.fm username in <#1147234492533182554> to get it updated!`,
            };
        }
        if (lastFmUser.playcount == 0) {
            return {
                isSuccessful: false,
                replyToUser: `It looks like you have no scrobbles yet! Check back once you've reached 1000.\n-# Please try again if this is a mistake.`,
            };
        }

        const isAllowed = await this.isAllowedToGetNewRoles(member, lastFmUser.playcount);
        if (!isAllowed) {
            return {
                isSuccessful: false,
                replyToUser: `It looks like you are not allowed to get a higher scrobble role! If you think this is a mistake, please reach out to staff.`,
            };
        }

        const assignedRoles = await this.memberService.updateScrobbleRoles(member!, lastFmUser.playcount);
        if (assignedRoles.length == 0) {
            const highestMilestone = this.memberService.getHighestScrobbleRoleNumber(member);
            this.logger.trace(`Highest milestone is ${highestMilestone}`);
            const nextIndex = this.env.SCROBBLE_MILESTONE_NUMBERS.indexOf(highestMilestone!) + 1;
            this.logger.trace(`Next index is ${nextIndex}`);
            const nextMilestone = this.env.SCROBBLE_MILESTONE_NUMBERS[nextIndex];
            return {
                isSuccessful: true,
                replyToUser:
                    `Looks like you already have the highest scrobble role you can get! ` +
                    `The next one you can get is at ${nextMilestone} scrobbles. Happy scrobbling! :musical_note:`,
            };
        }

        const highestMilestone = assignedRoles[assignedRoles.length - 1];
        let reply = `:tada: I've updated your scrobble roles to ${TextHelper.numberWithCommas(highestMilestone)}! `;
        switch (highestMilestone) {
            case 10000:
                reply += `10k, congrats! This is just the start of your scrobbling journey! 🎶`;
                break;
            case 50000:
                reply += `50k is no small feat. Amazing work! 🎶`;
                break;
            case 100000:
                reply += `Welcome to the elite 100k club! You’re officially a scrobbling star! :star2:`;
                break;
            case 150000:
                reply += `150k scrobbles? Truly, a scrobblemaster in action. :crown:`;
                break;
            case 200000:
                reply += `Over 200k scrobbles! You’re seriously putting in the hours. Nice work! :fire:`;
                break;
            case 250000:
                reply += `A quarter million scrobbles! You're 25% closer to musical immortality. :trophy:`;
                break;
            case 300000:
                reply += `300k scrobbles and counting? You’ve basically lived a thousand musical lifetimes by now. Keep it up! :rocket:`;
                break;
            case 400000:
                reply += `400k? You're on your way to being a scrobble deity. :pray:`;
                break;
            case 500000:
                reply += `Half a million scrobbles! You're in the exclusive .5M club. Absolutely iconic. 🎵`;
                break;
            default:
                break;
        }

        return {
            isSuccessful: true,
            replyToUser: reply,
        };
    }

    private async isAllowedToGetNewRoles(member: GuildMember, scrobbleCount: number) {
        // TODO: Implement scrobble cap
        return true;
    }
}
