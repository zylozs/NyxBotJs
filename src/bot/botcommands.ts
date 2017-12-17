import { CommandUtils } from "../utils/commandutils";
import { BotCommandAPI, CommandAPI, Command, CommandRegistry, ParamParserType, ExecuteCommandResult, CommandError, CommandErrorCode, Tag, TagAlias } from '../command/commandapi';
import { Logger, LoggingEnabled } from '../utils/loggerutils';
import { ExtendedBotAPI, MessageInfo, VoiceEventHandler } from './botapi';
import { DiscordGuildMember, DiscordVoiceChannel, DiscordUser, DiscordSnowflake, DiscordGuildChannel, Collection, DiscordPermissionResolvable, DiscordRole } from '../discord/discordtypes';
import { PluginCommand, BotCommand, Usage, ToBool, PermissionConstraint, PermissionFlags, GuildOnly, ToDiscordRole, ToDiscordGuildMember } from '../command/commanddecorator';
import { ParsedCommandInfo, InputParserUtils } from '../utils/inputparserutils';
import { HelpCommandUtils } from './utils/helpcommandutils';
import { UsageCommandUtils } from './utils/usagecommandutils';
import { ImageUtils } from '../utils/imageutils';
import { Plugin, PluginDisabledState } from '../plugins/plugin';
import { TypeUtils } from "../utils/typeutils";

export class BotCommands implements BotCommandAPI, VoiceEventHandler, LoggingEnabled
{
    public Logger:Logger;
    public m_Bot:ExtendedBotAPI;
    public m_Tag:Tag;
    public m_TagAlias:TagAlias;
    public m_CommandRegistry:CommandRegistry;
    public m_DefaultParser:Function;
    public m_DefaultParserType:ParamParserType;
    private m_VoiceStarter:DiscordUser | undefined;

    public IsCommand(command:Command):boolean
    {
        return this.m_CommandRegistry.has(command);
    }

    public IsReadingMessages(): boolean
    {
        return false;
    }

    public async Initialize(bot:ExtendedBotAPI, parentContext?:Logger):Promise<void>
    {
        this.Logger = Logger.CreateLogger(parentContext, 'BotCommands');
        this.m_Bot = bot;
        this.m_Tag = 'bot';
        this.m_TagAlias = 'b';
        this.m_DefaultParser = CommandUtils.ParamParserSpaces;
        this.m_DefaultParserType = ParamParserType.SPACES;
        this.m_VoiceStarter = undefined;

        this.m_Bot.RegisterVoiceEventHandler(this);
        CommandUtils.LoadCommandRegistry(this);
    }

    public async TryExecuteCommand(messageInfo:MessageInfo, parsedCommand:ParsedCommandInfo):Promise<[ExecuteCommandResult, CommandError]>
    {
        const parsedArgs:[string, string[]] | undefined = InputParserUtils.ParseCommandArgs(this.m_CommandRegistry, parsedCommand.Tag, parsedCommand.RawContent, this.m_DefaultParser, this.m_DefaultParserType, this.Logger);
        if (parsedArgs == undefined)
        {
            return [ExecuteCommandResult.STOP, CommandError.New(CommandErrorCode.INCORRECT_BOT_COMMAND_USAGE)];
        }

        // Check permissions if the command came from a guild channel
        const permissions:[number, DiscordPermissionResolvable[]] = CommandUtils.GetCommandPermissionFlags(this.m_CommandRegistry, parsedCommand.Tag, parsedArgs[0]);
        if (messageInfo.Member && !await this.m_Bot.HasPermission(messageInfo.Member, permissions[0], permissions[1]))
        {
            return [ExecuteCommandResult.STOP, CommandError.New(CommandErrorCode.INSUFFICIENT_USER_PERMISSIONS)];
        }

        // Setup our args
        let args:any[] = [];
        args.push(messageInfo);
        args = args.concat(parsedArgs[1]);

        // Call the command
        const result:CommandError = await (<any>this)[parsedArgs[0]].apply(this, args);

        return [ExecuteCommandResult.STOP, result];
    }

    public async ReadMessage(message:MessageInfo):Promise<void>
    {

    }

    public async Shutdown():Promise<void>
    {

    }

    public async HandleJoinVoiceChannel():Promise<void>
    {

    }

