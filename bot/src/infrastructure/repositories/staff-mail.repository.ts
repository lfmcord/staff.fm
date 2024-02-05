import { GuildTextBasedChannel, User } from 'discord.js';
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

        const channel = await this.channelService.getGuildChannelById(model.channelId);
        if (!channel)
            throw new Error(
                `Guild channel for channel ID '${model.channelId}' could not be found in guild. Are you sure the channel wasn't deleted and I have access to it?`
            );

        const user = (await this.memberService.getGuildMemberFromUserId(model.userId))?.user;
        if (!user) throw Error(`Cannot find user with ID ${userId}`);

        return {
            user: user,
            channel: channel as GuildTextBasedChannel,
            mode: model.mode.valueOf(),
            createdAt: model.createdAt,
            lastMessageAt: model.lastMessageAt,
        };
    }

    public async createStaffMail(user: User, mode: StaffMailModeEnum): Promise<StaffMail> {
        const channel = await this.createStaffMailChannel(user, mode);
        const now = moment.utc().toDate();

        const staffMailInstance = new StaffMailInstanceModel({
            channelId: channel.id,
            userId: user.id, // TODO: encrypt when anonymous
            mode: mode.valueOf(),
            createdAt: now,
            lastMessageAt: now,
        });
        await staffMailInstance.save();

        return {
            user: user,
            channel: channel,
            mode: mode,
            createdAt: now,
            lastMessageAt: now,
        };
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
            channelName = user.username;
        }
        return await this.channelService.createGuildTextChannelInCategory(channelName, category);
    }
}

export interface IStaffMailModel {
    channelId: string;
    userId: string;
    mode: StaffMailModeEnum;
    createdAt: Date;
    lastMessageAt: Date;
}

const staffMailSchema = new Schema<IStaffMailModel>(
    {
        channelId: { type: String, required: true },
        userId: { type: String, required: true },
        mode: { type: Number, required: true },
        createdAt: { type: Date, required: true },
        lastMessageAt: { type: Date, required: true },
    },
    { collection: 'StaffMails' }
);

/** The mongoose Model that can be called to access the database collections */
const StaffMailInstanceModel = model<IStaffMailModel>('StaffMails', staffMailSchema);
