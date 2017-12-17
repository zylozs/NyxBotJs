import * as Discord from 'discord.js';
import { DiscordVoiceConnection, DiscordChannel, DiscordVoiceChannel, DiscordMessage, DiscordUser, DiscordGuildMember, DiscordGuild, DiscordSnowflake, DiscordPermissionResolvable, DiscordRole, Collection } from './discord/discordtypes';
import { ExtendedBotAPI, MessageInfo, VoiceEventHandler } from './bot/botapi';
import { EventListenerUtils, EventListener } from './utils/eventlistenerutils';
import { Logger, LoggingEnabled, LoggerUtils } from './utils/loggerutils';
import { BotCommands } from './bot/botcommands';
import { BotCommandAPI, CommandAPI, ExecuteCommandResult, CommandErrorCode, Command, Tag, TagAlias, CommandError } from './command/commandapi';
import { ParsedCommandInfo, InputParserUtils } from './utils/inputparserutils';
import { Plugin, PluginDisabledState } from './plugins/plugin';
import { PluginManager } from './plugins/pluginmanager';
import { PermissionFlags } from './command/commanddecorator';

const BotConfig = require('./config.json');
const { ClientEvent } = EventListenerUtils;
const commandLineArgs = require('command-line-args');
const fs = require('fs');

const optionDefinitions = [
    { name: 'verbose', alias: 'v', type:Boolean }
];

const options = commandLineArgs(optionDefinitions);

class NyxBot extends Discord.Client implements ExtendedBotAPI, EventListener, LoggingEnabled
{
    public Logger:Logger;
    private m_VoiceConnection:DiscordVoiceConnection | undefined;
    private m_IsInitialized:boolean;
    private m_PluginCommandCollisions:Map<Tag, Command[]>;
    private m_BotCommands:BotCommandAPI;
    private m_VoiceEventHandlers:Set<VoiceEventHandler>;
    private m_PluginManager:PluginManager;

    public constructor()
    {
        super();
        this.Logger = new Logger('NyxBot');
        this.m_BotCommands = new BotCommands();
        this.Logger.Verbose('Constructor');
        this.m_VoiceConnection = undefined;
        this.m_VoiceEventHandlers = new Set<VoiceEventHandler>();
        this.m_PluginManager = new PluginManager();
        this.m_IsInitialized = false;
        this.m_PluginCommandCollisions = new Map();

        EventListenerUtils.RegisterEventListeners(this);
    }

    ///////////////////////////////////////////////////////////
    /// BOT API
    ///////////////////////////////////////////////////////////

    public async HasPermission(user:DiscordGuildMember, permissionFlags:number, discordPermissions?:DiscordPermissionResolvable[]):Promise<boolean>
    {
        // Back out early if we have no permissions to check
        if (permissionFlags == 0)
        {
            return true;
        }

        // Things with the admin permission flag require you are an admin to have permission
        if (permissionFlags & PermissionFlags.ADMIN)
        {
            return user.hasPermission('ADMINISTRATOR');
        }

        // If we are an admin, we can do anything so just back out early
        if (user.hasPermission('ADMINISTRATOR'))
        {
            return true;
        }

        if (permissionFlags & PermissionFlags.ROLE)
        {
            if (BotConfig.registeredRoles && (<DiscordSnowflake[]>BotConfig.registeredRoles).length > 0)
            {
                const roles:DiscordSnowflake[] = <DiscordSnowflake[]>BotConfig.registeredRoles;
                for (let role of roles)
                {
                    // Check if the user and the guild they are in both have a role
                    if (user.roles.has(role) && user.guild.roles.has(role))
                    {
                        return true;
                    }
                }
            }
        }

        if (permissionFlags & PermissionFlags.USER)
        {
            if (BotConfig.registeredUsers && (<any[]>BotConfig.registeredUsers).length > 0)
            {
                const users:any[] = <any[]>BotConfig.registeredUsers;
                for (let registeredUser of users)
                {
                    if (registeredUser.guild && registeredUser.user)
                    {
                        if (registeredUser.guild === user.guild.id && registeredUser.user === user.id)
                        {
                            return true;
                        }
                    }
                }
            }
        }

        if (permissionFlags & PermissionFlags.PERMISSION)
        {
            if (discordPermissions == undefined)
            {
                discordPermissions = [];
            }

            for (let permission of discordPermissions)
            {
                // The user must have all of the permissions listed
                if (!user.hasPermission(permission))
                {
                    return false;
                }
            }

            return true;
        }

        return false;
    }

