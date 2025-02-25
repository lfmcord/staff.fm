import { Request, Response } from 'express';
import { inject, injectable } from 'inversify';
import { UsersRepository } from '@src/infrastructure/repositories/users.repository';
import { TYPES } from '@src/types';
import { MemberService } from '@src/infrastructure/services/member.service';
import { ApiError } from '@src/api/models/api-error.model';
import { Logger } from 'tslog';
import { Environment } from '@models/environment';
import LastFM from 'lastfm-typed';
import { LoggingService } from '@src/infrastructure/services/logging.service';

@injectable()
export class UserController {
    logger: Logger<UserController>;
    loggingService: LoggingService;
    lastFmClient: LastFM;
    env: Environment;
    memberService: MemberService;
    userRepository: UsersRepository;

    constructor(
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.UsersRepository) userRepository: UsersRepository,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.ApiLogger) logger: Logger<UserController>,
        @inject(TYPES.LastFmClient) lastFmClient: LastFM,
        @inject(TYPES.LoggingService) loggingService: LoggingService
    ) {
        this.loggingService = loggingService;
        this.lastFmClient = lastFmClient;
        this.env = env;
        this.logger = logger;
        this.memberService = memberService;
        this.userRepository = userRepository;
    }

    async username(request: Request, response: Response) {
        try {
            const member = await this.memberService.getGuildMemberFromUserId(request.body.userId);
            if (!member) throw new ApiError(`User with user ID ${request.body.userId} was not found.`, 409);
            const existingUser = await this.userRepository.getUserByUserId(request.body.userId);

            const whoknowsUser = await this.memberService.getGuildMemberFromUserId(this.env.CORE.WHOKNOWS_USER_ID);
            if (!whoknowsUser) throw new ApiError(`WhoKnows user was not found.`, 409);

            let lastFmUser;
            try {
                lastFmUser = await this.lastFmClient.user.getInfo({ username: request.body.username });
            } catch (e) {
                this.logger.info(`Couldn't find last.fm user for username ${request.body.username}.`);
                throw new ApiError(`Couldn't find last.fm user for username ${request.body.username}.`, 400);
            }

            const verification = {
                isReturningUser: false,
                lastfmUser: request.body.username,
                verifyingUser: whoknowsUser!.user,
                discordAccountCreated: member.user.createdTimestamp,
                verifiedUser: member.user,
                lastfmAccountCreated: lastFmUser.registered,
                verificationMessage: null,
            };
            if (!existingUser) {
                await this.userRepository.addUser(verification);
                this.logger.info(
                    `Added new user based on API request for user ID ${request.body.userId} and username ${request.body.username}`
                );
                await this.loggingService.logVerification(verification);
            } else {
                const latestVerification = await this.userRepository.getLatestVerificationOfUser(member.user.id);
                if (
                    latestVerification &&
                    latestVerification.username.toLowerCase() === request.body.username.toLowerCase()
                ) {
                    this.logger.info(
                        `New username ${request.body.userId} and username ${request.body.username} is already the latest verification`
                    );
                } else {
                    await this.userRepository.addVerificationToUser(verification);
                    this.logger.info(
                        `Added new verification to user based on API request for user ID ${request.body.userId} and username ${request.body.username}`
                    );
                    await this.loggingService.logVerification(verification);
                }
            }
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                this.logger.info(`Request failed with ApiError`, error);
                response.status(error.status).send({ message: error.message });
            } else {
                this.logger.error(`Request failed with unexpected error`, error);
                response.status(500).send({ message: `Something went wrong internally.` });
            }
            return;
        }
        response.status(200).send({});
    }
}
