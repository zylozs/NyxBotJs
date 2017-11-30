import { DiscordChannel, DiscordVoiceChannel, DiscordGuild, DiscordUser, DiscordGuildMember } from '../discord/discordtypes';

export interface BotAPI
{
    IsInVoiceChannel():boolean;
    RegisterVoiceEventHandler(object:VoiceEventHandler):Promise<void>;
    RequestShutdown():Promise<void>;
    SendMessage(channel:DiscordChannel, message:string):Promise<void>;
    UnRegisterVoiceEventHandler(object:VoiceEventHandler):Promise<void>;
}

// This is inteded solely for the bot. Do not call these outside of bot commands.
export interface ExtendedBotAPI extends BotAPI
{
    JoinVoiceChannel(channel:DiscordVoiceChannel):Promise<void>;
    LeaveVoiceChannel():Promise<void>;
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