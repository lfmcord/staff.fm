import { config } from 'dotenv';
config();
import container from '../inversify.config';
import { Bot } from '../bot';
import { TYPES } from '@src/types';

container.get<Bot>(TYPES.Bot);
