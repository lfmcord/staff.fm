import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { bold, EmbedBuilder, inlineCode, Message, MessageCreateOptions } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { MuteRndRepository } from '@src/infrastructure/repositories/mute-rnd.repository';
import { TYPES } from '@src/types';
import moment = require('moment');
import { MemberService } from '@src/infrastructure/services/member.service';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { Logger } from 'tslog';
import { TextHelper } from '@src/helpers/text.helper';
import { Environment } from '@models/environment';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';

@injectable()
export class MuteRndCommand implements ICommand {
    name: string = 'muternd';
    description: string =
        'Mutegame! Mutegame! Chooses a very special member to be muted for a random duration. Opt in or out by adding "optin" or "optout to the command.';
    usageHint: string = '[optin/optout/leaderboard]';
    examples: string[] = ['', 'optin', 'optout'];
    validArguments: (string | undefined)[] = [undefined, 'optin', 'optout', 'leaderboard'];
    permissionLevel = CommandPermissionLevel.Moderator;
    aliases = ['mutegame'];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<MuteRndCommand>;
    scheduleService: ScheduleService;
    private env: Environment;
    private memberService: MemberService;
    private muteRndRepository: MuteRndRepository;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<MuteRndCommand>,
        @inject(TYPES.MuteRndRepository) muteRndRepository: MuteRndRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.ScheduleService) scheduleService: ScheduleService
    ) {
        this.scheduleService = scheduleService;
        this.env = env;
        this.logger = logger;
        this.memberService = memberService;
        this.muteRndRepository = muteRndRepository;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        let reply: MessageCreateOptions;
        switch (args[0]) {
            case 'optin':
                reply = await this.optIn(message);
                break;
            case 'optout':
                reply = await this.optOut(message);
                break;
            case 'leaderboard':
                reply = await this.leaderboard(message);
                break;
            case undefined:
                reply = await this.start(message);
                break;
            default:
                reply = { content: `I have no idea what went wrong, but something did. Whoopsie!` };
        }

        await message.channel.send(reply);
        return {
            isSuccessful: true,
        };
    }

    private async optIn(message: Message): Promise<MessageCreateOptions> {
        this.logger.debug(`Trying to opt in user...`);
        if ((await this.muteRndRepository.getUser(message.author!))?.isActive)
            throw new ValidationError(
                `${TextHelper.userLog(message.author)} is already present in the database. Nothing to do.`,
                `You're already opted in!`
            );
        else {
            await this.muteRndRepository.addUser(message.author!);
            const count = await this.muteRndRepository.getOptedInUsersCount();
            return {
                content:
                    `🎉 You've opted in for the mute game! There are currently ${count - 1} others playing the mute game. ` +
                    `That gives you a ${((1 / count) * 100).toFixed(0)}% chance of being the (un)lucky one! Wowee!`,
            };
        }
    }

    private async optOut(message: Message): Promise<MessageCreateOptions> {
        this.logger.debug(`Trying to opt out user...`);
        const wasSetInactive = await this.muteRndRepository.removeUser(message.author!);
        if (!wasSetInactive)
            return {
                content: `You weren't even opted in for the mute game in the first place. Now you're double safe!`,
            };
        else return { content: `You've opted out of the mute game. You're safe... Or are you? 😈` };
    }

    private async start(message: Message): Promise<MessageCreateOptions> {
        this.logger.debug(`Starting mute game...`);
        const players = await this.muteRndRepository.getOptedInUsers();
        if (players.length === 0)
            return {
                content: `:disappointed: Nobody is playing the mute game at the moment. Opt in with ${inlineCode(this.env.CORE.PREFIX + this.name + ' ' + 'optin')}!`,
            };

        this.logger.debug(`Found ${players.length} players. Preparing random player...`);
        const randomPlayer = players[Math.floor(Math.random() * (players.length - 1))];
        const randomDurationInSeconds = Math.floor(Math.random() * 60);
        await message.channel.send(`Uh-oh! Looks like it's mute game time!`);

        this.logger.debug(`Muting random player ${TextHelper.userLog(randomPlayer.member.user)}...`);
        this.logger.trace(`Random player: ${JSON.stringify(randomPlayer)}`);
        await this.memberService.muteGuildMember(
            randomPlayer.member,
            `🎉🎉 Congratulations! You've won this round of the mute game! You'll be able to celebrate in the server again in ${randomDurationInSeconds} seconds.`
        );
        this.scheduleService.scheduleJob(
            `UNMUTE_${randomPlayer.member.id}`,
            moment().add(randomDurationInSeconds, 'seconds').toDate(),
            async () =>
                await this.memberService.unmuteGuildMember(
                    randomPlayer.member,
                    randomPlayer.member.roles.cache.map((r) => r),
                    `🔊 Your mute game mute has ended and I've unmuted you. Welcome back, go celebrate!`
                )
        );
        await this.muteRndRepository.incrementWinCountForUser(randomPlayer.member.user);
        randomPlayer.winCount++;
        return {
            content:
                `🎉🎉 <@!${randomPlayer.member.id}> has won this round of the mute game! They've been muted for ${randomDurationInSeconds} seconds. ` +
                `That's now ${randomPlayer.winCount} ${TextHelper.pluralize('win', randomPlayer.winCount)} since opting in <t:${moment(randomPlayer.optInDate).unix()}:R>! 🎉🎉`,
        };
    }

    private async leaderboard(message: Message): Promise<MessageCreateOptions> {
        const users = await this.muteRndRepository.getAllUsers();
        if (users.length === 0)
            return { content: `No players yet... Opt in with ${this.env.CORE.PREFIX + this.name + ' ' + 'optin'}!` };
        users.sort((a, b) => (a.winCount > b.winCount ? 1 : -1));
        const authorInLeaderboard = users.find((u) => u.member.id === message.author.id);
        let authorPosition;
        if (authorInLeaderboard) {
            authorPosition = users.indexOf(authorInLeaderboard);
        }

        let description = `### Win Count\n\n`;
        const medals = ['🥇', '🥈', '🥉'];
        let i: number = 0;
        for (const user of users) {
            if (i === 4) break;
            description += `${i + 1}. ${medals[i]} ${authorPosition === i ? bold('YOU!') : ''} ${user.member.user} (${user.winCount} ${TextHelper.pluralize('win', user.winCount)})\n`;
            i++;
        }

        if (authorPosition && authorPosition > 2) {
            description += `${authorPosition + 1}. ${bold('YOU!')} ${authorInLeaderboard!.member.user} (${authorInLeaderboard!.winCount} ${TextHelper.pluralize('win', authorInLeaderboard!.winCount)})\n\n`;
        }

        const embed = new EmbedBuilder()
            .setColor(message.author.accentColor ?? null)
            .setTitle(`🔇 Mute Game Leaderboard`)
            .setTimestamp()
            .setFooter({
                text: `Command executed by @${message.author.username}`,
                iconURL: message.author.avatarURL() ?? '',
            })
            .setDescription(description);

        return { embeds: [embed] };
    }

    validateArgs(args: string[]): Promise<void> {
        if (!this.validArguments.includes(args[0])) {
            throw new ValidationError(
                `'${args[0]}' could not be recognized as a parameter of muternd.`,
                `I can't recognize '${args[0]}' as an argument for this command.`
            );
        }
        return Promise.resolve();
    }

    // TODO: Fix the countdown
    private doSetTimeout(i: number, message: Message) {
        setTimeout(() => {
            message.channel.send(`${i}...`);
        }, 2000);
    }
}
