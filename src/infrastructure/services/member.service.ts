import { Client, GuildMember, Role } from 'discord.js';
import { TYPES } from '@src/types';
import { inject, injectable } from 'inversify';

@injectable()
export class MemberService {
    private client: Client;
    private mutedRoleId: string;
    private readonly guildId: string;
    constructor(
        @inject(TYPES.Client) client: Client,
        @inject(TYPES.GUILD_ID) guildId: string,
        @inject(TYPES.MUTED_ROLE_ID) mutedRoleId: string
    ) {
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

    async muteGuildMember(member: GuildMember): Promise<void> {
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
    }

    async unmuteGuildMember(member: GuildMember, rolesToRestore: Role[]) {
        await member.roles.remove(this.mutedRoleId);
        rolesToRestore.forEach((r) => (r.name !== '@everyone' ? member.roles.add(r) : ''));
    }
}
