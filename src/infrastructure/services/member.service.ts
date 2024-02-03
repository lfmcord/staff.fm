import { Client, GuildMember, Role } from 'discord.js';
import { TYPES } from '@src/types';
import { inject, injectable } from 'inversify';
import { CommandPermissionLevel } from '@src/feature/commands/models/command-permission.level';
import { ScheduleService } from '@src/infrastructure/services/schedule.service';
import moment = require('moment');

@injectable()
export class MemberService {
    private client: Client;
    private readonly backstagerRoleIds: string[];
    private readonly helperRoleIds: string[];
    private readonly staffRoleIds: string[];
    scheduleService: ScheduleService;
    private readonly mutedRoleId: string;
    private readonly guildId: string;
    constructor(
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.GUILD_ID) guildId: string,
        @inject(TYPES.MUTED_ROLE_ID) mutedRoleId: string,
        @inject(TYPES.BACKSTAGER_ROLE_IDS) backstagerRoleIds: string[],
        @inject(TYPES.HELPER_ROLE_IDS) helperRoleIds: string[],
        @inject(TYPES.STAFF_ROLE_IDS) staffRoleIds: string[],
        @inject(TYPES.ScheduleService) scheduleService: ScheduleService
    ) {
        this.scheduleService = scheduleService;
        this.backstagerRoleIds = backstagerRoleIds;
        this.helperRoleIds = helperRoleIds;
        this.staffRoleIds = staffRoleIds;
        this.mutedRoleId = mutedRoleId;
        this.guildId = guildId;
        this.client = client;
    }
    async getGuildMemberFromUserId(userId: string): Promise<GuildMember | null> {
        const guild = await this.client.guilds.fetch(this.guildId);
        return await guild.members.fetch(userId);
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
        const guild = await this.client.guilds.fetch(this.guildId);
        return await guild.roles.fetch(roleId);
    }

    async muteGuildMember(member: GuildMember, durationInSeconds: number = 600): Promise<void> {
        const highestUserRole = await this.getHighestRoleFromGuildMember(member);
        const botMember = await this.getGuildMemberFromUserId(this.client.user!.id);
        const highestBotRole = await this.getHighestRoleFromGuildMember(botMember!);
        const mutedRole = await (await this.client.guilds.fetch(this.guildId)).roles.fetch(this.mutedRoleId);
        if (highestUserRole.comparePositionTo(highestBotRole) > 0) {
            throw Error(`Cannot mute a member with a role higher than the bot role.`);
        }
        if (!mutedRole) {
            throw Error(`Cannot find muted role with role ID ${this.mutedRoleId}`);
        }
        if (mutedRole!.comparePositionTo(highestBotRole) > 0) {
            throw Error(`Cannot assign the muted role because it is higher than the bot role.`);
        }

        const roles = await this.getRolesFromGuildMember(member);
        roles.forEach((r) => r.comparePositionTo(botMember!.roles.highest));
        await member.roles.add(this.mutedRoleId);
        await member.roles.remove(roles);

        this.scheduleService.scheduleJob(
            `UNMUTE_${member.id}`,
            moment().add(durationInSeconds, 'seconds').toDate(),
            async () => await this.unmuteGuildMember(member, roles)
        );
    }

    async unmuteGuildMember(member: GuildMember, rolesToRestore: Role[]) {
        await member.roles.remove(this.mutedRoleId);
        rolesToRestore.forEach((r) => (r.name !== '@everyone' ? member.roles.add(r) : ''));
    }

    async getMemberPermissionLevel(member: GuildMember): Promise<CommandPermissionLevel> {
        const memberHighestRole = await this.getHighestRoleFromGuildMember(member!);
        const permissionLevelRoles = [
            {
                level: CommandPermissionLevel.Staff,
                roleIds: this.staffRoleIds,
            },
            {
                level: CommandPermissionLevel.Helper,
                roleIds: this.helperRoleIds,
            },
            {
                level: CommandPermissionLevel.Backstager,
                roleIds: this.backstagerRoleIds,
            },
        ];

        let permissionLevel = CommandPermissionLevel.User;
        for (const permission of permissionLevelRoles) {
            if (memberHighestRole.comparePositionTo(permission.roleIds[0]) >= 0) {
                permissionLevel = permission.level;
                break;
            }
        }
        return permissionLevel;
    }
}
