import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TextHelper } from '@src/helpers/text.helper';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import {
    bold, ChatInputCommandInteraction,
    Client,
    inlineCode,
    InteractionContextType,
    Message,
    MessageCreateOptions,
    SlashCommandBuilder,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import container from '../../../inversify.config';

@injectable()
export class HelpCommand implements ICommand {
    name: string = 'help';
    description: string = 'Displays all commands of the bot.';
    permissionLevel = CommandPermissionLevel.User;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)

    private client: Client;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.memberService = memberService;
        this.client = client;
    }

    async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        let reply;
        const member = await this.memberService.getGuildMemberFromUserId(interaction.user.id);
        const memberPermissionLevel = await this.memberService.getMemberPermissionLevel(member!);

        let description = '';
        const commands: ICommand[] = container.getAll('Command');
        commands.sort((a, b) => a.name.localeCompare(b.name));

        commands.forEach((command) => {
            if (memberPermissionLevel >= command.permissionLevel && description.length < 3900)
                description += inlineCode('/' + command.name) + `: ${command.description}\n\n`;
        });


        return {
            isSuccessful: true,
            replyToUser: {embeds: [
                    EmbedHelper.getVerboseCommandEmbed(this.client, interaction)
                        .setDescription(
                            (description += `\n\n[Privacy Policy](https://github.com/lfmcord/staff.fm/blob/main/PRIVACY_POLICY.MD)`)
                        )
                        .setTitle('Command Reference')
                ],

            }
        };
    }

    validateArgs(_: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }
}
