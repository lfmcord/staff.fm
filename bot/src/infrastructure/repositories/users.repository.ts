import { model, Schema } from 'mongoose';
import { injectable } from 'inversify';
import * as moment from 'moment';
import { Verification } from '@src/feature/commands/utility/models/verification.model';

@injectable()
export class UsersRepository {
    async addUser(verification: Verification) {
        const userInstance = new UsersModelInstance({
            userId: verification.verifiedMember.id,
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

    async getUserByUserId(userId: string) {
        return await UsersModelInstance.findOne({ userId: userId }).exec();
    }

    async getUsersByLastFmUsername(username: string) {
        return await UsersModelInstance.find({ verifications: { username: username.toLowerCase() } }).exec();
    }

    async addVerificationToUser(verification: Verification) {
        await UsersModelInstance.updateOne(
            { userId: verification.verifiedMember.id },
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
}

export interface IVerificationModel {
    username: string;
    verifiedOn: Date;
    verifiedById: string;
}

const verificationSchema = new Schema<IVerificationModel>({
    username: { type: String, required: false },
    verifiedOn: { type: Date, required: true },
    verifiedById: { type: String, required: false },
});

export interface IUserModel {
    userId: string;
    verifications: IVerificationModel[];
}

const usersSchema = new Schema<IUserModel>(
    {
        userId: { type: String, required: true },
        verifications: { type: [verificationSchema], required: true },
    },
    { collection: 'Users' }
);

/** The mongoose Model that can be called to access the database collections */
const UsersModelInstance = model<IUserModel>('Users', usersSchema);