    public async HandleLeaveVoiceChannel():Promise<void>
    {

    }

    ///////////////////////////////////////////////////////////
    /// BOT COMMANDS
    ///////////////////////////////////////////////////////////

    @Usage(
       `Changes the bot's avatar to the image you provide.
        \`!changebotavatar <image_url>\`
        **Example:** \`!changebotavatar www.website.com/url_to_image.png\``
    )
    @PermissionConstraint(PermissionFlags.ROLE | PermissionFlags.USER)
    @BotCommand('Change the bot\s avatar image. Url must be a PNG or JPG image.', { name:'changebotavatar', paramParserType:ParamParserType.ALL })
    private async _ChangeBotAvatar_(messageInfo:MessageInfo, image_url:string):Promise<CommandError>
    {
        let newAvatar:Buffer = await ImageUtils.GetBase64ImageFromUrl(image_url);

        await this.m_Bot.SetAvatar(newAvatar);

        return CommandError.Success();
    }

    @Usage(
       `Changes the bot's guild nickname to the name you provide.
        \`!changebotname <name>\`
        **Example:** \`!changebotname He-man, Master of the Universe\``
    )
    @PermissionConstraint(PermissionFlags.ROLE | PermissionFlags.USER)
    @BotCommand('Change the name of the bot to <name>', { name:'changebotname', paramParserType:ParamParserType.ALL })
    private async _ChangeBotName_(messageInfo:MessageInfo, name:string):Promise<CommandError>
    {
        let botMember:DiscordGuildMember = messageInfo.Guild.me;
        try
        {
            await botMember.setNickname(name);
        }
        catch (error)
        {
            return CommandError.New(CommandErrorCode.INSUFFICIENT_BOT_PERMISSIONS);
        }

        return CommandError.Success();
    }

    @Usage(
       `Disables the plugin with the tag or alias you provide temporarily. This is equivalent to calling disableplugin with false for ispermanent. 
        \`!disableplugin <tag>\`
        **Example with tag:** \`!disableplugin chatmod\`
        **Example with alias:** \`!disableplugin cm\``
    )
    @PermissionConstraint(PermissionFlags.ROLE | PermissionFlags.USER)
    @BotCommand('Disables a plugin temporarily', { name:'disableplugin' })
    private async _DisablePluginTemporary_(messageInfo:MessageInfo, tag:Tag):Promise<CommandError>
    {
        return await this._DisablePlugin_(messageInfo, tag, false);
    }

    @Usage(
       `Disables the plugin with the tag or alias you provide. If you specified true to ispermanent, it will be permanent and persist between bot sessions. If you specified false to ispermanent, it will only last until the bot is restarted or you re-enable the plugin. True/False are not case sensitive for ispermanent. 
        \`!disableplugin <tag> <ispermanent>\`
        **Example with tag:** \`!disableplugin chatmod false\`
        **Example with tag:** \`!disableplugin chatmod FALSE\`
        **Example with alias:** \`!disableplugin cm true\`
        **Example with alias:** \`!disableplugin cm TRUE\``
    )
    @PermissionConstraint(PermissionFlags.ROLE | PermissionFlags.USER)
    @BotCommand('Disables a plugin temporarily or permanently', { name:'disableplugin' })
    private async _DisablePlugin_(messageInfo:MessageInfo, tag:Tag, @ToBool isPermanent:boolean):Promise<CommandError>
    {
        const plugins:Plugin[] = await this.m_Bot.GetPlugins();
        for (let plugin of plugins)
        {
            if (plugin.IsThisPlugin(tag))
            {
                if (isPermanent)
                {
                    if (plugin.GetDisabledState() == PluginDisabledState.DISABLED_PERMANENT)
                    {
                        return CommandError.Custom(`Plugin \`${plugin.m_Tag}\` is already permanently disabled.`);
                    }

                    plugin.SetDisabledState(PluginDisabledState.DISABLED_PERMANENT);

                    await this.m_Bot.AddDisabledPlugin(plugin.m_Name);

                    await this.m_Bot.SendMessage(messageInfo.Channel, `Plugin \`${plugin.m_Tag}\` is now permanently disabled!`);
                }
                else
                {
                    if (plugin.IsDisabled())
                    {
                        return CommandError.Custom(`Plugin \`${plugin.m_Tag}\` is already disabled.`);
                    }

                    plugin.SetDisabledState(PluginDisabledState.DISABLED_TEMPORARY);
                    await this.m_Bot.SendMessage(messageInfo.Channel, `Plugin \`${plugin.m_Tag}\` is now temporarily disabled!`);
                }
            }
        }

        return CommandError.Success();
    }

