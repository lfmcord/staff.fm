import { model, Schema } from 'mongoose';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { MemberService } from '@src/infrastructure/services/member.service';
import { Flag } from '@src/feature/commands/moderation/models/flag.model';
import { User } from 'discord.js';

@injectable()
export class FlagsRepository {
    private memberService: MemberService;
    constructor(@inject(TYPES.MemberService) memberService: MemberService) {
        this.memberService = memberService;
    }
    public async addFlag(flag: Flag) {
        const flagsInstance = new FlagsModelInstance({
            term: flag.term,
            reason: flag.reason,
            createdAt: flag.createdAt,
            createdById: flag.createdBy instanceof User ? flag.createdBy.id : flag.createdBy,
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
            createdBy: (await this.memberService.getGuildMemberFromUserId(flag.createdById))?.user ?? flag.createdById,
        };
    }

    public async getAllFlags(): Promise<Flag[]> {
        const flags = await FlagsModelInstance.find().exec();
        return await Promise.all(
            flags.map(async (flag) => {
                return {
                    term: flag.term,
                    reason: flag.reason,
                    createdAt: flag.createdAt,
                    createdBy:
                        (await this.memberService.getGuildMemberFromUserId(flag.createdById))?.user ?? flag.createdById,
                };
            })
        );
    }

    public async getFlagsByTerms(terms: string[]): Promise<Flag[]> {
        const entries = await FlagsModelInstance.find({ term: { $in: terms } }).exec();
        return await Promise.all(
            entries.map(async (e) => {
                return {
                    term: e.term,
                    reason: e.reason,
                    createdAt: e.createdAt,
                    createdBy:
                        (await this.memberService.getGuildMemberFromUserId(e.createdById))?.user ?? e.createdById,
                };
            })
        );
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
