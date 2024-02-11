import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import {
    ActionRowBuilder,
    bold,
    ButtonBuilder,
    EmbedBuilder,
    Interaction,
    Message,
    MessageComponentInteraction,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { TYPES } from '@src/types';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { Logger } from 'tslog';
import { TextHelper } from '@src/helpers/text.helper';
import { MemberService } from '@src/infrastructure/services/member.service';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { StaffMailModeEnum } from '@src/feature/staffmail/models/staff-mail-mode.enum';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { ComponentHelper } from '@src/helpers/component.helper';
import { InteractionIds } from '@src/feature/interactions/models/interaction-ids';
import { StaffMailType } from '@src/feature/staffmail/models/staff-mail-type.enum';

@injectable()
export class StaffMailContactCommand implements ICommand {
    name: string = 'contact';
    description: string = 'Messages a user and opens a new staffmail channel with them.';
    usageHint: string = '<user/id> <message to user>';
    examples: string[] = ['356178941913858049 Hello, we would like to speak to you!'];
    permissionLevel = CommandPermissionLevel.Staff;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;

    private logger: Logger<StaffMailContactCommand>;
    staffMailRepository: StaffMailRepository;
    memberService: MemberService;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<StaffMailContactCommand>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository
    ) {
        this.staffMailRepository = staffMailRepository;
        this.memberService = memberService;
        this.logger = logger;
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const userId = TextHelper.getDiscordUserId(args[0]);
        if (!userId) {
            throw new ValidationError(
                new Error(`Cannot get user ID from string '${args[0]}'`),
                `${args[0]} doesn't seem to be a user mention or a valid user ID.`
            );
        }
        const member = await this.memberService.getGuildMemberFromUserId(userId);
        if (!member) {
            return {
                isSuccessful: false,
                reason: `Cannot find guild member with ID ${userId}`,
                replyToUser: `I cannot find the user <@!${userId}>. Have they left the server?`,
            };
        }
        const staffMail = await this.staffMailRepository.getStaffMailByUserId(userId);
        if (staffMail != null) {
            return {
                isSuccessful: false,
                reason: `Staffmail channel for user ${TextHelper.userLog(member.user)} already exists.`,
                replyToUser: `There is already an open staff mail channel for this user! Please send your message in <#${staffMail.channel?.id}>.`,
            };
        }

        const content = args.slice(1).join(' ');
        const sendButton = ComponentHelper.sendButton(InteractionIds.ContactMemberSend);
        const sendAnonButton = ComponentHelper.sendButton(InteractionIds.ContactMemberSendAnon);
        const cancelButton = ComponentHelper.sendButton(InteractionIds.ContactMemberCancel);
        const response = await message.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`Are you sure you want to send this message?`)
                    .setDescription(`${bold('Recipient:')}\n<@${userId}>\n\n${bold('Content:')}\n${content}`),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents([sendButton, sendAnonButton, cancelButton]),
            ],
        });

        let confirmation: MessageComponentInteraction;
        const collectorFilter = (interaction: Interaction) => interaction.user.id === message.author.id;
        try {
            confirmation = await response.awaitMessageComponent({
                filter: collectorFilter,
                time: 60_000,
            });
        } catch (e) {
            await response.edit({
                content: 'Confirmation not received within 1 minute, cancelling.',
                components: [],
            });
            return {};
        }

        if (confirmation!.customId == 'contact-member-cancel') {
            await response.edit({ content: `You cancelled contacting the member.`, embeds: [], components: [] });
            await confirmation!.reply({ ephemeral: true, content: 'Cancelled.' });
            return {};
        }
        const summary = 'Message from Staff'; // TODO: Make this variable?
        const isAnonymous = false; // TODO: Make this variable?
        const embed = EmbedHelper.getStaffMailUserViewIncomingEmbed(
            member.user,
            isAnonymous,
            content,
            summary,
            StaffMailType.staff
        );
        const messageToUser = await member.send({
            embeds: [embed],
        });
        const newStaffMail = await this.staffMailRepository.createStaffMail(
            member.user,
            StaffMailType.staff,
            StaffMailModeEnum.NAMED,
            summary,
            messageToUser
        );
        await newStaffMail.channel!.send({
            embeds: [
                EmbedHelper.getStaffMailStaffViewNewEmbed(member.user, message.author),
                EmbedHelper.getStaffMailStaffViewIncomingEmbed(message.author, content),
            ],
        });
        await response.edit({
            content: `I've sent the message to the user and created ${newStaffMail.channel}.`,
            embeds: [],
            components: [],
        });

        return {
            isSuccessful: true,
        };
    }

    validateArgs(args: string[]): Promise<void> {
        if (args.length < 2) {
            throw new ValidationError(
                new Error('Not enough arguments supplied for contact command.'),
                'You must supply both a user to contact and the message to send them!'
            );
        }
        if (!TextHelper.isDiscordUser(args[0])) {
            throw new ValidationError(
                new Error(`'${args[0]}' is not a valid discord user mention or ID!`),
                `Your first argument must be either a mention or a user ID.`
            );
        }
        this.logger.trace(args);
        return Promise.resolve();
    }
}