    public async IsAdmin(user:DiscordGuildMember):Promise<boolean>
    {
        return await this.HasPermission(user, PermissionFlags.ADMIN);
    }

    public IsInVoiceChannel():boolean
    {
        return this.m_VoiceConnection != undefined;
    }

    public async RegisterVoiceEventHandler(object:VoiceEventHandler):Promise<void>
    {
        if (this.m_VoiceEventHandlers.has(object))
        {
            throw EvalError('You cannot register the same VoiceEventHandler twice');
        }

        this.m_VoiceEventHandlers.add(object);
    }

    public async RequestShutdown():Promise<void>
    {
        this.m_BotCommands.Shutdown();
        this.destroy();
        process.exit(0);
    }

    public async SendMessage(channel: DiscordChannel, message: string): Promise<void>
    {
        // TODO: add checks for things like message length
        this.Logger.Debug(message);
        await channel.send(message);
    }

    public async UnRegisterVoiceEventHandler(object:VoiceEventHandler):Promise<void>
    {
        if (!this.m_VoiceEventHandlers.has(object))
        {
            throw EvalError('You cannot unregister a VoiceEventHandler that was never registered.');
        }

        this.m_VoiceEventHandlers.delete(object);
    }

    ///////////////////////////////////////////////////////////
    /// EXTENDED BOT API
    ///////////////////////////////////////////////////////////

    public async AddDisabledPlugin(name:string):Promise<void>
    {
        if (!BotConfig.disabledPlugins)
        {
            BotConfig.disabledPlugins = [];
        }

        (<string[]>BotConfig.disabledPlugins).push(name);

        try
        {
            fs.writeFile('./config.json', JSON.stringify(BotConfig));
        }
        catch(e)
        {
            this.Logger.Error(`Failed to disable plugin ${name} in the config file. Error: ${e}`);
        }
    }

    public DoesPluginTagAliasHaveCollision(tagAlias:TagAlias):boolean
    {
        return this.m_PluginCommandCollisions.has(tagAlias);
    }

    public async GetPlugins():Promise<Plugin[]>
    {
        return this.m_PluginManager.GetPlugins<Plugin>();
    }

    public async GetRegisteredRoles(guild:DiscordGuild):Promise<DiscordRole[]>
    {
        if (!BotConfig.registeredRoles || (<DiscordSnowflake[]>BotConfig.registeredRoles).length == 0)
        {
            return [];
        }

        const roles:Collection<DiscordSnowflake, DiscordRole> = guild.roles;
        const configRoles:DiscordSnowflake[] = <DiscordSnowflake[]>BotConfig.registeredRoles;
        let registeredRoles:DiscordRole[] = [];

        roles.forEach((discordRole:DiscordRole, snowflake:DiscordSnowflake) =>
        {
            configRoles.forEach((roleSnowflake:DiscordSnowflake) =>
            {
                if (snowflake === roleSnowflake)
                {
                    registeredRoles.push(discordRole);
                }
            });
        });

        return registeredRoles;
    }