    @Usage(
       `Enables the plugin with the tag or alias you provide temporarily. This is equivalent to calling enableplugin with false for ispermanent.
        \`!enableplugin <tag>\`
        **Example with tag:** \`!enableplugin chatmod\`
        **Example with alias:** \`!enableplugin cm\``
    )
    @PermissionConstraint(PermissionFlags.ROLE | PermissionFlags.USER)
    @BotCommand('Enables a plugin temporarily', { name:'enableplugin' })
    private async _EnablePluginTemporary_(messageInfo:MessageInfo, tag:Tag):Promise<CommandError>
    {
        return await this._EnablePlugin_(messageInfo, tag, false);
    }

    @Usage(
       `Enables the plugin with the tag or alias you provide. If you specified true to ispermanent, it will be permanent and persist between bot sessions. If you specified false to ispermanent, it will only last until the bot is restarted or you disable the plugin again. True/False are not case sensitive for ispermanent. 
        \`!enableplugin <tag> <ispermanent>\`
        **Example with tag:** \`!enableplugin chatmod false\`
        **Example with tag:** \`!enableplugin chatmod FALSE\`
        **Example with alias:** \`!enableplugin cm true\`
        **Example with alias:** \`!enableplugin cm TRUE\``
    )
    @PermissionConstraint(PermissionFlags.ROLE | PermissionFlags.USER)
    @BotCommand('Enables a plugin temporarily or permanently', { name:'enableplugin' })
    private async _EnablePlugin_(messageInfo:MessageInfo, tag:Tag, @ToBool isPermanent:boolean):Promise<CommandError>
    {
        const plugins:Plugin[] = await this.m_Bot.GetPlugins();
        for (let plugin of plugins)
        {
            if (plugin.IsThisPlugin(tag))
            {
                if (plugin.GetDisabledState() == PluginDisabledState.ENABLED)
                {
                    return CommandError.Custom(`Plugin \`${plugin.m_Tag}\` is already enabled.`);
                }

                if (isPermanent)
                {
                    const wasPermanent:boolean = plugin.GetDisabledState() == PluginDisabledState.DISABLED_PERMANENT;

                    plugin.SetDisabledState(PluginDisabledState.ENABLED);

                    if (wasPermanent)
                    {
                        await this.m_Bot.RemoveDisabledPlugin(plugin.m_Name);
                        await this.m_Bot.SendMessage(messageInfo.Channel, `Plugin \`${plugin.m_Tag}\` is now permanently enabled!`);
                    }
                    else
                    {
                        await this.m_Bot.SendMessage(messageInfo.Channel, `Plugin \`${plugin.m_Tag}\` is now enabled!`);
                    }
                }
                else
                {
                    plugin.SetDisabledState(PluginDisabledState.ENABLED);
                    await this.m_Bot.SendMessage(messageInfo.Channel, `Plugin \`${plugin.m_Tag}\` is now enabled!`);
                }
            }
        }

        return CommandError.Success();
    }

    @Usage(
       `Says hello!
        \`!hello\`
        **Example:** \`!hello\``
    )
    @BotCommand('Say Hello', { name:'hello' })
    private async _Hello_(messageInfo:MessageInfo):Promise<CommandError>
    {
        this.m_Bot.SendMessage(messageInfo.Channel, `Hello <@${messageInfo.Author.id}>`);
        return CommandError.Success();
    }

    @Usage(
       `Displays the basic howto message for the bot. This explains how to use commands.
        \`!help\`
        **Example:** \`!help\``
    )
    @BotCommand('Provides the basic help page', { name:'help' })
    private async _Help_(messageInfo:MessageInfo):Promise<CommandError>
    {
        return await HelpCommandUtils.GetHelp(this, this.m_Bot, messageInfo.Channel, '');
    }

