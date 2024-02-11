import { GuildTextBasedChannel, Message, User } from 'discord.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { model, Schema } from 'mongoose';
import { StaffMailModeEnum } from '@src/feature/staffmail/models/staff-mail-mode.enum';
import { StaffMail } from '@src/feature/staffmail/models/staff-mail.model';
import { faker } from '@faker-js/faker';
import moment = require('moment');
import { ChannelService } from '@src/infrastructure/services/channel.service';
import { MemberService } from '@src/infrastructure/services/member.service';

@injectable()
export class StaffMailRepository {
    private staffMailCategoryId: string;
    private channelService: ChannelService;
    private memberService: MemberService;

    constructor(
        @inject(TYPES.STAFFMAIL_CATEGORY_ID) staffMailCategoryId: string,
        @inject(TYPES.ChannelService) channelService: ChannelService,
        @inject(TYPES.MemberService) memberService: MemberService
    ) {
        this.memberService = memberService;
        this.channelService = channelService;
        this.staffMailCategoryId = staffMailCategoryId;
    }

    public async getStaffMailByUserId(userId: string): Promise<StaffMail | null> {
        const model = await StaffMailInstanceModel.findOne({ userId: userId }).exec();
        if (!model) return null;
        return await this.mapModelToStaffMail(model);
    }

    public async getStaffMailByChannelId(channelId: string): Promise<StaffMail | null> {
        const model = await StaffMailInstanceModel.findOne({ channelId: channelId }).exec();
        if (!model) return null;
        return await this.mapModelToStaffMail(model);
    }

    public async getStaffMailByLastMessageId(messageId: string): Promise<StaffMail | null> {
        const model = await StaffMailInstanceModel.findOne({ lastMessageId: messageId }).exec();
        if (!model) return null;
        return await this.mapModelToStaffMail(model);
    }

    public async createStaffMail(
        user: User,
        type: string,
        mode: StaffMailModeEnum,
        summary: string | null,
        lastMessage: Message
    ): Promise<StaffMail> {
        const channel = await this.createStaffMailChannel(user, mode);
        const now = moment.utc().toDate();

        const staffMailInstance = new StaffMailInstanceModel({
            channelId: channel.id,
            userId: user.id, // TODO: encrypt when anonymous
            mode: mode.valueOf(),
            type: type.valueOf(),
            summary: summary,
            createdAt: now,
            lastMessageAt: now,
            lastMessageId: lastMessage.id,
        });
        await staffMailInstance.save();

        return {
            id: staffMailInstance._id,
            user: user,
            userId: user.id,
            channel: channel,
            mode: mode,
            type: type,
            summary: summary,
            createdAt: now,
            lastMessageAt: now,
            lastMessageId: lastMessage.id,
        };
    }

    public async deleteStaffMail(channelId: string): Promise<StaffMail | null> {
        const deletedStaffMail = await StaffMailInstanceModel.findOneAndDelete({ channelId: channelId }).exec();
        if (!deletedStaffMail) {
            return null;
        }
        await this.deleteStaffMailChannel(channelId);
        return await this.mapModelToStaffMail(deletedStaffMail);
    }

    public async updateStaffMailLastMessageId(staffMailId: string, newLastMessageId: string) {
        const result = await StaffMailInstanceModel.updateOne(
            { _id: staffMailId },
            { lastMessageId: newLastMessageId, lastMessageAt: moment.utc().toDate() }
        ).exec();
        if (result.modifiedCount !== 1)
            throw Error(
                `Update count for updating staffMail with ID ${staffMailId} to new message ID ${newLastMessageId} went wrong.`
            );
    }

    private async createStaffMailChannel(user: User, mode: StaffMailModeEnum): Promise<GuildTextBasedChannel> {
        const category = await this.channelService.getGuildCategoryById(this.staffMailCategoryId);
        if (!category) throw Error(`Cannot find staff mail category with ID ${this.staffMailCategoryId}`);
        let channelName: string | null = null;
        if (mode === StaffMailModeEnum.ANONYMOUS) {
            // If the user wants to remain anonymous, we generate a random channel name and check for conflicts
            do {
                const randomName = faker.word.adjective({
                    length: { min: 3, max: 15 },
                    strategy: 'closest',
                });
                const generatedChannelName = `anonymous-${randomName}`;
                const channelsInCategory = await this.channelService.findGuildChannelInCategory(
                    category,
                    generatedChannelName
                );
                if (!channelsInCategory) channelName = generatedChannelName;
            } while (channelName === null);
        } else {
            channelName = user.username + '-' + faker.string.hexadecimal({ length: 4, casing: 'lower', prefix: '' });
        }
        return await this.channelService.createGuildTextChannelInCategory(channelName, category);
    }

    private async deleteStaffMailChannel(channelId: string) {
        const channelToDelete = await this.channelService.getGuildChannelById(channelId);
        if (!channelToDelete) throw Error(`Cannot delete channel with ID ID ${channelId}`);
        await channelToDelete.delete(`StaffMail closed.`);
    }
    private async mapModelToStaffMail(model: IStaffMailModel): Promise<StaffMail> {
        const channel = await this.channelService.getGuildChannelById(model.channelId);
        const user = (await this.memberService.getGuildMemberFromUserId(model.userId))?.user;

        return {
            id: model._id,
            user: user ?? null,
            userId: model.userId,
            channel: channel as GuildTextBasedChannel | null,
            mode: model.mode.valueOf(),
            type: model.type,
            summary: model.summary,
            createdAt: model.createdAt,
            lastMessageAt: model.lastMessageAt,
            lastMessageId: model.lastMessageId,
        };
    }
}

export interface IStaffMailModel {
    _id: string;
    channelId: string;
    userId: string;
    mode: StaffMailModeEnum;
    type: string;
    summary: string | null;
    createdAt: Date;
    lastMessageAt: Date;
    lastMessageId: string;
}

const staffMailSchema = new Schema<IStaffMailModel>(
    {
        channelId: { type: String, required: true },
        userId: { type: String, required: true },
        mode: { type: Number, required: true },
        type: { type: String, required: true },
        summary: { type: String, required: false },
        createdAt: { type: Date, required: true },
        lastMessageAt: { type: Date, required: true },
        lastMessageId: { type: String, required: true },
    },
    { collection: 'StaffMails' }
);

/** The mongoose Model that can be called to access the database collections */
const StaffMailInstanceModel = model<IStaffMailModel>('StaffMails', staffMailSchema);
