import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { StaffMailType } from '@src/feature/models/staff-mail-type';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { TYPES } from '@src/types';
import {
    ChatInputCommandInteraction,
    EmbedBuilder, InteractionContextType,
    ModalSubmitInteraction,
    SlashCommandBuilder, User,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { ValidationError } from '@src/feature/commands/models/validation-error.model';
import { Constants } from '@models/constants';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { MemberService } from '@src/infrastructure/services/member.service';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { Interactions } from '@src/feature/interactions/models/interactions';

@injectable()
export class StaffMailCreateCommand implements ICommand {
    name: string = 'staffmail';
    description: string = 'Creates a new staff mail message. Only usable in DMs.';
    permissionLevel = CommandPermissionLevel.User;
    definition = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setContexts(InteractionContextType.BotDM)
        .addStringOption((option) =>
            option.setName('category').setDescription('The category of your concern').setRequired(true).addChoices(
                { name: Constants.StaffMailCategories[StaffMailType.Report], value: StaffMailType.Report },
                { name: Constants.StaffMailCategories[StaffMailType.Crowns], value: StaffMailType.Crowns },
                { name: Constants.StaffMailCategories[StaffMailType.Server], value: StaffMailType.Server },
                { name: Constants.StaffMailCategories[StaffMailType.Lastfm], value: StaffMailType.Lastfm },
                { name: Constants.StaffMailCategories[StaffMailType.Other], value: StaffMailType.Other }
            )
        )
        .addStringOption((option) =>
            option.setName('content').setDescription('Add some content to your message')
        )
        .addAttachmentOption((option) =>
            option.setName('attachment').setDescription('Add an attachment to the message')
        )
        .addBooleanOption((option) =>
            option.setName('anonymous').setDescription('Send the message anonymously')
        )

    private logger: Logger<StaffMailCreateCommand>;
    private memberService: MemberService;
    private usersRepository: UsersRepository;
    private loggingService: LoggingService;
    private staffMailRepository: StaffMailRepository;
    private env: Environment;

    constructor(
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.BotLogger) logger: Logger<StaffMailCreateCommand>,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.UsersRepository) usersRepository: UsersRepository,
        @inject(TYPES.ENVIRONMENT) env: Environment
    ) {
        this.memberService = memberService;
        this.usersRepository = usersRepository;
        this.env = env;
        this.loggingService = loggingService;
        this.logger = logger;
        this.staffMailRepository = staffMailRepository;
    }

    public validateArgs(interaction: ChatInputCommandInteraction): Promise<void> {
        if(!interaction.options.getString('content') && !interaction.options.getAttachment('attachment')) {
            throw new ValidationError(`Neither content nor attachment provided.`, `You must provide either content or an attachment for the staff mail message.`);
        }

        // if(!interaction.user.dmChannel?.isSendable()) {
        //     throw new ValidationError(`Cannot send DM to user.`, `I cannot send you a DM. Please check your privacy settings and try again.`);
        // }

        return Promise.resolve();
    }

    public async run(interaction: ChatInputCommandInteraction): Promise<CommandResult> {
        this.logger.info(`New staff mail message received.`);
        const category = interaction.options.getString('category')!;
        const text = interaction.options.getString('content') ?? '';
        const isAnonymous = interaction.options.getBoolean('anonymous') ?? false;
        return await this.createNewStaffMail(category, text, isAnonymous, interaction.user);
    }

    async runInteraction(interaction: ModalSubmitInteraction) {
        this.logger.info(`New staff mail create interaction received.`);

        if(!interaction.user.dmChannel?.isSendable()) {
            await interaction.editReply({ content: `I cannot send you a DM. Please check your privacy settings and try again.`});
            return;
        }

        const category = interaction.fields.getTextInputValue(Interactions.StaffMail.CreateModal.Category) ?? StaffMailType.Report;
        const content = interaction.fields.getTextInputValue(Interactions.StaffMail.CreateModal.Content);
        const attachments = interaction.fields.getUploadedFiles(Interactions.StaffMail.CreateModal.Attachment);
        const isAnonymous = interaction.customId.includes("anon");
        const mode = isAnonymous ? StaffMailModeEnum.ANONYMOUS : StaffMailModeEnum.NAMED;
        await this.createNewStaffMail(category, content, isAnonymous, interaction.user);
        await interaction.editReply({
            content: `I've created a new staff mail message for you. You can view it in your DMs and send follow-up messages there.`,
        })
    }

    private async createNewStaffMail(category: StaffMailType, text: string, isAnonymous: boolean, actor: User): Promise<CommandResult> {
        const mode = isAnonymous ? StaffMailModeEnum.ANONYMOUS : StaffMailModeEnum.NAMED;
        const humanReadableCategory = EmbedHelper.getHumanReadableStaffMailType(category);

        this.logger.debug(`Interaction is of category ${category} and mode ${mode}. Creating StaffMail...`);
        const staffMailChannel = await this.staffMailRepository.createStaffMailChannel(actor, mode);

        let rolePings = '';
        this.env.STAFFMAIL.PING_ROLE_IDS.forEach((id) => (rolePings += `<@&${id}> `));
        const embeds: EmbedBuilder[] = [];
        const member = await this.memberService.getGuildMemberFromUserId(actor.id);
        const roles = await this.memberService.getRolesFromGuildMember(member!);
        embeds.push(
            EmbedHelper.getStaffMailStaffViewNewEmbed(
                isAnonymous ? null : member,
                isAnonymous ? null : actor,
                category,
                roles
            )
        );

        if (!isAnonymous) {
            // Attach information about user
            const indexedUser = await this.usersRepository.getUserByUserId(actor.id);
            embeds.push(EmbedHelper.getDiscordMemberEmbed(actor.id, member ?? undefined));
            embeds.push(EmbedHelper.getVerificationHistoryEmbed(indexedUser?.verifications ?? []));
            embeds.push(EmbedHelper.getCrownsEmbed(indexedUser ?? undefined));
        }

        await staffMailChannel!.send({
            content: `${rolePings} New StaffMail: ${humanReadableCategory}`,
            embeds: embeds,
        });

        await staffMailChannel!.send({
            embeds: [EmbedHelper.getStaffMailStaffViewIncomingEmbed(isAnonymous ? null : actor, text)],
        });

        this.logger.debug(`StaffMail channel is set up. Sending response to user...`);
        const openedStaffMailMessage = await actor.send({
            components: [],
            embeds: [EmbedHelper.getStaffMailOpenEmbed(false), EmbedHelper.getStaffMailUserViewOutgoingEmbed(
                actor,
                mode === StaffMailModeEnum.ANONYMOUS,
                text,
                category
            ),],
        });
        await this.staffMailRepository.createStaffMail(actor, category, mode, staffMailChannel);

        await this.loggingService.logStaffMailOpen(
            category,
            isAnonymous ? null : actor,
            isAnonymous ? null : actor,
        );
        return {
            isSuccessful: true,
            replyToUser: {
                content: `I've created a new staff mail message for you. You can view it in your DMs and send follow-up messages there: ${openedStaffMailMessage?.url}`,
            }
        };
    }
}