    @Usage(
       `Displays the help for the bot or a specific plugin. This shows the different commands available.
        \`!help <pagename>\`
        **Example for bot:** \`!help bot\`
        **Example for plugin:** \`!help music\``
    )
    @BotCommand('Provides the help page for a specific part of the bot or its plugins', { name:'help' })
    private async _HelpPage_(messageInfo:MessageInfo, pagename:string):Promise<CommandError>
    {
        return await HelpCommandUtils.GetHelp(this, this.m_Bot, messageInfo.Channel, pagename);
    }

    @Usage(
       `Tells the bot to join the voice channel you are currently in.
        \`!join\`
        **Example:** \`!join\``
    )
    @GuildOnly
    @BotCommand('Join the voice channel you are currently in', { name:'join' })
    private async _JoinMe_(messageInfo:MessageInfo):Promise<CommandError>
    {
        if (messageInfo.Member != undefined)
        {
            let channel:DiscordVoiceChannel = messageInfo.Member.voiceChannel;
            if (channel != undefined)
            {
                this.m_VoiceStarter = messageInfo.Author;
                await this.m_Bot.JoinVoiceChannel(channel);
            }
            else
            {
                await this.m_Bot.SendMessage(messageInfo.Channel, 'You are not currently in a voice channel.');
            }
        }
        else
        {
            return CommandError.New(CommandErrorCode.GUILD_ONLY_COMMAND);
        }

        return CommandError.Success();
    }

    @Usage(
       `Tells the bot to join the voice channel with the given name. This is not case sensitive unless there are multiple channels with the same name. If there are multiple channels with the same name you will need to provide the exact, case sensitive, name.
        \`!join <channel>\`
        **Example when not case sensitive:** \`!join general\`
        **Example when case sensitive:** \`!join GeNerAl\``
    )
    @GuildOnly
    @BotCommand('Join voice channel with given name', { name:'join' })
    private async _JoinChannel_(messageInfo:MessageInfo, channel:string):Promise<CommandError>
    {
        const channels:Collection<DiscordSnowflake, DiscordGuildChannel> = messageInfo.Guild.channels;
        let duplicateChannels:DiscordGuildChannel[] = [];
        let selectedChannel:DiscordGuildChannel | undefined = undefined;
            
        channels.forEach((guildChannel:DiscordGuildChannel)=>
        {
            if (guildChannel.type === 'voice' && guildChannel.name.toLowerCase() === channel.toLowerCase())
            {
                duplicateChannels.push(guildChannel);
            }
        });

        if (duplicateChannels.length == 0)
        {
            await this.m_Bot.SendMessage(messageInfo.Channel, `There is no voice channel called \`${channel}\`.`);
            return CommandError.Success();
        }
        else if (duplicateChannels.length == 1)
        {
            selectedChannel = duplicateChannels[0];
        }
        else
        {
            this.Logger.Debug('More than one channel with name found. Picking the channel with the same capitalization.');

            for (let guildChannel of duplicateChannels)
            {
                if (guildChannel.name === channel)
                {
                    selectedChannel = guildChannel;
                    break;
                }
            }
        }

        if (selectedChannel != undefined) 
        {
            this.m_VoiceStarter = messageInfo.Author;
            await this.m_Bot.JoinVoiceChannel(<DiscordVoiceChannel>selectedChannel);
        }
        else
        {
            await this.m_Bot.SendMessage(messageInfo.Channel, 'There is more than one channel with this name. Please use the correct capitalization to join a specific one.');
        }

        return CommandError.Success();
    }

    @Usage(
       `Tells the bot to leave the voice channel it is currently in. Only the person who brought it into the voice channel (or an admin) can do this.
        \`!leave\`
        **Example:** \`!leave\``
    )
    @GuildOnly
    @BotCommand('Leave the current voice channel', { name:'leave' })
    private async _Leave_(messageInfo:MessageInfo):Promise<CommandError>
    {
        if (this.m_VoiceStarter == undefined)
        {
            this.m_Bot.SendMessage(messageInfo.Channel, 'I am not connected to any voice channel!');
            return CommandError.Success();
        }

        if (messageInfo.Author == this.m_VoiceStarter || await this.m_Bot.IsAdmin(<DiscordGuildMember>messageInfo.Member))
        {
            this.m_VoiceStarter = undefined;
            await this.m_Bot.LeaveVoiceChannel();
        }
        else
        {
            return CommandError.New(CommandErrorCode.INSUFFICIENT_USER_PERMISSIONS);
        }

        return CommandError.Success();
    }

