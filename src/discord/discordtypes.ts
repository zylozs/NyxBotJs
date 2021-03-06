import * as Discord from 'discord.js';

// Export a bunch of aliases to make it easier to use these types elsewhere
export type Collection<k, v> = Discord.Collection<k, v>;
export type DiscordChannel = Discord.TextChannel | Discord.DMChannel | Discord.GroupDMChannel;
export type DiscordClient = Discord.Client;
export type DiscordGuild = Discord.Guild;
export type DiscordGuildChannel = Discord.GuildChannel;
export type DiscordGuildMember = Discord.GuildMember;
export type DiscordMessage = Discord.Message;
export type DiscordPermissionResolvable = Discord.PermissionResolvable;
export type DiscordRichEmbed = Discord.RichEmbed;
export type DiscordRole = Discord.Role;
export type DiscordSnowflake = Discord.Snowflake;
export type DiscordUser = Discord.User;
export type DiscordVoiceChannel = Discord.VoiceChannel;
export type DiscordVoiceConnection = Discord.VoiceConnection;

// Helper function for making embed objects since we can't use new on aliased types
export function NewEmbed():DiscordRichEmbed
{
    return new Discord.RichEmbed();
}