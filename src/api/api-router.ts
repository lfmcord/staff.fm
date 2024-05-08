import { Express, Router } from 'express';
import { UserController } from '@src/api/user.controller';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';
import { TYPES } from '@src/types';
import { IApiRouter } from '@src/api/abstraction/api-router.interface';
import * as express from 'express';

@injectable()
export class ApiRouter implements IApiRouter {
    app: Express;
    port = 8083;
    router: Router;
    userController: UserController;
    logger: Logger<Router>;

    constructor(
        @inject(TYPES.UserController) userController: UserController,
        @inject(TYPES.ApiLogger) logger: Logger<Router>
    ) {
        this.logger = logger;
        this.userController = userController;
        this.router = express.Router();
        this.app = express();
        this.register();
    }

    register() {
        this.router.post('/username', this.userController.username);
    }

    listen() {
        this.app.listen(this.port, () => {
            this.logger.info(`API server listening on port: ${this.port}`);
        });
    }
}