    public async GetRegisteredUsers(guild:DiscordGuild):Promise<DiscordGuildMember[]>
    {
        if (!BotConfig.registeredUsers || (<any[]>BotConfig.registeredUsers).length == 0)
        {
            return [];
        }

        const members:Collection<DiscordSnowflake, DiscordGuildMember> = guild.members;
        const configUsers:any[] = <any[]>BotConfig.registeredUsers;
        let registeredUsers:DiscordGuildMember[] = [];

        members.forEach((discordMember:DiscordGuildMember, snowflake:DiscordSnowflake) =>
        {
            configUsers.forEach((user:any) =>
            {
                if (user.guild && user.user)
                {
                    if (user.guild === guild.id && user.user === snowflake)
                    {
                        registeredUsers.push(discordMember);
                    }
                }
            });
        });

        return registeredUsers;
    }

    public async IsRoleRegistered(role:DiscordRole):Promise<boolean>
    {
        if (!BotConfig.registeredRoles)
        {
            return false;
        }

        return (<DiscordSnowflake[]>BotConfig.registeredRoles).includes(role.id);
    }

    public async IsUserRegistered(user:DiscordGuildMember):Promise<boolean>
    {
        if (!BotConfig.registeredUsers)
        {
            return false;
        }

        for (let registeredUser of <any[]>BotConfig.registeredUsers)
        {
            if (registeredUser.guild && registeredUser.user)
            {
                if (registeredUser.guild === user.guild.id && registeredUser.user === user.id)
                {
                    return true;
                }
            } 
        }

        return false;
    }

    public async JoinVoiceChannel(channel:DiscordVoiceChannel):Promise<void>
    {
        if (this.m_VoiceConnection == undefined)
        {
            this.m_VoiceConnection = await channel.join();
        }
        else
        {
            if (this.m_VoiceConnection.channel === channel) 
            {
                this.Logger.Debug('You are already in this voice channel; backing out early.');
                return;
            }

            await this.LeaveVoiceChannel();
            this.m_VoiceConnection = await channel.join();
        }

        this.m_VoiceEventHandlers.forEach(async (eventHandler:VoiceEventHandler)=>
        {
            await eventHandler.HandleJoinVoiceChannel();
        });
    }

    public async LeaveVoiceChannel():Promise<void>
    {
        if (this.m_VoiceConnection == undefined)
        {
            this.Logger.Error('You cannot leave a voice channel when you are not in one.')
            return;
        }

        this.m_VoiceConnection.disconnect();
        this.m_VoiceConnection = undefined;

        this.m_VoiceEventHandlers.forEach(async (eventHandler: VoiceEventHandler) =>
        {
            await eventHandler.HandleLeaveVoiceChannel();
        });

        // TODO: add stop "sound queue" events
    }

    public async RegisterRole(role:DiscordRole):Promise<void>
    {
        if (!BotConfig.registeredRoles)
        {
            BotConfig.registeredRoles = [];
        }

        (<DiscordSnowflake[]>BotConfig.registeredRoles).push(role.id);

        try
        {
            fs.writeFile('./config.json', JSON.stringify(BotConfig));
        }
        catch(e)
        {
            this.Logger.Error(`Failed to register role ${role.name} in the config file. Error: ${e}`);
        }
    }

    public async RegisterUser(user:DiscordGuildMember):Promise<void>
    {
        if (!BotConfig.registeredUsers)
        {
            BotConfig.registeredUsers = [];
        }

        (<any[]>BotConfig.registeredUsers).push({ guild:user.guild.id, user:user.id });

        try
        {
            fs.writeFile('./config.json', JSON.stringify(BotConfig));
        }
        catch(e)
        {
            this.Logger.Error(`Failed to register user ${user.displayName} in the config file. Error: ${e}`);
        }
    }

    public async RemoveDisabledPlugin(name:string):Promise<void>
    {
        if (!BotConfig.disabledPlugins)
        {
            this.Logger.Error(`You can't enable plugin ${name} in the config because it is not there.`);
            return;
        }

        let index:number = (<string[]>BotConfig.disabledPlugins).indexOf(name);
        if (index == -1)
        {
            this.Logger.Error(`You can't enable plugin ${name} in the config because it is not there.`);
            return;
        }

        (<string[]>BotConfig.disabledPlugins).splice(index, 1);
        
        try
        {
            fs.writeFile('./config.json', JSON.stringify(BotConfig));
        }
        catch(e)
        {
            this.Logger.Error(`Failed to enable plugin ${name} in the config file. Error: ${e}`);
        }
    }

