import { Client, GuildMember, Role, User } from 'discord.js';
import { TYPES } from '@src/types';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import { Environment } from '@models/environment';
import { Logger } from 'tslog';
import { Flag } from '@src/feature/commands/moderation/models/flag.model';

@injectable()
export class MemberService {
    private client: Client;
    scheduleService: ScheduleService;
    logger: Logger<MemberService>;
    env: Environment;

    constructor(
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.ENVIRONMENT) env: Environment,
        @inject(TYPES.ScheduleService) scheduleService: ScheduleService,
        @inject(TYPES.InfrastructureLogger) logger: Logger<MemberService>
    ) {
        this.logger = logger;
        this.env = env;
        this.scheduleService = scheduleService;
        this.client = client;
    }

    // TODO: try catch for operations
    async getGuildMemberFromUserId(userId: string): Promise<GuildMember | null> {
        try {
            const guild = await this.client.guilds.fetch(this.env.GUILD_ID);
            return await guild.members.fetch(userId);
        } catch (e) {
            this.logger.warn(`${userId} is not an ID that belongs to a guild member. Cannot retrieve guild member.`);
            return null;
        }
    }

    async fetchUser(userId: string): Promise<User | null> {
        try {
            return await this.client.users.fetch(userId);
        } catch (e) {
            this.logger.warn(`${userId} is not an ID that belongs to a Discord user. Cannot retrieve user.`);
            return null;
        }
    }

    async getHighestRoleFromGuildMember(guildMember: GuildMember): Promise<Role> {
        return guildMember.roles.highest;
    }

    async getRolesFromGuildMember(guildMember: GuildMember): Promise<Role[]> {
        const roles: Role[] = [];
        guildMember.roles.cache.forEach((r) => roles.push(r));
        return roles;
    }

    async getMemberRoleByRoleId(roleId: string): Promise<Role | null> {
        const guild = await this.client.guilds.fetch(this.env.GUILD_ID);
        return await guild.roles.fetch(roleId);
    }

    async muteGuildMember(member: GuildMember, muteMessage: string, isSelfmute = false): Promise<void> {
        const highestUserRole = await this.getHighestRoleFromGuildMember(member);
        const botMember = await this.getGuildMemberFromUserId(this.client.user!.id);
        const highestBotRole = await this.getHighestRoleFromGuildMember(botMember!);
        const muteRoleId = isSelfmute ? this.env.SELFMUTED_ROLE_ID : this.env.MUTED_ROLE_ID;
        const mutedRole = await (await this.client.guilds.fetch(this.env.GUILD_ID)).roles.fetch(muteRoleId);
        if (highestUserRole.comparePositionTo(highestBotRole) > 0) {
            throw Error(`Cannot mute a member with a role higher than the bot role.`);
        }
        if (!mutedRole) {
            throw Error(`Cannot find muted role with role ID ${muteRoleId}`);
        }
        if (mutedRole!.comparePositionTo(highestBotRole) > 0) {
            throw Error(`Cannot assign the muted role because it is higher than the bot role.`);
        }

        const roles = await this.getRolesFromGuildMember(member);
        roles.forEach((r) => r.comparePositionTo(botMember!.roles.highest));
        await member.roles.add(mutedRole);
        await member.roles.remove(roles);

        try {
            await member.send({ content: muteMessage });
        } catch (e) {
            this.logger.warn(`Could not send mute message to user.`, e);
        }
    }

    async unmuteGuildMember(member: GuildMember, rolesToRestore: Role[], unmuteMessage: string, isSelfmute = false) {
        const mutedRole = isSelfmute ? this.env.SELFMUTED_ROLE_ID : this.env.MUTED_ROLE_ID;
        await member.roles.remove(mutedRole);
        rolesToRestore.forEach((r) => (r.name !== '@everyone' ? member.roles.add(r) : ''));

        try {
            await member.send(unmuteMessage);
        } catch (e) {
            this.logger.warn(`Could not send unmute message to user.`, e);
        }
    }

    async getMemberPermissionLevel(member: GuildMember): Promise<CommandPermissionLevel> {
        const memberHighestRole = await this.getHighestRoleFromGuildMember(member!);
        const permissionLevelRoles = [
            {
                level: CommandPermissionLevel.Administrator,
                roleIds: this.env.ADMIN_ROLE_IDS,
            },
            {
                level: CommandPermissionLevel.Moderator,
                roleIds: this.env.MODERATOR_ROLE_IDS,
            },
            {
                level: CommandPermissionLevel.Helper,
                roleIds: this.env.HELPER_ROLE_IDS,
            },
        ];

        let permissionLevel = CommandPermissionLevel.User;
        let isSet = false;
        for (const permission of permissionLevelRoles) {
            if (isSet) break;
            for (const roleId of permission.roleIds) {
                if (isSet) break;
                if (memberHighestRole.comparePositionTo(roleId) >= 0) {
                    this.logger.trace(`Role ID: ${roleId}: ${memberHighestRole.comparePositionTo(roleId)}`);
                    permissionLevel = permission.level;
                    isSet = true;
                    break;
                }
            }
        }

        // backstage roles dont work with position but only with exact hasRole
        if (permissionLevel <= CommandPermissionLevel.Backstager) {
            const roles = await this.getRolesFromGuildMember(member);
            for (const roleId of this.env.BACKSTAGER_ROLE_IDS) {
                if (roles.find((r) => r.id === roleId)) return CommandPermissionLevel.Backstager;
            }
        }
        return permissionLevel;
    }

    checkIfMemberIsFlagged(flag: Flag, user?: GuildMember | User): boolean {
        if (!user) return false;

        let discordUsername, discordUserId, discordDisplayname, discordServerDisplayname;

        if (user instanceof GuildMember) {
            discordUsername = user.user.username.toLowerCase();
            discordUserId = user.user.id;
            discordDisplayname = user.user.displayName.toLowerCase();
            discordServerDisplayname = user.displayName.toLowerCase();
        } else {
            discordUsername = user.username.toLowerCase();
            discordUserId = user.id;
            discordDisplayname = user.displayName.toLowerCase();
        }

        return (
            discordUserId == flag.term ||
            discordUsername.match(flag.term) != null ||
            discordDisplayname.match(flag.term) != null ||
            discordServerDisplayname?.match(flag.term) != null
        );
    }

    /**
     * Assigns scrobble milestone roles to a specified guild member based on their scrobble count.
     *
     * @param {GuildMember} member - The member to whom the milestone roles will be assigned.
     * @param {number} scrobbleCount - The scrobble count of the member, used to determine which roles to assign.
     * @return {Promise<number[]>} A promise that resolves to an array of scrobble milestone numbers that were newly assigned as roles.
     */
    async assignScrobbleRoles(member: GuildMember, scrobbleCount: number): Promise<number[]> {
        if (scrobbleCount < this.env.SCROBBLE_MILESTONE_NUMBERS[1]) {
            if (!member.roles.cache.has(this.env.SCROBBLE_MILESTONE_ROLE_IDS[0])) {
                await member.roles.add(this.env.SCROBBLE_MILESTONE_ROLE_IDS[0]);
                return [this.env.SCROBBLE_MILESTONE_NUMBERS[1]];
            }
            return [];
        }

        const addedScrobbleRoles: number[] = [];
        for (const num of this.env.SCROBBLE_MILESTONE_NUMBERS) {
            const index = this.env.SCROBBLE_MILESTONE_NUMBERS.indexOf(num);
            const roleIdToAdd = this.env.SCROBBLE_MILESTONE_ROLE_IDS[index];
            if (index === 0) continue; // we skip the lowest scrobble role
            if (scrobbleCount >= num) {
                if (!member.roles.cache.has(roleIdToAdd)) {
                    await member.roles.add(this.env.SCROBBLE_MILESTONE_ROLE_IDS[index]);
                    addedScrobbleRoles.push(num);
                }
            } else break;
        }
        return addedScrobbleRoles;
    }

    async updateScrobbleRoles(member: GuildMember, scrobbleCount: number): Promise<number[]> {
        if (scrobbleCount < this.env.SCROBBLE_MILESTONE_NUMBERS[1]) {
            if (!member.roles.cache.has(this.env.SCROBBLE_MILESTONE_ROLE_IDS[0])) {
                await member.roles.add(this.env.SCROBBLE_MILESTONE_ROLE_IDS[0]);
                return [this.env.SCROBBLE_MILESTONE_NUMBERS[1]];
            }
            return [];
        }

        // Check if user only has one milestone role, if so only add the next one and remove the old one!
        let roleCount = 0;
        for (const roleId of this.env.SCROBBLE_MILESTONE_ROLE_IDS) {
            if (member.roles.cache.has(roleId)) roleCount++;
        }

        if (roleCount > 1) {
            this.logger.debug(`User has multiple scrobble milestone roles, adding new ones.`);
            return await this.assignScrobbleRoles(member, scrobbleCount);
        }
        this.logger.debug(`User has only one scrobble milestone role, adding new one and removing old one.`);

        const highestScrobbleRoleId = this.getHighestScrobbleRoleId(member);
        if (!highestScrobbleRoleId) {
            this.logger.info(
                `Could not find highest scrobble role for member ${member.displayName}. Updating everything`
            );
            return await this.assignScrobbleRoles(member, scrobbleCount);
        }
        const nextIndex = this.env.SCROBBLE_MILESTONE_ROLE_IDS.indexOf(highestScrobbleRoleId!) + 1;
        const nextScrobbleRoleId = this.env.SCROBBLE_MILESTONE_ROLE_IDS[nextIndex];
        const nextScrobbleRoleNumber = this.env.SCROBBLE_MILESTONE_NUMBERS[nextIndex];
        if (scrobbleCount >= nextScrobbleRoleNumber) {
            await member.roles.add(nextScrobbleRoleId);
            await member.roles.remove(highestScrobbleRoleId!);
            return [nextScrobbleRoleNumber];
        }
        return [];
    }

    getHighestScrobbleRoleId(member: GuildMember): string | null {
        const scrobbleRoles = [...this.env.SCROBBLE_MILESTONE_ROLE_IDS].reverse();
        for (const roleId of scrobbleRoles) {
            if (member.roles.cache.has(roleId)) return roleId;
        }
        return null;
    }

    getHighestScrobbleRoleNumber(member: GuildMember): number | null {
        const highestScrobbleRoleId = this.getHighestScrobbleRoleId(member);
        if (!highestScrobbleRoleId) return null;
        const index = this.env.SCROBBLE_MILESTONE_ROLE_IDS.indexOf(highestScrobbleRoleId);
        return this.env.SCROBBLE_MILESTONE_NUMBERS[index];
    }
}
