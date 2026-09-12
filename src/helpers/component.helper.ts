import { Strike } from '@src/feature/commands/moderation/models/strike.model';
import { Interactions } from '@src/feature/interactions/models/interactions';
import { TextHelper } from '@src/helpers/text.helper';
import { IDiscussionsModel } from '@src/infrastructure/repositories/discussions.repository';
import { IUserModel } from '@src/infrastructure/repositories/users.repository';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    FileUploadBuilder,
    LabelBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import * as moment from 'moment';
import { Constants } from '@models/constants';
import { StaffMailType } from '@src/feature/models/staff-mail-type';

export class ComponentHelper {
    public static cancelButton = (customId: string, style: ButtonStyle = ButtonStyle.Danger) =>
        new ButtonBuilder().setCustomId(customId).setLabel('Cancel').setStyle(style);

    public static sendButton = (customId: string) =>
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('Contact Discord Staff')
            .setStyle(ButtonStyle.Success)
            .setEmoji({ name: '✉️' });
    public static sendAnonButton = (customId: string) =>
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('Contact Discord Staff anonymously')
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

    public static staffMailCreateModal = (id: string) => {
        const modal = new ModalBuilder();
        let isAnon = id === Interactions.StaffMail.ContactStaffAnonButton || id === Interactions.StaffMail.SendAnonReportButton;
        let isReport = id === Interactions.StaffMail.SendReportButton || id === Interactions.StaffMail.SendAnonReportButton;

        // ID
        if(isAnon) modal.setCustomId(Interactions.StaffMail.CreateModal.SubmitAnonymous);
        else modal.setCustomId(Interactions.StaffMail.CreateModal.Submit);

        // Title
        if(isReport) {
            if (isAnon) modal.setTitle('Sending an anonymous report');
            else modal.setTitle('Sending a report');
        } else  {
            if (isAnon) modal.setTitle('Contacting staff anonymously');
            else modal.setTitle('Contacting staff');
        }

        // Category select
        const categorySelect = new StringSelectMenuBuilder()
            .setCustomId(Interactions.StaffMail.CreateModal.Category)
            .setPlaceholder('Select a category')
            .setRequired(true)

        if(!isAnon) categorySelect.addOptions(new StringSelectMenuOptionBuilder()
            .setLabel(Constants.StaffMailCategoriesSimple[StaffMailType.Crowns])
            .setDescription('Anything relating to the crowns game, including bans, false crowns, and more.')
            .setEmoji(Constants.Crown)
            .setValue(StaffMailType.Crowns))

        categorySelect.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(Constants.StaffMailCategoriesSimple[StaffMailType.Report])
                .setDescription('Report a user or message breaking a rule.')
                .setEmoji(Constants.Warning)
                .setDefault(isReport)
                .setValue(StaffMailType.Report),
            new StringSelectMenuOptionBuilder()
                .setLabel(Constants.StaffMailCategoriesSimple[StaffMailType.Lastfm])
                .setDescription('Questions about the last.fm website and scrobbling.')
                .setEmoji(Constants.Lastfm)
                .setValue(StaffMailType.Lastfm),
            new StringSelectMenuOptionBuilder()
                .setLabel(Constants.StaffMailCategoriesSimple[StaffMailType.Other])
                .setDescription("Other matters that don't fall under any of the other categories.")
                .setEmoji(Constants.Wildcard)
                .setValue(StaffMailType.Other)
        );
        const categoryComponent = new LabelBuilder()
            .setLabel("What can staff help you with?")
            .setStringSelectMenuComponent(categorySelect);

        // Message input
        const messageInput = new TextInputBuilder()
            .setCustomId(Interactions.StaffMail.CreateModal.Content)
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(2048)
        const messageComponent = new LabelBuilder()
            .setLabel(isReport ? "What you'd like to report" : "What you'd like to say to staff")
            .setTextInputComponent(messageInput);

