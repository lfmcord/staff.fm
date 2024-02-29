import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { AttachmentBuilder, GuildTextBasedChannel, Message, PartialMessage, User } from 'discord.js';
import { MessageService } from '@src/infrastructure/services/message.service';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { TextHelper } from '@src/helpers/text.helper';

@injectable()
export class OkBuddyCommand implements ICommand {
    name: string = 'okbuddy';
    description: string = 'Ok buddy, no-one cares. Reply to the unnecessary comment.';
    usageHint: string = '';
    examples: string[] = [''];
    permissionLevel = CommandPermissionLevel.Backstager;
    aliases = ['ok'];
    isUsableInDms = false;
    isUsableInServer = true;

    private messageService: MessageService;

    constructor(@inject(TYPES.MessageService) messageService: MessageService) {
        this.messageService = messageService;
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }

    async run(message: Message | PartialMessage, _: string[]): Promise<CommandResult> {
        if (message.reference == null) {
            return {
                isSuccessful: false,
                replyToUser: `Reply to a message to generate a reply image for it!`,
            };
        }

        const referenceMessage = await this.messageService.getChannelMessageByMessageId(
            message.reference.messageId!,
            message.channel as GuildTextBasedChannel
        );

        if (!referenceMessage) {
            return {
                isSuccessful: false,
                replyToUser: `Looks like you are replying to a message I can't process.`,
            };
        }

        const text = referenceMessage.content;
        if (text === '') {
            if (!referenceMessage) {
                return {
                    isSuccessful: false,
                    replyToUser: `I can only generate this reply for a message that has a text!`,
                };
            }
        }
        const buddy = referenceMessage.author;

        const attachment = await this.drawImage(buddy, text);

        await referenceMessage.reply({ files: [attachment] });

        return {
            isSuccessful: true,
        };
    }

    private async drawImage(user: User, text: string): Promise<AttachmentBuilder> {
        const canvas = createCanvas(757, 1000);
        const context = canvas.getContext('2d');
        const background = await loadImage('https://i.redd.it/z4ppa6kw61t71.jpg');
        context.drawImage(background, 0, 0, canvas.width, canvas.height);
        if (!canvas) throw Error('Could not create canvas.');

        const buddyAvatarUrl = user.avatarURL();

        context.fillStyle = '#000000';
        context.font = '20pt Calibri';
        context.textBaseline = 'middle';
        text = TextHelper.wordWrap(text);

        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (i >= 12) break;
            context.fillText(lines[i], 150, 85 + i * 20);
        }
        context.fill();

        const avatar = await loadImage(buddyAvatarUrl!);
        context.drawImage(avatar, 40, 95, 85, 85);
        context.drawImage(avatar, 55, 412, 85, 85);
        context.drawImage(avatar, 60, 750, 85, 85);

        return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'profile-image.png' });
    }
}