    public async SetAvatar(image:Buffer | string):Promise<void>
    {
        this.Logger.Debug('Setting bot avatar!');
        await this.user.setAvatar(image);
    }

    public async UnregisterRole(role:DiscordRole):Promise<void>
    {
        if (!BotConfig.registeredRoles)
        {
            this.Logger.Error(`You can't unregister role ${role.name} in the config because it is not there.`);
            return;
        }

        let index:number = (<DiscordSnowflake[]>BotConfig.registeredRoles).indexOf(role.id);
        if (index == -1)
        {
            this.Logger.Error(`You can't unregister role ${role.name} in the config because it is not there.`);
            return;
        }

        (<DiscordSnowflake[]>BotConfig.registeredRoles).splice(index, 1);
        
        try
        {
            fs.writeFile('./config.json', JSON.stringify(BotConfig));
        }
        catch(e)
        {
            this.Logger.Error(`Failed to unregister role ${role.name} in the config file. Error: ${e}`);
        }
    }

    public async UnregisterUser(user:DiscordGuildMember):Promise<void>
    {
        if (!BotConfig.registeredUsers)
        {
            this.Logger.Error(`You can't unregister user ${user.displayName} in the config because it is not there.`);
            return;
        }

        let index:number = (<any[]>BotConfig.registeredUsers).indexOf({ guild:user.guild.id, user:user.id });
        if (index == -1)
        {
            this.Logger.Error(`You can't unregister user ${user.displayName} in the config because it is not there.`);
            return;
        }

        (<any[]>BotConfig.registeredUsers).splice(index, 1);
        
        try
        {
            fs.writeFile('./config.json', JSON.stringify(BotConfig));
        }
        catch(e)
        {
            this.Logger.Error(`Failed to unregister user ${user.displayName} in the config file. Error: ${e}`);
        }
    }

    ///////////////////////////////////////////////////////////
    /// CLIENT EVENTS
    ///////////////////////////////////////////////////////////

    @ClientEvent('ready')
    protected async HandleReady():Promise<void>
    {
        if (this.m_IsInitialized)
            return;

        await this.m_BotCommands.Initialize(this, this.Logger);

        let disabledPlugins:string[] = [];

        if (BotConfig.disabledPlugins)
        {
            disabledPlugins = BotConfig.disabledPlugins;
        }

        this.m_PluginManager.ScanSubdirs('./plugins/');
        this.m_PluginManager.LoadPlugins({ OnComplete:(plugins:Plugin[], configs:any[], names:string[]) => 
        {
            plugins.forEach((plugin:Plugin, index:number):void =>
            {
                plugin.m_Name = names[index];
                plugin.m_Config = configs[index];
                plugin.Initialize(this, this.Logger);

                if (disabledPlugins.includes(plugin.m_Name))
                {
                    plugin.SetDisabledState(PluginDisabledState.DISABLED_PERMANENT);
                }

                this.Logger.Debug(`Loaded plugin ${plugin.m_Tag}`);
                console.log(`Loaded plugin ${plugin.m_Tag}`);
            });
        }});

        this.GeneratePluginCommandCollisions();

        this.m_IsInitialized = true;

        this.Logger.Debug('Ready');
        console.log('Ready');
    }

    @ClientEvent('message')
    protected async HandleMessage(message:DiscordMessage):Promise<void>
    {
        if (message.author == this.user || message.system || !this.m_IsInitialized || message.author.bot)
            return;

        const result:[ExecuteCommandResult, CommandError] = await this.TryExecuteCommand(message);
        this.DisplayError(message.channel, result[1]);
    }

