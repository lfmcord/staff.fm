import { Environment } from '@models/environment';
import { IModalSubmitInteraction } from '@src/feature/interactions/abstractions/modal-submit-interaction.interface';
import { StaffMailCustomIds } from '@src/feature/interactions/models/staff-mail-custom-ids';
import { StaffMailModeEnum } from '@src/feature/models/staff-mail-mode.enum';
import { EmbedHelper } from '@src/helpers/embed.helper';
import { StaffMailRepository } from '@src/infrastructure/repositories/staff-mail.repository';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { EmbedBuilder, ModalSubmitInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class StaffMailCreateModalSubmitInteraction implements IModalSubmitInteraction {
    customIds = [
        StaffMailCustomIds.ReportSendButton + '-submit',
        StaffMailCustomIds.ReportSendAnonButton + '-submit',
        StaffMailCustomIds.CrownsReportSendButton + '-submit',
        StaffMailCustomIds.CrownsFalseCrownSendButton + '-submit',
        StaffMailCustomIds.CrownsBanInquirySendButton + '-submit',
        StaffMailCustomIds.CrownsOtherSendButton + '-submit',
        StaffMailCustomIds.ServerSendButton + '-submit',
        StaffMailCustomIds.LastfmSendButton + '-submit',
        StaffMailCustomIds.OtherSendButton + '-submit',
        StaffMailCustomIds.OtherSendAnonButton + '-submit',
        StaffMailCustomIds.InServerReportSendAnonButton + '-submit',
        StaffMailCustomIds.InServerReportSendButton + '-submit',
    ];
    logger: Logger<StaffMailCreateModalSubmitInteraction>;
    memberService: MemberService;
    usersRepository: UsersRepository;
    loggingService: LoggingService;
    staffMailRepository: StaffMailRepository;
    env: Environment;

    constructor(
        @inject(TYPES.StaffMailRepository) staffMailRepository: StaffMailRepository,
        @inject(TYPES.BotLogger) logger: Logger<StaffMailCreateModalSubmitInteraction>,
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

    async manage(interaction: ModalSubmitInteraction) {
        if (!interaction.deferred)
            await interaction.deferReply({
                ephemeral: true,
            });

        try {
            await interaction.user.send(`I see you'd like to open a staff mail report. Give me a moment...`);
        } catch (e) {
            this.logger.warn(`Failed to send initial DM to user ${interaction.user.id}`, e);
            await interaction.editReply(
                `I'm sorry, I couldn't send you a DM. Please make sure your DMs are open and try again.`
            );
            return;
        }

        this.logger.debug(`Compiling information to create staff mail from customId ${interaction.customId}`);
        const isCrownsModal = interaction.customId.includes('crowns');
        const isUrgent = interaction.customId.includes('urgent');
        const category = isCrownsModal
            ? interaction.customId.split('-')[4] + '-' + interaction.customId.split('-')[5]
            : interaction.customId.split('-')[4];
        const isAnonymous = interaction.customId.includes('anon');
        const mode = isAnonymous ? StaffMailModeEnum.ANONYMOUS : StaffMailModeEnum.NAMED;
        const humanReadableCategory = EmbedHelper.getHumanReadableStaffMailType(category);

        // crowns and urgent reports don't require a user summary
        const summary = isCrownsModal || isUrgent ? null : interaction.components[0].components[0].value;
        const text =
            isCrownsModal || isUrgent
                ? interaction.components[0].components[0].value
                : interaction.components[1].components[0].value;

        this.logger.debug(`Interaction is of category ${category} and mode ${mode}. Creating StaffMail...`);
        this.logger.trace(`Summary: ${summary}`);
        const staffMailChannel = await this.staffMailRepository.createStaffMailChannel(interaction.user, mode);

        let rolePings = '';
        this.env.STAFFMAIL.PING_ROLE_IDS.forEach((id) => (rolePings += `<@&${id}> `));
        const embeds: EmbedBuilder[] = [];
        embeds.push(
            EmbedHelper.getStaffMailStaffViewNewEmbed(
                isAnonymous ? null : interaction.user,
                isAnonymous ? null : interaction.user,
                category,
                summary,
                this.env.CORE.PREFIX
            )
        );

        if (!isAnonymous) {
            // Attach information about user
            const member = await this.memberService.getGuildMemberFromUserId(interaction.user.id);
            const indexedUser = await this.usersRepository.getUserByUserId(interaction.user.id);
            embeds.push(EmbedHelper.getDiscordMemberEmbed(interaction.user.id, member ?? undefined));
            embeds.push(EmbedHelper.getVerificationHistoryEmbed(indexedUser?.verifications ?? []));
            embeds.push(EmbedHelper.getCrownsEmbed(indexedUser ?? undefined));
        }
        embeds.push(new EmbedBuilder().setTitle(summary).setColor(EmbedHelper.blue));

        await staffMailChannel!.send({
            content: `${rolePings} New StaffMail: ${humanReadableCategory}`,
            embeds: embeds,
        });

        await staffMailChannel!.send({
            embeds: [EmbedHelper.getStaffMailStaffViewIncomingEmbed(isAnonymous ? null : interaction.user, text)],
        });

        this.logger.debug(`StaffMail channel is set up. Sending response to user...`);
        const openedStaffMailMessage = await interaction.user.send({
            components: [],
            embeds: [EmbedHelper.getStaffMailOpenEmbed(false), EmbedHelper.getStaffMailLinkToLatestMessage()],
        });
        const outgoingMessage = await interaction.user.send({
            embeds: [
                EmbedHelper.getStaffMailUserViewOutgoingEmbed(
                    interaction.user,
                    mode === StaffMailModeEnum.ANONYMOUS,
                    text,
                    null,
                    category
                ),
            ],
        });
        await openedStaffMailMessage?.edit({
            embeds: [openedStaffMailMessage?.embeds[0], EmbedHelper.getStaffMailLinkToLatestMessage(outgoingMessage)],
        });
        openedStaffMailMessage?.pin();
        await this.staffMailRepository.createStaffMail(
            interaction.user,
            category,
            mode,
            summary,
            openedStaffMailMessage,
            outgoingMessage,
            staffMailChannel
        );
        if (!interaction.message?.guild) await interaction.message?.delete();
        await interaction.editReply({
            content: `I've successfully sent your report! Staff will get back to you as soon as possible. I've also pinned the message in our direct messages. Check the pins in our DM channel to see all your open StaffMails!`,
        });

        await this.loggingService.logStaffMailEvent(
            true,
            isCrownsModal ? null : summary,
            category,
            mode === StaffMailModeEnum.NAMED ? interaction.user : null,
            mode === StaffMailModeEnum.NAMED ? interaction.user : null,
            null
        );
    }
}
