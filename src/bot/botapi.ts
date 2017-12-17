import { DiscordChannel, DiscordVoiceChannel, DiscordGuild, DiscordUser, DiscordGuildMember, DiscordPermissionResolvable, DiscordRole, DiscordSnowflake } from '../discord/discordtypes';
import { Plugin } from '../plugins/plugin';
import { TagAlias } from '../command/commandapi';

export interface BotAPI
{
    HasPermission(user:DiscordGuildMember | DiscordUser, permissionFlags:number, discordPermissions:DiscordPermissionResolvable[]):Promise<boolean>;
    IsAdmin(user:DiscordGuildMember):Promise<boolean>;
    IsInVoiceChannel():boolean;
    RegisterVoiceEventHandler(object:VoiceEventHandler):Promise<void>;
    RequestShutdown():Promise<void>;
    SendMessage(channel:DiscordChannel, message:string):Promise<void>;
    UnRegisterVoiceEventHandler(object:VoiceEventHandler):Promise<void>;
}

// This is inteded solely for the bot. Do not call these outside of bot commands.
export interface ExtendedBotAPI extends BotAPI
{
    AddDisabledPlugin(name:string):Promise<void>;
    DoesPluginTagAliasHaveCollision(tagAlias:TagAlias):boolean;
    GetPlugins():Promise<Plugin[]>;
    GetRegisteredRoles(guild:DiscordGuild):Promise<DiscordRole[]>;
    GetRegisteredUsers(guild:DiscordGuild):Promise<DiscordGuildMember[]>;
    IsRoleRegistered(role:DiscordRole):Promise<boolean>;
    IsUserRegistered(user:DiscordGuildMember):Promise<boolean>;
    JoinVoiceChannel(channel:DiscordVoiceChannel):Promise<void>;
    LeaveVoiceChannel():Promise<void>;
    RegisterRole(role:DiscordRole):Promise<void>;
    RegisterUser(user:DiscordGuildMember):Promise<void>;
    RemoveDisabledPlugin(name:string):Promise<void>;
    SetAvatar(image:Buffer | string):Promise<void>;
    UnregisterRole(role:DiscordRole):Promise<void>;
    UnregisterUser(user:DiscordGuildMember):Promise<void>;
}

// Message wrapper
export type MessageInfo = 
{
    Guild:DiscordGuild;
    Channel:DiscordChannel;
    Author:DiscordUser;
    Member?:DiscordGuildMember;
    RawContent:string;
    CleanContent:string;
};

export interface VoiceEventHandler
{
    HandleJoinVoiceChannel():Promise<void>;
    HandleLeaveVoiceChannel():Promise<void>;
}