    ///////////////////////////////////////////////////////////
    /// OTHER
    ///////////////////////////////////////////////////////////

    private GeneratePluginCommandCollisions():void
    {
        // Create a map of all the alias and command collisions. This will be necessary for resolving which plugin should execute a command.
        const plugins:Plugin[] = this.m_PluginManager.GetPlugins<Plugin>();

        for (let i in plugins)
        {
            const outer:Plugin = plugins[i];

            for (let j in plugins)
            {
                if (i == j)
                {
                    continue;
                }

                const inner:Plugin = plugins[j];

                // This should NEVER happen. If it does, we have a serious problem.
                if (outer.m_Tag === inner.m_Tag)
                {
                    this.Logger.Error(`Plugin Tag Collision! Tag: ${outer.m_Tag}`);
                }

                // Two plugins have a collision with their tag alias. If they don't have any command collisions, this is fine.
                if (outer.m_TagAlias === inner.m_TagAlias)
                {
                    this.Logger.Warning(`Plugin Tag Alias Collision! Tag Alias: ${outer.m_TagAlias}`);

                    for (let command of outer.m_CommandRegistry.keys())
                    {
                        if (inner.IsCommand(command))
                        {
                            // We have a command collision. This means that we cannot use the tag alias to use this command
                            // since two plugins with the same tag alias have this command and the bot can't disambiguate which one to execute 
                            this.Logger.Warning(`Plugin Command Collision! Command: ${command}`);

                            if (!this.m_PluginCommandCollisions.has(outer.m_TagAlias))
                            {
                                this.m_PluginCommandCollisions.set(outer.m_TagAlias, []);
                            }

                            (<Command[]>this.m_PluginCommandCollisions.get(outer.m_TagAlias)).push(command);
                        }
                    }
                }
            }
        }
    }

    private async TryExecuteCommand(message:DiscordMessage):Promise<[ExecuteCommandResult, CommandError]>
    {
        const messageWrapper:MessageInfo = 
        { 
            Guild:message.guild, 
            Channel:message.channel, 
            Author:message.author,
            Member:message.member,
            RawContent:message.content, 
            CleanContent:message.cleanContent 
        };

        const parsedCommand:ParsedCommandInfo | undefined = InputParserUtils.ParseTextForCommandInfo(message.content, this.Logger);

        if (parsedCommand == undefined)
        {
            return [ExecuteCommandResult.STOP, CommandError.New(CommandErrorCode.NOT_A_COMMAND)];
        }

        const botResult:[ExecuteCommandResult, CommandError] = await this.TryExecuteBotCommand(messageWrapper, parsedCommand);
        this.DisplayError(message.channel, botResult[1], this.GetErrorContext(botResult[1], parsedCommand));

        // It wasn't a bot command, so lets find out if we have a plugin command
        if (botResult[0] == ExecuteCommandResult.CONTINUE)
        {
            const pluginResult:[ExecuteCommandResult, CommandError] = await this.TryExecutePluginCommand(messageWrapper, parsedCommand);
            this.DisplayError(message.channel, pluginResult[1], this.GetErrorContext(pluginResult[1], parsedCommand));
        }

        return [ExecuteCommandResult.STOP, CommandError.Success()];
    }

    private async TryExecuteBotCommand(messageInfo:MessageInfo, parsedCommand:ParsedCommandInfo):Promise<[ExecuteCommandResult, CommandError]>
    {
        if (this.m_BotCommands.IsCommand(parsedCommand.Tag))
        {
            return await this.m_BotCommands.TryExecuteCommand(messageInfo, parsedCommand);
        }
        // This isn't a bot command and there was nothing after it. This must be an unrecognized command.
        else if (parsedCommand.RawContent === '')
        {
            return [ExecuteCommandResult.STOP, CommandError.New(CommandErrorCode.UNRECOGNIZED_BOT_COMMAND)];
        }

        return [ExecuteCommandResult.CONTINUE, CommandError.Success()];
    }

