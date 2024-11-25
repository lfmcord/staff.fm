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

    public async addDiscussionTopic(topic: string, author: User) {
        const flagsInstance = new DiscussionsModelInstance({
            topic: topic,
            addedAt: moment().toDate(),
            addedById: author.id,
        });
        await flagsInstance.save();
    }

    public async getAllDiscussions() {
        return await DiscussionsModelInstance.find().sort({ addedAt: 'asc' }).exec();
    }

    public async getAllDiscussionTopicsAsFile(topics?: IDiscussionsModel[]) {
        if (!topics) topics = await this.getAllDiscussions();

        if (topics.length == 0) return null;

        let content = '';
        let i = 1;
        const users: { [key: string]: User | null } = {};
        for (const topic of topics) {
            if (!users[topic.addedById]) users[topic.addedById] = await this.memberService.fetchUser(topic.addedById);
            const newLine = `${i}. ${moment(topic.addedAt).format('YYYY-MM-DD')}: ${topic.topic} (by ${users[topic.addedById]?.username ?? 'unknown'})\n`;
            content += newLine;
            i++;
        }

        return Buffer.Buffer.from(content, 'utf-8');
    }

    public async getDiscussionById(_id: string) {
        return await DiscussionsModelInstance.findOne({ _id: _id }).exec();
    }

    public async getOldestDiscussionTopic() {
        return await DiscussionsModelInstance.findOne({}, {}, { sort: { addedAt: 'asc' } }).exec();
    }

    public async removeTopicById(_id: string) {
        await DiscussionsModelInstance.deleteOne({ _id: _id }).exec();
    }
}

export interface IDiscussionsModel {
    _id: string;
    topic: string;
    addedAt: Date;
    addedById: string;
}

const discussionsSchema = new Schema<IDiscussionsModel>(
    {
        topic: { type: String, required: true },
        addedAt: { type: Date, required: true },
        addedById: { type: String, required: true },
    },
    { collection: 'Discussions' }
);

/** The mongoose Model that can be called to access the database collections */
const DiscussionsModelInstance = model<IDiscussionsModel>('Discussions', discussionsSchema);
