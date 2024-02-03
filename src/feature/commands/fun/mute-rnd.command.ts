import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { Message, PartialMessage } from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { MuteRndRepository } from '@src/infrastructure/repositories/mute-rnd.repository';
import { TYPES } from '@src/types';
import moment = require('moment');
import { MemberService } from '@src/infrastructure/services/member.service';

@injectable()
export class MuteRndCommand implements ICommand {
    name: string = 'muternd';
    description: string =
        'Mutegame! Mutegame! Chooses a very special member to be muted for a random duration. Opt in or out by adding "optin" or "optout to the command.';
    usageHint: string = '[optin/optout]';
    memberService: MemberService;
    private muteRndRepository: MuteRndRepository;
    examples: string[] = ['', 'optin', 'optout'];
    permissionLevel = CommandPermissionLevel.User;
    aliases = ['mutegame'];

    constructor(
        @inject(TYPES.MuteRndRepository) muteRndRepository: MuteRndRepository,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.memberService = memberService;
        this.muteRndRepository = muteRndRepository;
    }

    async run(message: Message | PartialMessage, args: string[]): Promise<CommandResult> {
        let reply = '';
        // TODO: Ugly ifesle lookin ass
        // TODO: Implement leaderboard (most wins, oldest members,...) that also shows own position
        if (args[0] === 'optin') {
            if (await this.muteRndRepository.getUser(message.author!)) reply = `You're already opted in!`;
            else {
                await this.muteRndRepository.addUser(message.author!);
                const count = await this.muteRndRepository.getOptedInUsersCount();
                reply = `🎉 You've opted in for the mute game! There are currently ${count - 1} others playing the mute game. That gives you a ${((1 / count) * 100).toFixed(0)}% chance of being the (un)lucky one! Wowee!`;
            }
        } else if (args[0] == 'optout') {
            // TODO: Ask for confirmation that it will delete the win count OR enable/disable in the db
            const wasDeleted = await this.muteRndRepository.removeUser(message.author!);
            if (!wasDeleted)
                reply = `You weren't even opted in for the mute game in the first place. Now you're double safe!`;
            else reply = `You've opted out of the mute game. You're safe... Or are you? 😈`;
        } else {
            const users = await this.muteRndRepository.getOptedInUsers();
            const randomUser = users[Math.floor(Math.random() * (users.length - 1))];
            const randomDurationInSeconds = Math.floor(Math.random() * 60);
            await message.channel.send(`Uh-oh! Looks like it's mute game time!`);
            await message.channel.send(`In 3...`);
            for (let i = 2; i > 0; i--) {
                setTimeout(async () => {
                    await message.channel.send(`${i}...`);
                }, 1000);
            }
            await this.memberService.muteGuildMember(randomUser.member, randomDurationInSeconds);
            await this.muteRndRepository.incrementWinCountForUser(randomUser.member.user);
            await randomUser.member.send(
                `🎉🎉 Congratulations! You've won this round of the mute game! You'll be able to celebrate in the server again in ${randomDurationInSeconds} seconds.`
            );
            reply = `🎉🎉 <@!${randomUser.member.id}> has won this round of the mute game! They've been muted for ${randomDurationInSeconds} seconds. That's now ${randomUser.winCount++} win${randomUser.winCount++ > 1 ? 's' : ''} since opting in <t:${moment(randomUser.optedIn).unix()}:R>! 🎉🎉`;
        }

        // Don't use the replyToUser because it looks ugly
        return {
            isSuccessful: true,
            replyToUser: reply,
        };
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }
}
