import { model, Schema } from 'mongoose';
import { Role, User } from 'discord.js';
import { inject, injectable } from 'inversify';
import { SelfMute } from '@src/feature/commands/utility/models/self-mute.model';
import { TYPES } from '@src/types';
import { MemberService } from '@src/infrastructure/services/member.service';

@injectable()
export class SelfMutesRepository {
    private memberService: MemberService;

    constructor(@inject(TYPES.MemberService) memberService: MemberService) {
        this.memberService = memberService;
    }

    public async createSelfMute(user: User, createdAt: Date, endsAt: Date, roles: Role[]) {
        const selfMuteInstance = new SelfMutesModelInstance({
            userId: user.id,
            createdAt: createdAt,
            endsAt: endsAt,
            roleIds: roles.map((r) => r.id),
        });
        await selfMuteInstance.save();
    }

    public async deleteSelfMute(selfMute: SelfMute) {
        await SelfMutesModelInstance.findOneAndDelete({ userId: selfMute.member.user.id });
    }

    public async deleteSelfMuteByUserId(userId: string) {
        await SelfMutesModelInstance.findOneAndDelete({ userId: userId });
    }

    public async getAllSelfMutes(): Promise<SelfMute[]> {
        const savedSelfMutes = await SelfMutesModelInstance.find().exec();
        const selfMutes: SelfMute[] = [];
        for (const sm of savedSelfMutes) {
            const roles: Role[] = [];
            for (const id of sm.roleIds) {
                const role = await this.memberService.getMemberRoleByRoleId(id);
                if (role) roles.push(role);
            }
            const member = await this.memberService.getGuildMemberFromUserId(sm.userId);
            if (!member) continue;
            selfMutes.push({
                member: member,
                endsAt: sm.endsAt,
                createdAt: sm.createdAt,
                roles: roles,
            });
        }
        return selfMutes;
    }
}

export interface ISelfMutesModel {
    userId: string;
    createdAt: Date;
    endsAt: Date;
    roleIds: string[];
}

const selfMutesSchema = new Schema<ISelfMutesModel>(
    {
        userId: { type: String, required: true },
        createdAt: { type: Date, required: true },
        endsAt: { type: Date, required: true },
        roleIds: { type: [String], required: true },
    },
    { collection: 'SelfMutes' }
);

/** The mongoose Model that can be called to access the database collections */
const SelfMutesModelInstance = model<ISelfMutesModel>('SelfMutes', selfMutesSchema);
