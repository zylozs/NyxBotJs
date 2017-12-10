import * as Discord from 'discord.js';
import { DiscordVoiceConnection, DiscordChannel, DiscordVoiceChannel, DiscordMessage, DiscordUser, DiscordGuildMember } from './discord/discordtypes';
import { ExtendedBotAPI, MessageInfo, VoiceEventHandler } from './bot/botapi';
import { EventListenerUtils, EventListener } from './utils/eventlistenerutils';
import { Logger, LoggingEnabled, LoggerUtils } from './utils/loggerutils';
import { BotCommands } from './bot/botcommands';
import { BotCommandAPI, CommandAPI, ExecuteCommandResult, CommandErrorCode, Command, Tag, TagAlias } from './command/commandapi';
import { ParsedCommandInfo, InputParserUtils } from './utils/inputparserutils';
import { Plugin } from './plugins/plugin';
import { PluginManager } from './plugins/pluginmanager';

const BotConfig = require('./config.json');
const { ClientEvent } = EventListenerUtils;
const commandLineArgs = require('command-line-args');

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
        // TODO: test for admin permission

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

    public async GetPlugins():Promise<Plugin[]>
    {
        return this.m_PluginManager.GetPlugins<Plugin>();
    }

    public DoesPluginTagAliasHaveCollision(tagAlias:TagAlias):boolean
    {
        return this.m_PluginCommandCollisions.has(tagAlias);
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

    public async SetAvatar(image:Buffer | string):Promise<void>
    {
        this.Logger.Debug('Setting bot avatar!');
        await this.user.setAvatar(image);
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

        this.m_PluginManager.ScanSubdirs('./plugins/');
        this.m_PluginManager.LoadPlugins({ OnComplete:(plugins:Plugin[], names:string[]) => 
        {
            plugins.forEach((plugin:Plugin, index:number):void =>
            {
                plugin.m_Name = names[index];
                plugin.Initialize(this, this.Logger);

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

        const result:[ExecuteCommandResult, CommandErrorCode] = await this.TryExecuteCommand(message);
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

    private async TryExecuteCommand(message:DiscordMessage):Promise<[ExecuteCommandResult, CommandErrorCode]>
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
            return [ExecuteCommandResult.STOP, CommandErrorCode.NOT_A_COMMAND];
        }

        const botResult:[ExecuteCommandResult, CommandErrorCode] = await this.TryExecuteBotCommand(messageWrapper, parsedCommand);
        this.DisplayError(message.channel, botResult[1], this.GetErrorContext(botResult[1], parsedCommand));

        // It wasn't a bot command, so lets find out if we have a plugin command
        if (botResult[0] == ExecuteCommandResult.CONTINUE)
        {
            const pluginResult:[ExecuteCommandResult, CommandErrorCode] = await this.TryExecutePluginCommand(messageWrapper, parsedCommand);
            this.DisplayError(message.channel, pluginResult[1], this.GetErrorContext(pluginResult[1], parsedCommand));
        }

        return [ExecuteCommandResult.STOP, CommandErrorCode.SUCCESS];
    }

    private async TryExecuteBotCommand(messageInfo:MessageInfo, parsedCommand:ParsedCommandInfo):Promise<[ExecuteCommandResult, CommandErrorCode]>
    {
        if (this.m_BotCommands.IsCommand(parsedCommand.Tag))
        {
            return await this.m_BotCommands.TryExecuteCommand(messageInfo, parsedCommand);
        }
        // This isn't a bot command and there was nothing after it. This must be an unrecognized command.
        else if (parsedCommand.RawContent === '')
        {
            return [ExecuteCommandResult.STOP, CommandErrorCode.UNRECOGNIZED_BOT_COMMAND];
        }

        return [ExecuteCommandResult.CONTINUE, CommandErrorCode.SUCCESS];
    }

    private async TryExecutePluginCommand(messageInfo:MessageInfo, parsedCommand:ParsedCommandInfo):Promise<[ExecuteCommandResult, CommandErrorCode]>
    {
        // We might have a potential command collision
        if (this.m_PluginCommandCollisions.has(parsedCommand.Tag))
        {
            const commands:Command[] = <Command[]>this.m_PluginCommandCollisions.get(parsedCommand.Tag);
            if (commands.includes(parsedCommand.Command))
            {
                // We have a tag alias and command collision. This means we can't use this command without using the tag.
                return [ExecuteCommandResult.STOP, CommandErrorCode.PLUGIN_COMMAND_COLLISION];
            }
        }

        const plugins:Plugin[] = this.m_PluginManager.GetPlugins<Plugin>();
        for (let plugin of plugins)
        {
            const isThisPlugin:boolean = parsedCommand.Tag === plugin.m_Tag || parsedCommand.Tag === plugin.m_TagAlias;
            if (isThisPlugin && plugin.IsCommand(parsedCommand.Command))
            {
                // TODO: Check if the plugin is disabled
                //return [ExecuteCommandResult.STOP, CommandErrorCode.PLUGIN_DISABLED];

                return await plugin.TryExecuteCommand(messageInfo, parsedCommand);
            }
        }

        return [ExecuteCommandResult.STOP, CommandErrorCode.UNRECOGNIZED_PLUGIN_COMMAND];
    }

    private GetErrorContext(errorCode:CommandErrorCode, parsedCommand:ParsedCommandInfo):any
    {
        let context:any = undefined;

        switch(errorCode)
        {
        case CommandErrorCode.INCORRECT_BOT_COMMAND_USAGE:
            context = { command:parsedCommand.Tag };
            break;
        case CommandErrorCode.UNRECOGNIZED_BOT_COMMAND:
            context = { command:parsedCommand.Tag };
            break;
        case CommandErrorCode.INCORRECT_PLUGIN_COMMAND_USAGE:
            context = { tag:parsedCommand.Tag, command:parsedCommand.Command };
            break;
        case CommandErrorCode.UNRECOGNIZED_PLUGIN_COMMAND:
            context = { tag:parsedCommand.Tag, command:parsedCommand.Command };
            break;
        case CommandErrorCode.PLUGIN_DISABLED:
            context = { tag:parsedCommand.Tag };
            break;
        case CommandErrorCode.INSUFFICIENT_BOT_PERMISSIONS:
            break;
        case CommandErrorCode.INSUFFICIENT_USER_PERMISSIONS:
            break;
        case CommandErrorCode.GUILD_ONLY_COMMAND:
            break;
        case CommandErrorCode.PLUGIN_COMMAND_COLLISION:
            context = { tag:parsedCommand.Tag, command:parsedCommand.Command };
            break;
        case CommandErrorCode.PLUGIN_TAG_COLLISION:
            context = { tag:parsedCommand.Command };
            break;
        case CommandErrorCode.UNRECOGNIZED_PLUGIN_TAG:
            context = { tag:parsedCommand.Command };
            break;
        }

        return context;
    }

    private DisplayError(channel:DiscordChannel, errorCode:CommandErrorCode, context?:any):void
    {
        let message:string = '';
        switch(errorCode)
        {
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