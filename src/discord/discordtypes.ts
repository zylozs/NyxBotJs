import * as Discord from 'discord.js';

// Export a bunch of aliases to make it easier to use these types elsewhere
export type DiscordClient = Discord.Client;
export type DiscordChannel = Discord.TextChannel | Discord.DMChannel | Discord.GroupDMChannel;
export type DiscordVoiceChannel = Discord.VoiceChannel;
export type DiscordVoiceConnection = Discord.VoiceConnection;
export type DiscordGuild = Discord.Guild;
export type DiscordGuildMember = Discord.GuildMember;
export type DiscordMessage = Discord.Message;
export type DiscordUser = Discord.User;