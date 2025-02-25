import { TYPES } from '@src/types';
import { Bot } from './bot';
import container from './inversify.config';

container.get<Bot>(TYPES.Bot);
