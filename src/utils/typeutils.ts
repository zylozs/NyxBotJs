import { DiscordRole, DiscordGuild, DiscordSnowflake, DiscordGuildMember, Collection } from "../discord/discordtypes";

export class TypeUtils
{
    public static ToBool(value:any):boolean | null
    {
        if (typeof(value) == 'boolean')
        {
            return <boolean>value;
        }
        else if (typeof(value) == 'string')
        {
            if (value.toLowerCase() == 'true')
            {
                return true;
            }
            else if (value.toLowerCase() == 'false')
            {
                return false;
            }
        }

        return null;
    }

    public static ToNum(value:any):number | null
    {
        const temp:any = +value;
        if (temp == NaN)
            return null;

        return <number>temp;
    }

    public static ToDiscordRole(value:string, guild:DiscordGuild):DiscordRole | null
    {
        if (guild == undefined)
        {
            return null;
        }

        const roles:Collection<DiscordSnowflake, DiscordRole> = guild.roles;
        const snowflakeValue:string = value.substr(3, value.length - 4);
        let outRole:DiscordRole | null = null;

        roles.some((discordRole:DiscordRole, snowflake:DiscordSnowflake):boolean =>
        {
            if (discordRole.name === value || 
                snowflake === value ||
                snowflake === snowflakeValue)
            {
                outRole = discordRole;
                return true;
            }

            return false;
        });

        return outRole;
    }

    public static ToDiscordGuildMember(value:string, guild:DiscordGuild):DiscordGuildMember | null
    {
        if (guild == undefined)
        {
            return null;
        }

        const members:Collection<DiscordSnowflake, DiscordGuildMember> = guild.members;
        const snowflakeValue:string = value.substr(3, value.length - 4);
        let outMember:DiscordGuildMember | null = null;

        members.some((discordMember:DiscordGuildMember, snowflake:DiscordSnowflake):boolean =>
        {
            // Support pretty much every possible way to uniquely identify a user
            // Prioritize guild specific stuff first since we are attempting to get a guild member out of this and not a user
            // This is case sensitive on purpose because we don't want to deal with name collisions
            if (discordMember.displayName === value || 
                discordMember.nickname === value || 
                snowflake === value ||
                snowflake === snowflakeValue || 
                discordMember.user.tag === value || 
                discordMember.user.username === value)
            {
                outMember = discordMember;
                return true;
            }

            return false;
        });

        return outMember;
    }
}