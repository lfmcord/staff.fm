import { model, Schema } from 'mongoose';
import { User } from 'discord.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { MemberService } from '@src/infrastructure/services/member.service';
import * as moment from 'moment';
import { Flag } from '@src/feature/commands/moderation/models/flag.model';

@injectable()
export class FlagsRepository {
    private memberService: MemberService;
    constructor(@inject(TYPES.MemberService) memberService: MemberService) {
        this.memberService = memberService;
    }
    public async addFlag(term: string, reason: string, author: User) {
        const flagsInstance = new FlagsModelInstance({
            term: term,
            reason: reason,
            createdAt: moment.utc().toDate(),
            createdById: author.id,
        });
        await flagsInstance.save();
    }

    public async deleteFlagsByTerms(termsToDelete: string[]) {
        return (await FlagsModelInstance.deleteMany({ term: termsToDelete }).exec()).deletedCount;
    }

    public async getFlagByTerm(term: string): Promise<Flag | null> {
        const flag = await FlagsModelInstance.findOne({ term: term }).exec();
        if (!flag) return null;
        return {
            term: flag.term,
            reason: flag.reason,
            createdAt: flag.createdAt,
            createdById: flag.createdById,
        };
    }

    public async getAllFlags() {
        return await FlagsModelInstance.find().exec();
    }
}

export interface IFlagsModel {
    term: string;
    reason: string;
    createdAt: Date;
    createdById: string;
}

const flagsSchema = new Schema<IFlagsModel>(
    {
        term: { type: String, required: true },
        reason: { type: String, required: true },
        createdAt: { type: Date, required: true },
        createdById: { type: String, required: true },
    },
    { collection: 'Flags' }
);

/** The mongoose Model that can be called to access the database collections */
const FlagsModelInstance = model<IFlagsModel>('Flags', flagsSchema);
