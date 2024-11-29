import { model, Schema } from 'mongoose';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { MemberService } from '@src/infrastructure/services/member.service';
import { User } from 'discord.js';
import * as moment from 'moment';
import * as Buffer from 'buffer';

@injectable()
export class DiscussionsRepository {
    private memberService: MemberService;
    constructor(@inject(TYPES.MemberService) memberService: MemberService) {
        this.memberService = memberService;
    }

    public async getAllDiscussions() {
        return await DiscussionsModelInstance.find().sort({ addedAt: 'asc' }).exec();
    }

    public async getAllUnusedDiscussions() {
        return await DiscussionsModelInstance.find({
            closedAt: { $exists: false },
            scheduledToCloseAt: { $exists: false },
            threadId: { $exists: false },
        }).exec();
    }

    public async getAllActiveDiscussions() {
        return await DiscussionsModelInstance.find({
            threadId: { $exists: true },
            closedAt: { $exists: false },
        }).exec();
    }

    public async getAllScheduledDiscussions() {
        return await DiscussionsModelInstance.find({ scheduledToCloseAt: { $exists: true } }).exec();
    }

    public async getAllDiscussionTopicsAsFile(topics?: IDiscussionsModel[]) {
        if (!topics) topics = await this.getAllDiscussions();

        if (topics.length == 0) return null;

        let content = '';
        let i = 1;
        const users: { [key: string]: User | null } = {};
        for (const topic of topics) {
            if (!users[topic.addedById]) users[topic.addedById] = await this.memberService.fetchUser(topic.addedById);
            const newLine = `${i}. ${topic.closedAt ? `[used on ${moment(topic.closedAt).format('YYYY-MM-DD')}] ` : ''}${!topic.closedAt && topic.threadId ? `[active] ` : ''}${topic.topic} (by ${users[topic.addedById]?.username ?? 'unknown'} on ${moment(topic.addedAt).format('YYYY-MM-DD')})\n`;
            content += newLine;
            i++;
        }

        return Buffer.Buffer.from(content, 'utf-8');
    }

    public async getDiscussionById(_id: string) {
        return await DiscussionsModelInstance.findOne({ _id: _id }).exec();
    }

    public async getDiscussionByThreadId(threadId: string) {
        return await DiscussionsModelInstance.findOne({ threadId: threadId }).exec();
    }

    public async getRandomDiscussionTopic() {
        const discussions = await this.getAllUnusedDiscussions();
        const now = new Date().getTime();
        const weights = discussions.map((discussion) => now - new Date(discussion.addedAt).getTime());
        const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
        const randomWeight = Math.random() * totalWeight;

        let cumulativeWeight = 0;
        let selectedDiscussion = null;
        for (let i = 0; i < discussions.length; i++) {
            cumulativeWeight += weights[i];
            if (randomWeight <= cumulativeWeight) {
                selectedDiscussion = discussions[i];
                break;
            }
        }

        return selectedDiscussion;
    }

    public async addDiscussionTopic(topic: string, author: User) {
        const flagsInstance = new DiscussionsModelInstance({
            topic: topic,
            addedAt: moment().toDate(),
            addedById: author.id,
        });
        await flagsInstance.save();
    }

    public async removeDiscussionById(_id: string) {
        await DiscussionsModelInstance.deleteOne({ _id: _id }).exec();
    }

    public async closeDiscussionById(_id: string) {
        await DiscussionsModelInstance.updateOne(
            { _id: _id },
            { $set: { closedAt: moment().toDate() }, $unset: { scheduledToCloseAt: '' } }
        ).exec();
    }

    public async removeClosingScheduleForDiscussionById(_id: string) {
        await DiscussionsModelInstance.updateOne({ _id: _id }, { $unset: { scheduledToCloseAt: '' } }).exec();
    }

    public async openDiscussionById(_id: string, date: Date, threadId: string) {
        return await DiscussionsModelInstance.findOneAndUpdate(
            { _id: _id },
            { $set: { scheduledToCloseAt: date, threadId: threadId } },
            { returnDocument: 'after' }
        ).exec();
    }
}

export interface IDiscussionsModel {
    _id: string;
    topic: string;
    addedAt: Date;
    addedById: string;
    openedAt: Date;
    closedAt: Date;
    scheduledToCloseAt: Date;
    threadId: string;
    isActive: boolean;
}

const discussionsSchema = new Schema<IDiscussionsModel>(
    {
        topic: { type: String, required: true },
        addedAt: { type: Date, required: true },
        addedById: { type: String, required: true },
        openedAt: { type: Date, required: false },
        closedAt: { type: Date, required: false },
        scheduledToCloseAt: { type: Date, required: false },
        threadId: { type: String, required: false },
        isActive: { type: Boolean, required: true, default: false },
    },
    { collection: 'Discussions' }
);

/** The mongoose Model that can be called to access the database collections */
const DiscussionsModelInstance = model<IDiscussionsModel>('Discussions', discussionsSchema);
