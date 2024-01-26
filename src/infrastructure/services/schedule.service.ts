import { inject, injectable } from 'inversify';
import { Job, RecurrenceRule, rescheduleJob, scheduledJobs, scheduleJob } from 'node-schedule';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';

@injectable()
export class ScheduleService {
    private logger: Logger<ScheduleService>;
    constructor(@inject(TYPES.JobLogger) logger: Logger<ScheduleService>) {
        this.logger = logger;
    }

    public scheduleJob(name: string, date: Date, callback: () => void): void {
        scheduleJob(name, date, callback);
        this.logger.debug(`Scheduled job (${name}) for ${date}`);
    }

    public scheduleRecurringJob(name: string, cron: RecurrenceRule, callback: () => void): void {
        cron.tz = 'Etc/UTC';
        const scheduledJob = scheduleJob(name, cron, callback);
        this.logger.debug(
            `Scheduled recurring job (${name}), next invocation at ${scheduledJob.nextInvocation()}`
        );
    }

    public rescheduleJob(name: string, date: Date): void {
        rescheduleJob(name, date);
        this.logger.debug(`Rescheduled job (${name}) to ${date}.`);
    }

    public getJob(name: string): Job | null {
        return scheduledJobs[name];
    }

    public runJob(name: string): boolean {
        const job = scheduledJobs[name];
        if (!job) {
            this.logger.warn(`Trying to run non-existent job (${name})`);
            return false;
        }
        this.logger.debug(`Running job (${name})...`);
        job.invoke();
        return true;
    }

    public cancelJob(name: string): boolean {
        const job = scheduledJobs[name];
        if (!job) {
            this.logger.warn(`Trying to cancel non-existent job (${name})`);
            return false;
        }
        this.logger.debug(`Cancelling job (${name})...`);
        job.cancel();
        return true;
    }

    public jobExists(name: string): boolean {
        const job = scheduledJobs[name];
        // noinspection RedundantIfStatementJS
        if (!job) return false;
        else return true;
    }
}