    @Usage(
       `Gets the registered roles for this guild. Users with these roles have permission to execute commands with a role constraint while in this guild.
        \`!registeredroles\`
        **Example:** \`!registeredroles\``
    )
    @GuildOnly
    @BotCommand('Gets the registered roles for this guild', { name:'registeredroles' })
    private async _RegisteredRoles_(messageInfo:MessageInfo):Promise<CommandError>
    {
        const roles:DiscordRole[] = await this.m_Bot.GetRegisteredRoles(messageInfo.Guild);
        let output:string = roles.length > 0 ? 'Registered Roles:\n' : 'There are currently no registered roles for this guild.';

        roles.forEach((role:DiscordRole) =>
        {
            output += `${role.name}\n`;
        });

        await this.m_Bot.SendMessage(messageInfo.Channel, output);

        return CommandError.Success();
    }

    @Usage(
       `Gets the registered users for this guild. These users have permission to execute commands with a user constraint while in this guild.
        \`!registeredusers\`
        **Example:** \`!registeredusers\``
    )
    @GuildOnly
    @BotCommand('Gets the registered users for this guild', { name:'registeredusers' })
    private async _RegisteredUsers_(messageInfo:MessageInfo):Promise<CommandError>
    {
        const users:DiscordGuildMember[] = await this.m_Bot.GetRegisteredUsers(messageInfo.Guild);
        let output:string = users.length > 0 ? 'Registered Users:\n' : 'There are currently no registered users for this guild.';

        users.forEach((user:DiscordGuildMember) =>
        {
            output += `${user.displayName}\n`;
        });

        await this.m_Bot.SendMessage(messageInfo.Channel, output);

        return CommandError.Success();
    }

    @Usage(
       `Registers a specific role in the guild where the command is run as having permission to execute commands with a role constraint while in that guild.
        \`!registerrole <role>\`
        **Example using name:** \`!registerrole bot\`
        **Example using @:** \`!registerrole @bot\``
    )
    @GuildOnly
    @PermissionConstraint(PermissionFlags.ADMIN)
    @BotCommand('Register a role as having permission to execute commands with a role constraint while in that guild', { name:'registerrole', paramParserType:ParamParserType.ALL })
    private async _RegisterRole_(messageInfo:MessageInfo, @ToDiscordRole role:DiscordRole):Promise<CommandError>
    {
        if (await this.m_Bot.IsRoleRegistered(role))
        {
            this.m_Bot.SendMessage(messageInfo.Channel, `\`${role.name}\` is already a registered role.`);
        }
        else
        {
            await this.m_Bot.RegisterRole(role);
            this.m_Bot.SendMessage(messageInfo.Channel, `\`${role.name}\` is now a registered role.`);
        }

        return CommandError.Success();
    }

    @Usage(
       `Registers a specific user in the guild where the command is run as having permission to execute commands with a user constraint while in that guild.
        \`!registeruser <user>\`
        **Example using discord name:** \`!registeruser He-man Master of the Universe\`
        **Example using discord tag:** \`!registeruser He-man Master of the Universe#1234\`
        **Example using guild nickname:** \`!registeruser he-man the stronk\`
        **Example using @:** \`!registeruser @He-man Master of the Universe\``
    )
    @GuildOnly
    @PermissionConstraint(PermissionFlags.ADMIN)
    @BotCommand('Register a user as having permission to execute commands with a user constraint while in that guild', { name:'registeruser', paramParserType:ParamParserType.ALL })
    private async _RegisterUser_(messageInfo:MessageInfo, @ToDiscordGuildMember user:DiscordGuildMember):Promise<CommandError>
    {
        if (await this.m_Bot.IsUserRegistered(user))
        {
            this.m_Bot.SendMessage(messageInfo.Channel, `\`${user.displayName}\` is already a registered user in this guild.`);
        }
        else
        {
            await this.m_Bot.RegisterUser(user);
            this.m_Bot.SendMessage(messageInfo.Channel, `\`${user.displayName}\` is now a registered user in this guild.`);
        }

        return CommandError.Success();
    }

