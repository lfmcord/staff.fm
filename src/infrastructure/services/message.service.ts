import {
    GuildTextBasedChannel,
    Message,
    MessageCreateOptions,
    MessageReaction,
    TextBasedChannel,
    User,
} from 'discord.js';
import { injectable } from 'inversify';

@injectable()
export class MessageService {
    /**
     * Queries a user via a message that they can react to with emojis.
     * @param queryMessage The message to query the user with.
     * @param author The user to query.
     * @param channel The channel where to query the user.
     * @param emojiOptions The emojis the user can react with.
     * @param doCleanup Whether to delete the query and any related error messages after the answer.
     */
    public async getUserReplyInChannel(
        queryMessage: MessageCreateOptions,
        author: User,
        channel: GuildTextBasedChannel | TextBasedChannel,
        emojiOptions: string[],
        doCleanup: boolean
    ): Promise<string | null> {
        if (!channel.isSendable()) {
            throw new Error(`Channel ${channel.id} is not sendable.`);
        }
        const confirmationMessage = await channel.send(queryMessage);

        for (const emoji of emojiOptions) {
            await confirmationMessage.react(emoji);
        }

        const filter = (reaction: MessageReaction, user: User) => {
            return !!(user.id == author.id && emojiOptions.find((e) => reaction.emoji.name == e));
        };

        let collected;
        try {
            collected = await confirmationMessage.awaitReactions({
                filter,
                max: 1,
                time: 30000,
                errors: ['time'],
            });
        } catch (_) {
            const response = await channel.send(`You took too long to respond!`);
            if (doCleanup) void this.deleteMessages([confirmationMessage, response]);
            return null;
        }

        if (doCleanup) void this.deleteMessages([confirmationMessage]);

        return collected!.first()?.emoji.name ?? null;
    }

    public async getChannelMessageByMessageId(
        messageId: string,
        channel: GuildTextBasedChannel
    ): Promise<Message | null> {
        return await channel.messages.fetch(messageId);
    }

    private async deleteMessages(messagesToDelete: Message[]) {
        setTimeout(() => {
            messagesToDelete.forEach((message) => {
                message.delete();
            });
        }, 10000);
    }
}
