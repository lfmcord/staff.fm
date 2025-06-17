import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { inject, injectable } from 'inversify';
import { Schema, model } from 'mongoose';

@injectable()
export class BlockedWordsRepository {
    private memberService: MemberService;

    constructor(@inject(TYPES.MemberService) memberService: MemberService) {
        this.memberService = memberService;
    }

    public async addBlockedWords(wordsToAdd: string[]) {
        await BlockedWordsModelInstance.insertMany(wordsToAdd.map((word) => ({ word })));
    }

    public async removeBlockedWords(wordsToDelete: string[]) {
        return (
            await BlockedWordsModelInstance.deleteMany({ word: wordsToDelete.map((word) => word.toLowerCase()) }).exec()
        ).deletedCount;
    }

    public async getAllBlockedWords(): Promise<string[]> {
        const blockedWords = await BlockedWordsModelInstance.find().exec();
        return blockedWords.map((word) => word.word);
    }
}

export interface IBlockedWordsModel {
    word: string;
}

const blockedWordsSchema = new Schema<IBlockedWordsModel>(
    {
        word: { type: String, required: true },
    },
    { collection: 'BlockedWords' }
);

/** The mongoose Model that can be called to access the database collections */
const BlockedWordsModelInstance = model<IBlockedWordsModel>('BlockedWords', blockedWordsSchema);
