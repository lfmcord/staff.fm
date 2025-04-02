import { Verification } from '@src/feature/commands/administration/models/verification.model';
import { User } from 'discord.js';
import { injectable } from 'inversify';
import * as moment from 'moment';
import { model, Schema } from 'mongoose';

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
        return user.verifications.sort((a, b) => (a.verifiedOn < b.verifiedOn ? 0 : -1))[0];
    }

    async getScrobbleCapOfUser(userId: string): Promise<IScrobbleCapModel | null> {
        const user = await UsersModelInstance.findOne({ userId: userId }).exec();
        if (!user || !user.scrobbleCap) return null;
        return user.scrobbleCap;
    }

    async getAllStrikesOfUser(userId: string): Promise<IStrikesModel[]> {
        const user = await UsersModelInstance.findOne({ userId: userId }).exec();
        if (!user || !user.strikes) return [];
        return user.strikes;
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

    async addUserWithoutVerification(userId: string) {
        const userInstance = new UsersModelInstance({
            userId: userId,
            verifications: [],
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

    async addScrobbleCapToUser(userId: string, actorId: string, roleId: string, reason: string): Promise<void> {
        await UsersModelInstance.updateOne(
            { userId: userId },
            {
                scrobbleCap: {
                    roleId: roleId,
                    reason: reason,
                    setOn: moment.utc().toDate(),
                    setBy: actorId,
                },
            }
        );
    }

    async addStrikeToUser(
        subject: User,
        actor: User,
        reason: string,
        expiryInMonths: number,
        logMesssageLink?: string
    ): Promise<string> {
        const now = moment();
        const result = await UsersModelInstance.updateOne(
            { userId: subject.id },
            {
                $push: {
                    strikes: {
                        userId: subject.id,
                        reason: reason,
                        createdAt: now.toDate(),
                        expiresOn: now.add(expiryInMonths, 'months').toDate(),
                        createdById: actor.id,
                        wasAppealed: false,
                        strikeLogLink: logMesssageLink,
                    },
                },
            }
        );
        return result.upsertedId ? result.upsertedId.toString() : '';
    }

    async removeCrownsBanFromUser(userId: string): Promise<void> {
        await UsersModelInstance.updateOne(
            { userId: userId },
            {
                crownsBan: null,
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

    async removeVerificationFromUser(userId: string, _id: string) {
        return UsersModelInstance.updateOne({ userId: userId }, { $pull: { verifications: { _id: _id } } });
    }

    async removeScrobbleCapFromUser(userId: string) {
        return UsersModelInstance.updateOne({ userId: userId }, { $unset: { scrobbleCap: 1 } });
    }

    async removeStrikeFromUser(userId: string, strikeId: string): Promise<number> {
        return (
            await UsersModelInstance.updateOne(
                { userId: userId },
                {
                    $pull: {
                        strikes: { _id: strikeId },
                    },
                }
            )
        ).modifiedCount;
    }

    async appealStrike(userId: string, strikeId: string): Promise<IStrikesModel | null> {
        const result = await UsersModelInstance.findOneAndUpdate(
            { userId: userId, 'strikes._id': strikeId },
            {
                $set: {
                    'strikes.$.wasAppealed': true,
                },
            },
            { new: true }
        );
        return result && result.strikes ? result.strikes[0] : null;
    }
}

export interface IVerificationModel {
    _id: string;
    username: string;
    verifiedOn: Date;
    verifiedById: string;
}

export interface ICrownsBanModel {
    reason: string;
    bannedOn: Date;
    bannedById: string;
}

export interface IScrobbleCapModel {
    roleId: string;
    reason: string;
    setOn: Date;
    setBy: string;
}

export interface IStrikesModel {
    _id: string;
    reason: string;
    createdAt: Date;
    expiresOn: Date;
    createdById: string;
    wasAppealed?: boolean;
    strikeLogLink?: string;
}

export interface IUserModel {
    userId: string;
    verifications: IVerificationModel[];
    importsFlagDate: Date;
    crownsBan?: ICrownsBanModel;
    scrobbleCap?: IScrobbleCapModel;
    strikes?: IStrikesModel[];
}

const verificationSchema = new Schema<IVerificationModel>({
    username: { type: String, required: false },
    verifiedOn: { type: Date, required: true },
    verifiedById: { type: String, required: false },
});

const crownsBanSchema = new Schema<ICrownsBanModel>({
    reason: { type: String, required: false },
    bannedOn: { type: Date, required: true },
    bannedById: { type: String, required: true },
});

const scrobbleCapSchema = new Schema<IScrobbleCapModel>({
    roleId: { type: String, required: false },
    reason: { type: String, required: false },
    setOn: { type: Date, required: true },
    setBy: { type: String, required: true },
});

const strikesSchema = new Schema<IStrikesModel>({
    reason: { type: String, required: true },
    createdAt: { type: Date, required: true },
    expiresOn: { type: Date, required: true },
    createdById: { type: String, required: true },
    wasAppealed: { type: Boolean, required: true },
    strikeLogLink: { type: String, required: false },
});

const usersSchema = new Schema<IUserModel>(
    {
        userId: { type: String, required: true },
        verifications: { type: [verificationSchema], required: true },
        importsFlagDate: { type: Date, required: false },
        crownsBan: { type: crownsBanSchema, required: false },
        scrobbleCap: { type: scrobbleCapSchema, required: false },
        strikes: { type: [strikesSchema], required: false },
    },
    { collection: 'Users' }
);

/** The mongoose Model that can be called to access the database collections */
const UsersModelInstance = model<IUserModel>('Users', usersSchema);