    private async TryExecutePluginCommand(messageInfo:MessageInfo, parsedCommand:ParsedCommandInfo):Promise<[ExecuteCommandResult, CommandError]>
    {
        // We might have a potential command collision
        if (this.m_PluginCommandCollisions.has(parsedCommand.Tag))
        {
            const commands:Command[] = <Command[]>this.m_PluginCommandCollisions.get(parsedCommand.Tag);
            if (commands.includes(parsedCommand.Command))
            {
                // We have a tag alias and command collision. This means we can't use this command without using the tag.
                return [ExecuteCommandResult.STOP, CommandError.New(CommandErrorCode.PLUGIN_COMMAND_COLLISION)];
            }
        }

        const plugins:Plugin[] = this.m_PluginManager.GetPlugins<Plugin>();
        for (let plugin of plugins)
        {
            if (plugin.IsThisPlugin(parsedCommand.Tag) && plugin.IsCommand(parsedCommand.Command))
            {
                if (plugin.IsDisabled())
                {
                    return [ExecuteCommandResult.STOP, CommandError.New(CommandErrorCode.PLUGIN_DISABLED)];
                }

                return await plugin.TryExecuteCommand(messageInfo, parsedCommand);
            }
        }

        return [ExecuteCommandResult.STOP, CommandError.New(CommandErrorCode.UNRECOGNIZED_PLUGIN_TAG)];
    }

    private GetErrorContext(error:CommandError, parsedCommand:ParsedCommandInfo):any
    {
        const errorContext:any = error.Context != undefined ? error.Context : {};
        let context:any = undefined;

        const AddContext = (name:string, value:any):any =>
        {
            if (context == undefined)
                context = {};

            if (errorContext[name])
                context[name] = errorContext[name];
            else
                context[name] = value;
        };

        switch(error.ErrorCode)
        {
        case CommandErrorCode.CUSTOM:
            break;
        case CommandErrorCode.INCORRECT_BOT_COMMAND_USAGE:
            AddContext('command', parsedCommand.Tag);
            break;
        case CommandErrorCode.UNRECOGNIZED_BOT_COMMAND:
            AddContext('command', parsedCommand.Tag);
            break;
        case CommandErrorCode.INCORRECT_PLUGIN_COMMAND_USAGE:
            AddContext('tag', parsedCommand.Tag);
            AddContext('command', parsedCommand.Command);
            break;
        case CommandErrorCode.UNRECOGNIZED_PLUGIN_COMMAND:
            AddContext('tag', parsedCommand.Tag);
            AddContext('command', parsedCommand.Command);
            break;
        case CommandErrorCode.PLUGIN_DISABLED:
            AddContext('tag', parsedCommand.Tag);
            break;
        case CommandErrorCode.INSUFFICIENT_BOT_PERMISSIONS:
            break;
        case CommandErrorCode.INSUFFICIENT_USER_PERMISSIONS:
            break;
        case CommandErrorCode.GUILD_ONLY_COMMAND:
            break;
        case CommandErrorCode.PLUGIN_COMMAND_COLLISION:
            AddContext('tag', parsedCommand.Tag);
            AddContext('command', parsedCommand.Command);
            break;
        case CommandErrorCode.PLUGIN_TAG_COLLISION:
            AddContext('tag', parsedCommand.Command);
            break;
        case CommandErrorCode.UNRECOGNIZED_PLUGIN_TAG:
            AddContext('tag', parsedCommand.Tag);
            break;
        case CommandErrorCode.INVALID_ARGUMENT_TYPE:
            // Context should always be provided by the one returning this error as we can't possibly deduce what to use
            // context: type      - The type that was expected (as a string)
            // context: arg       - The arg name that was not properly handled by the user
            // context: value     - The value the user gave for the arg
            AddContext('type', 'NULL');
            AddContext('arg', 'NULL');
            AddContext('value', 'NULL');
            break;
        }

        return context;
    }

