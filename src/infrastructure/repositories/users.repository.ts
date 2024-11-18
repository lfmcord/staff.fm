import { model, Schema } from 'mongoose';
import { injectable } from 'inversify';
import * as moment from 'moment';
import { Verification } from '@src/feature/commands/administration/models/verification.model';

@injectable()
export class UsersRepository {
    async getUserByUserId(userId: string) {
        return await UsersModelInstance.findOne({ userId: userId }).exec();
    }

    async getUsersByLastFmUsername(username: string) {
        return await UsersModelInstance.find({ 'verifications.username': username.toLowerCase() }).exec();
    }

    async getLatestVerificationOfUser(userId: string): Promise<IVerificationModel | null> {
        const user = await UsersModelInstance.findOne({ userId: userId }).exec();
        if (!user || user.verifications.length == 0) return null;
        return user.verifications.sort((a, b) => (a.verifiedOn > b.verifiedOn ? 0 : -1))[0];
    }

    async addUser(verification: Verification) {
        const userInstance = new UsersModelInstance({
            userId: verification.verifiedUser.id,
            verifications: [
                {
                    username: verification.lastfmUser?.name.toLowerCase(),
                    verifiedOn: moment().utc().toDate(),
                    verifiedById: verification.verifyingUser.id,
                },
            ],
        });
        await userInstance.save();
    }

    async addVerificationToUser(verification: Verification) {
        await UsersModelInstance.updateOne(
            { userId: verification.verifiedUser.id },
            {
                $push: {
                    verifications: {
                        username: verification.lastfmUser?.name.toLowerCase(),
                        verifiedOn: moment().utc().toDate(),
                        verifiedById: verification.verifyingUser.id,
                    },
                },
            }
        );
    }

    async addImportsFlagDateToUser(userId: string): Promise<void> {
        const now = moment.utc().toDate();
        await UsersModelInstance.updateOne(
            { userId: userId },
            {
                importsFlagDate: now,
            }
        );
    }

    async removeImportsFlagDateFromUser(userId: string): Promise<void> {
        await UsersModelInstance.updateOne(
            { userId: userId },
            {
                importsFlagDate: null,
            }
        );
    }

    async addCrownBanToUser(actorId: string, subjectId: string, reason?: string): Promise<void> {
        const now = moment.utc().toDate();
        await UsersModelInstance.updateOne(
            { userId: subjectId },
            {
                crownsBan: {
                    reason: reason !== '' ? reason : null,
                    bannedOn: now,
                    bannedById: actorId,
                },
            }
        );
    }

    async removeCrownsBanFromUser(userId: string): Promise<void> {
        await UsersModelInstance.updateOne(
            { userId: userId },
            {
                crownsBan: null,
            }
        );
    }

    async removeVerificationFromUser(userId: string, _id: string) {
        return UsersModelInstance.updateOne({ userId: userId }, { $pull: { verifications: { _id: _id } } });
    }
}

export interface IVerificationModel {
    _id: string;
    username: string;
    verifiedOn: Date;
    verifiedById: string;
}

const verificationSchema = new Schema<IVerificationModel>({
    username: { type: String, required: false },
    verifiedOn: { type: Date, required: true },
    verifiedById: { type: String, required: false },
});

export interface ICrownsBanModel {
    reason: string;
    bannedOn: Date;
    bannedById: string;
}

const crownsBanSchema = new Schema<ICrownsBanModel>({
    reason: { type: String, required: false },
    bannedOn: { type: Date, required: true },
    bannedById: { type: String, required: true },
});

export interface IUserModel {
    userId: string;
    verifications: IVerificationModel[];
    importsFlagDate: Date;
    crownsBan?: ICrownsBanModel;
}

const usersSchema = new Schema<IUserModel>(
    {
        userId: { type: String, required: true },
        verifications: { type: [verificationSchema], required: true },
        importsFlagDate: { type: Date, required: false },
        crownsBan: { type: crownsBanSchema, required: false },
    },
    { collection: 'Users' }
);

/** The mongoose Model that can be called to access the database collections */
const UsersModelInstance = model<IUserModel>('Users', usersSchema);
