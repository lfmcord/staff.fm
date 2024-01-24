import {
    CategoryChannel,
    Channel,
    ChannelType,
    Client,
    GuildTextBasedChannel,
    User,
} from 'discord.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { model, Schema } from 'mongoose';
import { StaffMailModeEnum } from '@src/feature/staffmail/models/StaffMailMode.enum';
import { StaffMail } from '@src/feature/staffmail/models/StaffMail';
import { faker } from '@faker-js/faker';
import moment = require('moment');

@injectable()
export class StaffMailRepository {
    private readonly client: Client;
    private staffMailCategoryId: string;
    private readonly guildId: string;

    constructor(
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.GUILD_ID) guildId: string,
        @inject(TYPES.STAFFMAIL_CATEGORY_ID) staffMailCategoryId: string
    ) {
        this.staffMailCategoryId = staffMailCategoryId;
        this.guildId = guildId;
        this.client = client;
    }

    public async getStaffMailByUserId(userId: string): Promise<StaffMail | null> {
        let model = await StaffMailInstanceModel.findOne({ userId: userId }).exec();
        if (!model) return null;
        let channel = await (
            await this.client.guilds.fetch(this.guildId)
        ).channels.fetch(model.channelId);
        if (!channel)
            throw new Error(
                `Guild channel for channel ID '${model.channelId}' could not be found in guild with Guild ID '${this.guildId}'. Are you sure the channel wasn't deleted and I have access to it?`
            );

        return {
            user: await this.client.users.fetch(model.userId),
            channel: channel as GuildTextBasedChannel,
            mode: model.mode.valueOf(),
            createdAt: model.createdAt,
            lastMessageAt: model.lastMessageAt,
        };
    }

    public async createStaffMail(user: User, mode: StaffMailModeEnum): Promise<StaffMail> {
        let channel = await this.createStaffMailChannel(user, mode);
        let now = moment.utc().toDate();

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

    private async createStaffMailChannel(
        user: User,
        mode: StaffMailModeEnum
    ): Promise<GuildTextBasedChannel> {
        let guild = await this.client.guilds.fetch(this.guildId);
        let category = (await guild.channels.fetch(this.staffMailCategoryId)) as CategoryChannel;
        let channelName: string | null = null;
        if (mode === StaffMailModeEnum.ANONYMOUS) {
            // If the user wants to remain anonymous, we generate a random channel name and check for conflicts
            do {
                let randomName = faker.word.adjective({
                    length: { min: 3, max: 15 },
                    strategy: 'closest',
                });
                let generatedChannelName = `anonymous-${randomName}`;
                const channelsInCategory = category.children.cache.find(
                    (c) => c.name == generatedChannelName
                );
                if (!channelsInCategory) channelName = generatedChannelName;
            } while (channelName === null);
        } else {
            channelName = user.username;
        }
        return await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category,
        });
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