    private DisplayError(channel:DiscordChannel, error:CommandError, context?:any):void
    {
        let message:string = '';
        const errorCode:CommandErrorCode = error.ErrorCode;

        switch(errorCode)
        {
        case CommandErrorCode.CUSTOM:
            message = <string>error.CustomMessage;
            break;
        case CommandErrorCode.INCORRECT_BOT_COMMAND_USAGE:
            if (context == undefined)
                this.Logger.Error(`No context was provided for Error ${errorCode}`);

            message = `Incorrect usage of command \`${context.command}\`. Please see the usage to learn how to properly use this command.\nJust Type: \`!usage ${context.command}\``;
            break;
        case CommandErrorCode.UNRECOGNIZED_BOT_COMMAND:
            if (context == undefined)
                this.Logger.Error(`No context was provided for Error ${errorCode}`);

            message = `\`${context.command}\` is not a recognized bot command. For help, just type \`!help bot\``;
            break;
        case CommandErrorCode.INCORRECT_PLUGIN_COMMAND_USAGE:
            if (context == undefined)
                this.Logger.Error(`No context was provided for Error ${errorCode}`);

            message = `Incorrect usage of command \`${context.command}\`. Please see the usage to learn how to properly use this command.\nJust Type: \`!usage ${context.tag} ${context.command}\``;
            break;
        case CommandErrorCode.UNRECOGNIZED_PLUGIN_COMMAND:
            if (context == undefined)
                this.Logger.Error(`No context was provided for Error ${errorCode}`);

            message = `\`${context.command}\` is not a recognized plugin command. For help, just type \`!help ${context.tag}\``;
            break;
        case CommandErrorCode.PLUGIN_DISABLED:
            if (context == undefined)
                this.Logger.Error(`No context was provided for Error ${errorCode}`);

            message = `This plugin is currently disabled. To use commands for this plugin, please enable it first. To enable it, just type \`!enableplugin ${context.tag}\``;
            break;
        case CommandErrorCode.INSUFFICIENT_BOT_PERMISSIONS:
            message = `The bot does not have sufficient permissions to perform this action.`;
            break;
        case CommandErrorCode.INSUFFICIENT_USER_PERMISSIONS:
            message = `You do not have sufficient permissions to perform this action.`;
            break;
        case CommandErrorCode.GUILD_ONLY_COMMAND:
            message = `You can only execute this command from a guild.`;
            break;
        case CommandErrorCode.PLUGIN_COMMAND_COLLISION:
            if (context == undefined)
                this.Logger.Error(`No context was provided for Error ${errorCode}`);

            message = `There is more than one plugin with the tag alias \`${context.tag}\` and command \`${context.command}\` combination. Please use the tag to execute this command.`;
            break;
        case CommandErrorCode.PLUGIN_TAG_COLLISION:
            if (context == undefined)
                this.Logger.Error(`No context was provided for Error ${errorCode}`);

            message = `There is more than one plugin with the tag alias \`${context.tag}\`. Please use the tag instead.`;
            break;
        case CommandErrorCode.UNRECOGNIZED_PLUGIN_TAG:
            if (context == undefined)
                this.Logger.Error(`No context was provided for Error ${errorCode}`);

            message = `There is no plugin with tag or tag alias \`${context.tag}\`. For a list of plugins type \`!help plugins\``;
            break;
        case CommandErrorCode.INVALID_ARGUMENT_TYPE:
            if (context == undefined)
                this.Logger.Error(`No context was provided for Error ${errorCode}`);

            message = `Invalid type for argument \`${context.arg}\`. Expected a \`${context.type}\` but you gave it \`${context.value}\`.`;
        }

        if (message !== '')
        {
            this.SendMessage(channel, message);
        }
    }
};

LoggerUtils.SetVerboseLogging(options.verbose != undefined ? options.verbose : false);
let bot:NyxBot = new NyxBot();
bot.login(BotConfig.token);