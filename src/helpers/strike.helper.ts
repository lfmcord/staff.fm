import { IStrikesModel } from '@src/infrastructure/repositories/users.repository';
import * as moment from 'moment/moment';

export class StrikeHelper {
    static getActiveStrikes(strikes: IStrikesModel[]): IStrikesModel[] {
        return strikes.filter((strike) => strike.expiresOn > moment().toDate() && !strike.wasAppealed);
    }

    static getAppealedStrikes(strikes: IStrikesModel[]) {
        return strikes.filter((strike) => strike.wasAppealed);
    }

    static getExpiredStrikes(strikes: IStrikesModel[]) {
        return strikes.filter((strike) => strike.expiresOn <= moment().toDate());
    }
}