    @Usage(
       `Shuts down the bot. 
        \`!shutdown\`
        **Example:** \`!shutdown\``
    )
    @GuildOnly
    @PermissionConstraint(PermissionFlags.ADMIN)
    @BotCommand('Shutdown the bot', { name:'shutdown' })
    private async _Shutdown_(messageInfo:MessageInfo):Promise<CommandError>
    {
        await this.m_Bot.RequestShutdown();

        return CommandError.Success();
    }

    @Usage(
       `Unregisters a specific role in the guild where the command is run and removes permission to execute commands with a role constraint while in that guild.
        \`!unregisterrole <role>\`
        **Example using name:** \`!unregisterrole super crazy bot\`
        **Example using @:** \`!unregisterrole @super crazy bot\``
    )
    @GuildOnly
    @PermissionConstraint(PermissionFlags.ADMIN)
    @BotCommand('Unregister a role and remove permission to execute commands with a role constraint while in that guild', { name:'unregisterrole', paramParserType:ParamParserType.ALL })
    private async _UnregisterRole_(messageInfo:MessageInfo, @ToDiscordRole role:DiscordRole):Promise<CommandError>
    {
        if (await this.m_Bot.IsRoleRegistered(role))
        {
            await this.m_Bot.UnregisterRole(role);
            this.m_Bot.SendMessage(messageInfo.Channel, `\`${role.name}\` is no longer a registered role.`);
        }
        else
        {
            this.m_Bot.SendMessage(messageInfo.Channel, `\`${role.name}\` is not a registered role.`);
        }

        return CommandError.Success();
    }

    @Usage(
       `Unregisters a specific user in the guild where the command is run and removes permission to execute commands with a user constraint while in that guild.
        \`!unregisteruser <user>\`
        **Example using discord name:** \`!unregisteruser He-man Master of the Universe\`
        **Example using discord tag:** \`!unregisteruser He-man Master of the Universe#1234\`
        **Example using guild nickname:** \`!unregisteruser he-man the stronk\`
        **Example using @:** \`!unregisteruser @He-man Master of the Universe\``
    )
    @GuildOnly
    @PermissionConstraint(PermissionFlags.ADMIN)
    @BotCommand('Unregister a user and remove permission to execute commands with a user constraint while in that guild', { name:'unregisteruser', paramParserType:ParamParserType.ALL })
    private async _UnregisterUser_(messageInfo:MessageInfo, @ToDiscordGuildMember user:DiscordGuildMember):Promise<CommandError>
    {
        if (await this.m_Bot.IsUserRegistered(user))
        {
            this.m_Bot.UnregisterUser(user);
            this.m_Bot.SendMessage(messageInfo.Channel, `\`${user.displayName}\` is no longer a registered user in this guild.`);
        }
        else
        {
            this.m_Bot.SendMessage(messageInfo.Channel, `\`${user.displayName}\` is not a registered user in this guild.`);
        }

        return CommandError.Success();
    }

    @Usage(
       `Provides documentation on usage:
        \`!usage\``
    )
    @BotCommand('Get the basic help page for the usage command', { name:'usage' })
    private async _Usage_(messageInfo:MessageInfo):Promise<CommandError>
    {
        return await UsageCommandUtils.GetUsage(this, this.m_Bot, messageInfo.Channel, null, null);
    }

    @Usage(
       `Provides documentation on the bot command you specify:
        \`!usage <botcommand>\`
        **Example:** \`!usage help\``
    )
    @BotCommand('Shows the usage for a bot command', { name:'usage' })
    private async _UsageBot_(messageInfo:MessageInfo, botcommand:Command):Promise<CommandError>
    {
        return await UsageCommandUtils.GetUsage(this, this.m_Bot, messageInfo.Channel, null, botcommand);
    }

    @Usage(
       `Provides documentation on the plugin command you specify:
        \`!usage <tag> <command>\`
        **Example with plugin tag:** \`!usage troll rickroll\`
        **Example with plugin alias:** \`!usage t rickroll\``
    )
    @BotCommand('Shows the usage for a plugin command', { name:'usage' })
    private async _UsagePlugin(messageInfo:MessageInfo, tag:Tag, command:Command):Promise<CommandError>
    {
        return await UsageCommandUtils.GetUsage(this, this.m_Bot, messageInfo.Channel, tag, command);
    }
}