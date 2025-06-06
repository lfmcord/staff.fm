import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { TextHelper } from '@src/helpers/text.helper';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LastFmService } from '@src/infrastructure/services/lastfm.service';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { ButtonInteraction, GuildMember, Message, PartialMessage } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

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

    constructor(
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.BotLogger) logger: Logger<UpdateCommand>,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.LastFmService) lastFmService: LastFmService
    ) {
        this.env = env;
        this.loggingService = loggingService;
        this.logger = logger;
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.lastFmService = lastFmService;
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

    async runInteraction(interaction: ButtonInteraction) {
        await interaction.message.react(TextHelper.loading);
        if (!interaction.deferred) await interaction.deferUpdate();
        const actor = (await this.memberService.getGuildMemberFromUserId(interaction.user.id))!;
        let result: CommandResult;
        const memberIdToUpdate = TextHelper.getDiscordUserId(interaction.customId.split('-')[3]);
        if (!memberIdToUpdate) {
            this.logger.warn(`Interaction ID ${interaction.customId} is missing a user ID.`);
            await interaction.message.reply('I cannot find a user ID in the custom ID.');
            return;
        }

        if (memberIdToUpdate == actor.id) {
            result = await this.selfUpdate(actor);
        } else {
            result = await this.privilegedUpdate(actor, [memberIdToUpdate]);
        }
        await interaction.message.reactions.removeAll();

        await interaction.message.reply(
            `${interaction.user}, ${result.replyToUser}` ?? 'I did something but I do not know what.'
        );
    }

    async validateArgs(args: string[]): Promise<void> {
        if (args.length > 0) {
            if (!TextHelper.isDiscordUser(args[0]))
                throw new ValidationError('Invalid user ID.', `\`${args[0]}\` is not a valid Discord user ID.`);
        }
    }

    private async privilegedUpdate(member: GuildMember, args: string[]): Promise<CommandResult> {
        const permissionLevel = await this.memberService.getMemberPermissionLevel(member!);
        if (permissionLevel < CommandPermissionLevel.Helper) {
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
                replyToUser: `I cannot find any information on this user. Please index them with \`${this.env.CORE.PREFIX}link ${memberToUpdateId} [last.fm username]\`.`,
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

        const rolesToAssign = this.memberService.getScrobbleRolesToAssign(memberToUpdate!, lastFmUser.playcount);
        if (rolesToAssign.size == 0) {
            return {
                isSuccessful: true,
                replyToUser: `This user is already up-to-date.`,
            };
        }
        for (const role of rolesToAssign.values()) {
            await memberToUpdate!.roles.add(role);
        }

        return {
            isSuccessful: true,
            replyToUser: `I've updated the scrobble roles of <@!${memberToUpdateId}>. Added roles: ${[...rolesToAssign.keys()].join(', ')}`,
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

        const rolesToAssign = this.memberService.getScrobbleRolesToAssign(member, lastFmUser.playcount);
        if (rolesToAssign.size == 0) {
            const nextMilestone = this.memberService.getNextHighestScrobbleRole(lastFmUser.playcount);
            return {
                isSuccessful: true,
                replyToUser: `You already have the highest scrobble role you can get! Check back again once you've reached ${TextHelper.numberWithCommas(nextMilestone[0])} scrobbles.`,
            };
        }

        const currentRoles = this.memberService.getScrobbleRoles(member);
        if (currentRoles.size == 1) {
            await member.roles.remove(currentRoles.values().next().value);
        }
        for (const role of rolesToAssign.values()) {
            await member.roles.add(role);
        }

        const highestReachedMilestone = [...rolesToAssign][rolesToAssign.size - 1];
        let reply = `:tada: I've updated your scrobble roles to ${TextHelper.numberWithCommas(highestReachedMilestone[0])}! `;
        switch (highestReachedMilestone[0]) {
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
}
