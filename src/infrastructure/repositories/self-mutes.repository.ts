import { model, Schema } from 'mongoose';
import { Role, User } from 'discord.js';
import { injectable } from 'inversify';
import { SelfMute } from '@src/feature/commands/utility/models/self-mute.model';

@injectable()
export class SelfMutesRepository {
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
