import { DiscordChannel, DiscordVoiceChannel, DiscordGuild, DiscordUser, DiscordGuildMember, DiscordPermissionResolvable, DiscordRole, DiscordSnowflake, DiscordRichEmbed } from '../discord/discordtypes';
import { Plugin } from '../plugins/plugin';
import { TagAlias } from '../command/commandapi';
import { Readable } from 'stream';

export interface BotAPI
{
    HasPermission(user:DiscordGuildMember | DiscordUser, permissionFlags:number, discordPermissions:DiscordPermissionResolvable[]):Promise<boolean>;
    IsAdmin(user:DiscordGuildMember):Promise<boolean>;
    IsInVoiceChannel():boolean;
    RegisterVoiceEventHandler(object:VoiceEventHandler):Promise<void>;
    SendMessage(channel:DiscordChannel, message:string | DiscordRichEmbed):Promise<void>;
    UnRegisterVoiceEventHandler(object:VoiceEventHandler):Promise<void>;
    AddVoiceRequest(request:VoiceRequest):Promise<VoiceRequestID>;
    RemoveVoiceRequest(requestID:VoiceRequestID):Promise<void>;
    PauseCurrentVoiceRequest():Promise<void>;
    ResumeCurrentVoiceRequest():Promise<void>;
    PlayVoiceRequests():Promise<void>;
    StopAndClearVoiceRequests():Promise<void>;
    HasVoiceRequest():boolean;
    IsVoiceRequestPaused():boolean;
    IsVoiceRequestPlaying():boolean;
    GetCurrentVoiceRequestID():VoiceRequestID;
}

// This is inteded solely for the bot. Do not call these outside of bot commands.
export interface ExtendedBotAPI extends BotAPI
{
    RequestShutdown():Promise<void>;
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

// Voice API
export interface VoiceEventHandler
{
    OnJoinVoiceChannel():Promise<void>;
    OnLeaveVoiceChannel():Promise<void>;
    OnVoiceRequestStarted(request:VoiceRequest):Promise<void>;
    OnVoiceRequestFinished(request:VoiceRequest):Promise<void>;
    OnVoiceRequestPaused(request:VoiceRequest):Promise<void>;
    OnVoiceRequestResumed(request:VoiceRequest):Promise<void>;
    OnVoiceRequestQueueFinished():Promise<void>;
}

export type VoiceRequestID = number;
export type YoutubeURL = string;

export type VoiceRequest =
{
    // The person who requested this voice request
    requester:DiscordUser;
    // Whether to start the voice request queue (if it isn't already started)
    startPlaying:boolean;
    // The channel the voice request was made in
    requestedChannel:DiscordChannel;

    // You can choose to use a YoutubeURL or a ReadableStream. ReadableStream will be checked first if you supply both.
    url?:YoutubeURL;
    stream?:Readable;

    //////////////// Metadata for the bot /////////////////
    isPaused?:boolean;
    // The ID will be given to you by the bot and will be unique to this request
    ID?:VoiceRequestID;
};