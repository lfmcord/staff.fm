import { model, Schema } from 'mongoose';
import { User } from 'discord.js';
import { inject, injectable } from 'inversify';
import moment = require('moment');
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { MuteRndUser } from '@src/feature/commands/fun/models/mute-rnd-user.model';

@injectable()
export class MuteRndRepository {
    private memberService: MemberService;

    constructor(@inject(TYPES.MemberService) memberService: MemberService) {
        this.memberService = memberService;
    }

    public async getUser(user: User): Promise<MuteRndUser | null> {
        const document = await MuteRndModelInstance.findOne({ userId: user.id }).exec();
        return document ? await this.mapModelToMuteRndUser(document) : null;
    }

    public async addUser(user: User) {
        const result = await MuteRndModelInstance.updateOne({ userId: user.id }, { isActive: true });
        if (result.modifiedCount === 0) {
            const muteRnd = new MuteRndModelInstance({
                userId: user.id,
                optInDate: moment.utc().toDate(),
                isActive: true,
                winCount: 0,
            });
            await muteRnd.save();
        }
    }

    public async removeUser(user: User) {
        const result = await MuteRndModelInstance.updateOne({ userId: user.id }, { isActive: false }).exec();
        return result.modifiedCount === 1;
    }

    public async getOptedInUsersCount() {
        return MuteRndModelInstance.countDocuments();
    }

    public async getOptedInUsers(): Promise<MuteRndUser[]> {
        const optedInUsers = await MuteRndModelInstance.find({ isActive: true }).exec();
        const optedInMembers: MuteRndUser[] = [];
        for (const user of optedInUsers) {
            const muteRnd = await this.mapModelToMuteRndUser(user);
            if (muteRnd) optedInMembers.push(muteRnd);
        }
        return optedInMembers;
    }

    public async getAllUsers(): Promise<MuteRndUser[]> {
        const allUsers = await MuteRndModelInstance.find().exec();
        const allMembers: MuteRndUser[] = [];
        for (const user of allUsers) {
            const muteRnd = await this.mapModelToMuteRndUser(user);
            if (muteRnd) allMembers.push(muteRnd);
        }
        return allMembers;
    }

    public async incrementWinCountForUser(user: User) {
        await MuteRndModelInstance.findOneAndUpdate({ userId: user.id }, { $inc: { winCount: 1 } });
    }

    private async mapModelToMuteRndUser(model: IMuteRndModel): Promise<MuteRndUser | null> {
        const member = await this.memberService.getGuildMemberFromUserId(model.userId);
        if (!member) return null;
        console.log(model);
        return { member: member, optInDate: model.optInDate, isActive: model.isActive, winCount: model.winCount };
    }
}

export interface IMuteRndModel {
    userId: string;
    optInDate: Date;
    isActive: boolean;
    winCount: number;
}

const muteRndSchema = new Schema<IMuteRndModel>(
    {
        userId: { type: String, required: true },
        optInDate: { type: Date, required: true },
        isActive: { type: Boolean, required: true },
        winCount: { type: Number, required: true },
    },
    { collection: 'Mutegame' }
);

/** The mongoose Model that can be called to access the database collections */
const MuteRndModelInstance = model<IMuteRndModel>('Mutegame', muteRndSchema);
