import { config } from 'dotenv';
config();
import container from '@src/inversify.config';
import { Bot } from '@src/bot';
import { TYPES } from '@src/types';

container.get<Bot>(TYPES.Bot);
