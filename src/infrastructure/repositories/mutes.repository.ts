import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { Role, User } from 'discord.js';
import { inject, injectable } from 'inversify';
import * as moment from 'moment';
import { Schema, model } from 'mongoose';

@injectable()
export class MutesRepository {
    private memberService: MemberService;

    constructor(@inject(TYPES.MemberService) memberService: MemberService) {
        this.memberService = memberService;
    }

    public async createMute(subject: User, actor: User, endsAt: Date, roles: Role[]) {
        const selfMuteInstance = new MutesModelInstance({
            subjectId: subject.id,
            actorId: actor.id,
            createdAt: moment().toDate(),
            endsAt: endsAt,
            roleIds: roles.map((r) => r.id),
        });
        await selfMuteInstance.save();
    }

    public async deleteMuteByUserId(userId: string) {
        await MutesModelInstance.findOneAndDelete({ subjectId: userId });
    }

    public async getMuteByUserId(userId: string): Promise<IMutesModel | null> {
        const mute = await MutesModelInstance.findOne({ subjectId: userId }).exec();
        if (!mute) return null;
        return {
            subjectId: mute.subjectId,
            actorId: mute.actorId,
            endsAt: mute.endsAt,
            createdAt: mute.createdAt,
            roleIds: mute.roleIds,
        };
    }

    public async getAllMutes(): Promise<IMutesModel[]> {
        const savedMutes = await MutesModelInstance.find().exec();
        const restoredMutes: IMutesModel[] = [];
        for (const mute of savedMutes) {
            const roles: Role[] = [];
            for (const id of mute.roleIds) {
                const role = await this.memberService.getMemberRoleByRoleId(id);
                if (role) roles.push(role);
            }
            const member = await this.memberService.getGuildMemberFromUserId(mute.subjectId);
            if (!member) continue;
            restoredMutes.push({
                subjectId: member.id,
                actorId: mute.actorId,
                endsAt: mute.endsAt,
                createdAt: mute.createdAt,
                roleIds: roles.map((r) => r.id),
            });
        }
        return restoredMutes;
    }
}

export interface IMutesModel {
    subjectId: string;
    actorId: string;
    createdAt: Date;
    endsAt: Date;
    roleIds: string[];
}

const mutesSchema = new Schema<IMutesModel>(
    {
        subjectId: { type: String, required: true },
        actorId: { type: String, required: true },
        createdAt: { type: Date, required: true },
        endsAt: { type: Date, required: true },
        roleIds: { type: [String], required: true },
    },
    { collection: 'Mutes' }
);

/** The mongoose Model that can be called to access the database collections */
const MutesModelInstance = model<IMutesModel>('Mutes', mutesSchema);
