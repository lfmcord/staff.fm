import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { CommandResult } from '@src/feature/commands/models/command-result.model';
import { ICommand } from '@src/feature/commands/models/command.interface';
import { TextHelper } from '@src/helpers/text.helper';
import { LoggingService } from '@src/infrastructure/services/logging.service';
import { MemberService } from '@src/infrastructure/services/member.service';
import { TYPES } from '@src/types';
import { Client, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

@injectable()
export class MigrateVerifiedCommand implements ICommand {
    name: string = 'migrateverified';
    description: string = 'Migrates all users without the Unverified role to add the Verified role.';
    usageHint: string = '';
    examples: string[] = [];
    permissionLevel = CommandPermissionLevel.Administrator;
    aliases = [];
    isUsableInDms = false;
    isUsableInServer = true;

    private loggingService: LoggingService;
    private logger: Logger<MigrateVerifiedCommand>;
    private env: Environment;
    private memberService: MemberService;
    private client: Client;

    constructor(
        @inject(TYPES.BotLogger) logger: Logger<MigrateVerifiedCommand>,
        @inject(TYPES.MemberService) memberService: MemberService,
        @inject(TYPES.LoggingService) loggingService: LoggingService,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.Client) client: Client
    ) {
        this.client = client;
        this.env = env;
        this.loggingService = loggingService;
        this.logger = logger;
        this.memberService = memberService;
    }

    validateArgs(_: string[]): Promise<void> {
        return Promise.resolve();
    }

    async run(message: Message, args: string[]): Promise<CommandResult> {
        const guild = this.client.guilds.cache.get(this.env.CORE.GUILD_ID);
        if (!guild) {
            this.logger.error(`Guild with ID ${this.env.CORE.GUILD_ID} not found.`);
            return {
                isSuccessful: false,
                replyToUser: `The guild could not be found.`,
            };
        }

        const members = await guild.members.fetch();
        const unverifiedRole = guild.roles.cache.get(this.env.ROLES.UNVERIFIED_ROLE_ID);
        if (!unverifiedRole) {
            this.logger.error(`Unverified role with ID ${this.env.ROLES.UNVERIFIED_ROLE_ID} not found.`);
            return {
                isSuccessful: false,
                replyToUser: `The unverified role could not be found.`,
            };
        }

        const verifiedRole = guild.roles.cache.get(this.env.ROLES.VERIFIED_ROLE_ID);
        if (!verifiedRole) {
            this.logger.error(`Verified role with ID ${this.env.ROLES.VERIFIED_ROLE_ID} not found.`);
            return {
                isSuccessful: false,
                replyToUser: `The verified role could not be found.`,
            };
        }

        const membersToMigrate = members.filter((member) => !member.roles.cache.has(unverifiedRole.id));

        const progressMessage = await message.reply(
            `Migrating 0/${membersToMigrate.size} users from Verified to Unverified role...`
        );
        await message.react(TextHelper.loading);

        let migratedCount = 0;
        const updateInterval = setInterval(async () => {
            await progressMessage.edit(
                `Migrating ${migratedCount}/${membersToMigrate.size} users from Verified to Unverified role...`
            );
        }, 10_000);

        for (const member of membersToMigrate.values()) {
            try {
                await member.roles.add(verifiedRole);
                migratedCount++;
                this.logger.debug(`Migrated user ${member.user.username} (${member.id}) to Verified role.`);
            } catch (error) {
                this.logger.error(`Failed to migrate user ${member.user.username} (${member.id}):`, error);
            }
        }

        await message.reactions.removeAll();
        clearInterval(updateInterval);
        await progressMessage.edit(
            `Migration complete: ${migratedCount}/${membersToMigrate.size} users migrated to Verified role.`
        );

        return {
            isSuccessful: true,
        };
    }
}
