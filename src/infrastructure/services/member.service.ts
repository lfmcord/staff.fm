import { Environment } from '@models/environment';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { Flag } from '@src/feature/commands/moderation/models/flag.model';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import { TYPES } from '@src/types';
import { Client, GuildMember, Role, User } from 'discord.js';
import { inject, injectable } from 'inversify';
import { Logger } from 'tslog';

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
            const guild = await this.client.guilds.fetch(this.env.CORE.GUILD_ID);
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
        const guild = await this.client.guilds.fetch(this.env.CORE.GUILD_ID);
        return await guild.roles.fetch(roleId);
    }

    async getMemberPermissionLevel(member: GuildMember): Promise<CommandPermissionLevel> {
        const memberHighestRole = await this.getHighestRoleFromGuildMember(member!);
        const permissionLevelRoles = [
            {
                level: CommandPermissionLevel.Administrator,
                roleIds: this.env.ROLES.ADMIN_ROLE_IDS,
            },
            {
                level: CommandPermissionLevel.Moderator,
                roleIds: this.env.ROLES.MODERATOR_ROLE_IDS,
            },
            {
                level: CommandPermissionLevel.Helper,
                roleIds: this.env.ROLES.HELPER_ROLE_IDS,
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

        // backstage roles don't work with position but only with exact hasRole
        if (permissionLevel <= CommandPermissionLevel.Backstager) {
            const roles = await this.getRolesFromGuildMember(member);
            for (const roleId of this.env.ROLES.BACKSTAGER_ROLE_IDS) {
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

    async assignScrobbleRoles(member: GuildMember, scrobbleCount: number) {
        for (const roleId of this.getScrobbleRolesToAssign(member, scrobbleCount)!.values()) {
            await member.roles.add(roleId);
        }
    }

    getScrobbleRolesToAssign(member: GuildMember, scrobbleCount: number): Map<number, string> {
        const scrobbleRoles = this.getScrobbleRoles(member);

        // Check if user only has one milestone role, if so only add the next one and remove the old one!
        let isSingleRoleMode = false;
        if (
            scrobbleRoles.size == 1 &&
            scrobbleRoles.values().next().value != this.env.ROLES.SCROBBLE_MILESTONES.values().next().value
        ) {
            isSingleRoleMode = true;
        }

        const rolesToAssign: Map<number, string> = new Map<number, string>();
        if (isSingleRoleMode) {
            this.logger.debug(`User has only one scrobble milestone role.`);
            const scrobbleRoleToAssign = this.getHighestEligibleScrobbleRole(scrobbleCount);
            if (scrobbleRoles.keys().next().value == scrobbleRoleToAssign[0]) {
                this.logger.debug(
                    `User already has the correct scrobble milestone role for ${scrobbleRoleToAssign[0]}.`
                );
            } else rolesToAssign.set(scrobbleRoleToAssign[0], scrobbleRoleToAssign[1]);
        } else {
            this.logger.debug(`User has multiple scrobble milestone roles.`);
            if (scrobbleCount < [...this.env.ROLES.SCROBBLE_MILESTONES.keys()].slice(1)[0]) {
                // if user has less than 1k scrobbles, assign the under 1k role
                const firstScrobbleRole = this.env.ROLES.SCROBBLE_MILESTONES.entries().next().value as [number, string];
                if (!member.roles.cache.has(firstScrobbleRole[1])) {
                    this.logger.debug(`User has under 1k scrobbles (${scrobbleCount}), assigning the under 1k role.`);
                    rolesToAssign.set(firstScrobbleRole[0], firstScrobbleRole[1]);
                }
            } else {
                const scrobbleMilestones = this.env.ROLES.SCROBBLE_MILESTONES.entries();
                scrobbleMilestones.next(); // skip the first one because it is the under 1k role
                for (const [scrobbleMilestone, roleId] of scrobbleMilestones) {
                    if (scrobbleCount >= scrobbleMilestone) {
                        if (!member.roles.cache.has(roleId)) {
                            rolesToAssign.set(scrobbleMilestone, roleId);
                        }
                    } else break;
                }
            }
        }
        this.logger.debug(`User is eligible for following roles: ${[...rolesToAssign.keys()].join(', ')}`);
        return rolesToAssign;
    }

    getScrobbleRoles(member: GuildMember): Map<number, string> {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        this.logger.info((this.env.ROLES.SCROBBLE_MILESTONES as any)['0']);
        return new Map<number, string>(
            [...this.env.ROLES.SCROBBLE_MILESTONES.entries()].filter(([_, roleId]) => member.roles.cache.has(roleId))
        );
    }

    getHighestEligibleScrobbleRole(scrobbleCount: number): [number, string] {
        let eligibleRole = this.env.ROLES.SCROBBLE_MILESTONES.entries().next().value;
        for (const [milestone, roleId] of this.env.ROLES.SCROBBLE_MILESTONES.entries()) {
            if (scrobbleCount >= milestone) eligibleRole = [milestone, roleId];
            else break;
        }
        return eligibleRole;
    }

    getNextHighestScrobbleRole(scrobbleCount: number): [number, string] {
        let nextScrobbleRole = this.env.ROLES.SCROBBLE_MILESTONES.entries().next().value;
        for (const [milestone, roleId] of this.env.ROLES.SCROBBLE_MILESTONES.entries()) {
            if (scrobbleCount >= milestone) nextScrobbleRole = [milestone, roleId];
            else {
                nextScrobbleRole = [milestone, roleId];
                break;
            }
        }
        return nextScrobbleRole;
    }
}