        // Attachment input
        const attachmentUpload = new FileUploadBuilder().setCustomId(Interactions.StaffMail.CreateModal.Attachment).setRequired(false);
        const attachmentComponent = new LabelBuilder()
            .setLabel('Attachments (optional)')
            .setDescription('Optional images or files to attach to your concern. You can upload multiple files.')
            .setFileUploadComponent(attachmentUpload);

        // End
        modal.addLabelComponents(categoryComponent, messageComponent, attachmentComponent)

        if (isAnon) {
            const anonComponent = new TextDisplayBuilder()
                .setContent('This message will be sent anonymously to the staff team. Your identity will not be revealed.');
            modal.addTextDisplayComponents(anonComponent);
        }

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

    static discussionsMenu(topics: IDiscussionsModel[]) {
        let options = topics.map((t, idx) =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`${idx + 1}. ${t.topic.slice(0, 20)}`)
                .setDescription(`added on ${moment(t.addedAt).format('ddd, MMM Do YYYY, HH:mm')}`)
                .setValue(t._id.toString())
        );
        options = options.slice(0, 25);
        return new StringSelectMenuBuilder()
            .setCustomId('defer-discussions-topic-remove')
            .setPlaceholder('Select the topic to remove')
            .addOptions(options);
    }

    static endSelfmuteButton = () =>
        new ButtonBuilder().setCustomId('defer-end-selfmute').setLabel('End Selfmute').setStyle(ButtonStyle.Secondary);

    static strikeAppealMenu = (strikes: Strike[]) => {
        let options = strikes.map((s, idx) =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`Appeal strike ${idx + 1}`)
                .setDescription(`added on ${moment(s.createdAt).format('ddd, MMM Do YYYY, HH:mm')}`)
                .setValue(`${s.subject.id}_${s._id.toString()}`)
        );
        options = options.slice(0, 25);
        return new StringSelectMenuBuilder()
            .setCustomId('defer-strike-appeal')
            .setPlaceholder('Select the strike to appeal')
            .addOptions(options);
    };

    static strikeRemoveMenu = (strikes: Strike[]) => {
        // sort by date, newest first
        strikes = strikes.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        let options = strikes.map((s, idx) =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`Remove strike ${idx + 1}`)
                .setDescription(`added on ${moment(s.createdAt).format('ddd, MMM Do YYYY, HH:mm')}`)
                .setValue(`${s.subject.id}_${s._id.toString()}`)
        );
        options = options.slice(0, 25);
        return new StringSelectMenuBuilder()
            .setCustomId('defer-strike-remove')
            .setPlaceholder('Select the strike to appeal')
            .addOptions(options);
    };

    static strikeMuteButton = (messageId: string, durationInHours: number) => {
        return new ButtonBuilder()
            .setCustomId(`defer-strike-mute-${messageId}-${durationInHours}`)
            .setEmoji('🔇')
            .setLabel(`Mute (${durationInHours}h)`)
            .setStyle(ButtonStyle.Danger);
    };

    static strikeNoneButton = (messageId: string) => {
        return new ButtonBuilder()
            .setCustomId(`defer-strike-none-${messageId}`)
            .setEmoji('🤷')
            .setLabel(`No action`)
            .setStyle(ButtonStyle.Primary);
    };

    static strikeBanButton = (messageId: string, isAppealable: boolean) => {
        return new ButtonBuilder()
            .setCustomId(`defer-strike-ban-${messageId}-${isAppealable}`)
            .setEmoji('🔨')
            .setLabel(`Ban ${!isAppealable ? '(permanent)' : ''}`)
            .setStyle(isAppealable ? ButtonStyle.Primary : ButtonStyle.Danger);
    };

    static updateScrobblesButton = (userId: string) => {
        return new ButtonBuilder()
            .setCustomId(`defer-update-scrobbles-${userId}`)
            .setEmoji('🔢')
            .setLabel(`Update Scrobble Roles`)
            .setStyle(ButtonStyle.Primary);
    };
}
