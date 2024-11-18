import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { StaffMailCustomIds } from '@src/feature/interactions/models/staff-mail-custom-ids';
import { TextHelper } from '@src/helpers/text.helper';
import { StaffMailType } from '@src/feature/interactions/models/staff-mail-type';
import { IUserModel } from '@src/infrastructure/repositories/users.repository';
import * as moment from 'moment';

export class ComponentHelper {
    public static cancelButton = (customId: string) =>
        new ButtonBuilder().setCustomId(customId).setLabel('Cancel').setStyle(ButtonStyle.Danger);

    public static sendButton = (customId: string) =>
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('Create Message')
            .setStyle(ButtonStyle.Success)
            .setEmoji({ name: '✉️' });
    public static sendAnonButton = (customId: string) =>
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('Create Anonymous Message')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji({ name: '🕵️' });

    public static reportButton = (customId: string) =>
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('Create Report')
            .setStyle(ButtonStyle.Danger)
            .setEmoji({ name: '⚠️' });
    public static reportAnonButton = (customId: string) =>
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('Create Anonymous Report')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji({ name: '🕵️' });

    public static staffMailCreateMenu = new StringSelectMenuBuilder()
        .setCustomId(StaffMailCustomIds.Category)
        .setPlaceholder(`What can staff help you with?`)
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Reporting a user or message')
                .setDescription('Report a user or a message breaking a rule.')
                .setEmoji('⚠️')
                .setValue(StaffMailType.Report),
            new StringSelectMenuOptionBuilder()
                .setLabel('Crowns Game')
                .setDescription('Support surrounding the crowns game (crowns bans, opting back in, false crowns,...)')
                .setEmoji('👑')
                .setValue(StaffMailType.Crowns),
            new StringSelectMenuOptionBuilder()
                .setLabel('Question/Suggestion about the server')
                .setDescription('Questions or suggestions regarding the Last.fm Discord.')
                .setEmoji('❔')
                .setValue(StaffMailType.Server),
            new StringSelectMenuOptionBuilder()
                .setLabel('Question about Last.fm')
                .setDescription('Questions about the last.fm website and scrobbling.')
                .setEmoji(TextHelper.lastfm)
                .setValue(StaffMailType.Lastfm),
            new StringSelectMenuOptionBuilder()
                .setLabel('Other')
                .setDescription("Other matters that don't fall under any of the other categories.")
                .setEmoji('🃏')
                .setValue(StaffMailType.Other)
        );

    public static staffMailCreateCrownsSubmenu = new StringSelectMenuBuilder()
        .setCustomId(StaffMailType.Crowns)
        .setPlaceholder(`Select your crowns game inquiry`)
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Report crowns game rule violations')
                .setDescription('Report a user who is breaking the crowns game rules.')
                .setEmoji('⚠️')
                .setValue(StaffMailType.CrownsReport),
            new StringSelectMenuOptionBuilder()
                .setLabel('Crowns ban inquiry')
                .setDescription('Why was I banned from the crowns game?')
                .setEmoji('❔')
                .setValue(StaffMailType.CrownsBanInquiry),
            new StringSelectMenuOptionBuilder()
                .setLabel('False/Misspelled crowns')
                .setDescription('Requesting deletion for a false or misspelled crown')
                .setEmoji('❌')
                .setValue(StaffMailType.CrownsFalseCrown),

            new StringSelectMenuOptionBuilder()
                .setLabel('Other')
                .setDescription("Things that don't fit into the other categories")
                .setEmoji('🃏')
                .setValue(StaffMailType.CrownsOther)
        );

    public static staffMailCreateModal = (sendButtonId: string) => {
        const id = sendButtonId + '-submit';

        const modal = new ModalBuilder();
        const modalComponents: TextInputBuilder[] = [];
        modal.setCustomId(id);

        switch (sendButtonId) {
            case StaffMailCustomIds.ReportSendButton:
            case StaffMailCustomIds.InServerReportSendButton:
                modal.setTitle('Sending a report');
                modalComponents.push(
                    new TextInputBuilder()
                        .setCustomId(`${id}-summary`)
                        .setLabel('A short summary about your report')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(64)
                );
                modalComponents.push(
                    new TextInputBuilder()
                        .setCustomId(`${id}-text`)
                        .setLabel("What you'd like to report")
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(2048)
                );
                break;
            case StaffMailCustomIds.ReportSendAnonButton:
            case StaffMailCustomIds.InServerReportSendAnonButton:
                modal.setTitle('Sending an anon report');
                modalComponents.push(
                    new TextInputBuilder()
                        .setCustomId(`${id}-summary`)
                        .setLabel('A short summary about your report')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(64)
                );
                modalComponents.push(
                    new TextInputBuilder()
                        .setCustomId(`${id}-text`)
                        .setLabel("What you'd like to anonymously report")
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(2048)
                );
                break;
            case StaffMailCustomIds.CrownsReportSendButton:
            case StaffMailCustomIds.CrownsBanInquirySendButton:
            case StaffMailCustomIds.CrownsFalseCrownSendButton:
            case StaffMailCustomIds.CrownsOtherSendButton:
                modal.setTitle('Crowns Game inquiry'); // TODO Make variable depending on customid
                modalComponents.push(
                    new TextInputBuilder()
                        .setCustomId(`${id}-text`)
                        .setLabel(`More information about your inquiry`)
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(2048)
                );
                break;
            case StaffMailCustomIds.ServerSendButton:
                modal.setTitle(`Sending a question/suggestion`);
                modalComponents.push(
                    new TextInputBuilder()
                        .setCustomId(`${id}-summary`)
                        .setLabel('A short summary of your question/suggestion')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(64)
                );
                modalComponents.push(
                    new TextInputBuilder()
                        .setCustomId(`${id}-text`)
                        .setLabel('Your question/suggestion')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(2048)
                );
                break;
            case StaffMailCustomIds.LastfmSendButton:
                modal.setTitle(`Sending a question about Last.fm`);
                modalComponents.push(
                    new TextInputBuilder()
                        .setCustomId(`${id}-summary`)
                        .setLabel('A short summary of your question')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(64)
                );
                modalComponents.push(
                    new TextInputBuilder()
                        .setCustomId(`${id}-text`)
                        .setLabel('Your question')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(2048)
                );
                break;
            case StaffMailCustomIds.OtherSendButton:
            case StaffMailCustomIds.OtherSendAnonButton:
                modal.setTitle(`Sending a message to staff`);
                modalComponents.push(
                    new TextInputBuilder()
                        .setCustomId(`${id}-summary`)
                        .setLabel('A short summary of your concern')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(64)
                );
                modalComponents.push(
                    new TextInputBuilder()
                        .setCustomId(`${id}-text`)
                        .setLabel('Your concern')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(2048)
                );
                break;
            case StaffMailCustomIds.UrgentReportSendButton:
            case StaffMailCustomIds.UrgentReportSendAnonButton:
                modal.setTitle('Sending a report');
                modalComponents.push(
                    new TextInputBuilder()
                        .setCustomId(`${id}-text`)
                        .setLabel("What you'd like to report")
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(2048)
                );
                break;
        }

        modalComponents.forEach((c) => modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(c)));
        return modal;
    };

    static verificationMenu(user: IUserModel) {
        let options = user.verifications.map((v, idx) =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`${idx + 1}. ${v.username ?? 'NO LAST.FM ACCOUNT'}`)
                .setDescription(`Verified on ${moment(v.verifiedOn).format('ddd, MMM Do YYYY, HH:mm')}`)
                .setValue(user.userId + '_' + v._id.toString())
        );
        options = options.slice(0, 25);
        return new StringSelectMenuBuilder()
            .setCustomId('defer-verifyremove')
            .setPlaceholder('Select the verification to delete')
            .addOptions(options);
    }

    static zeroPlaycountWarningActions() {
        const dismissButton = new ButtonBuilder()
            .setCustomId(`defer-dismiss-playcount-warning`)
            .setLabel('Dismiss')
            .setStyle(ButtonStyle.Secondary);

        return new ActionRowBuilder<ButtonBuilder>().addComponents(dismissButton);
    }
}
