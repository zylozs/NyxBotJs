import * as Discord from 'discord.js';
import 'reflect-metadata';
import { EventListenerUtils, EventListener } from './utils/eventlistenerutils';
import { Logger, LoggingEnabled, LoggerUtils } from './utils/loggerutils';
import { BotCommands } from './bot/botcommands';
import { CommandAPI, ExecuteCommandResult, CommandErrorCode } from './command/command';
import { ParsedCommandInfo, InputParserUtils } from './utils/inputparserutils';

const BotConfig = require('./config.json');
const { ClientEvent } = EventListenerUtils;
const commandLineArgs = require('command-line-args');

const optionDefinitions = [
    { name: 'verbose', alias: 'v', type:Boolean }
];

const options = commandLineArgs(optionDefinitions);

// Export a bunch of aliases to make it easier to use these types elsewhere
export type DiscordChannel = Discord.TextChannel | Discord.DMChannel | Discord.GroupDMChannel;
export type DiscordGuild = Discord.Guild;
export type DiscordGuildMember = Discord.GuildMember;
export type DiscordUser = Discord.User;

export interface BotAPI
{
    SendMessage(channel:DiscordChannel, message:string):Promise<void>;
    RequestShutdown():Promise<void>;
}

// Message wrapper
export type MessageInfo = 
{
    Server:DiscordGuild;
    Channel:DiscordChannel;
    Author:DiscordUser;
    RawContent:string;
    CleanContent:string;
};

class NyxBot extends Discord.Client implements BotAPI, EventListener, LoggingEnabled
{
    public Logger:Logger;

    private m_BotCommands:CommandAPI;

    public constructor()
    {
        super();
        this.Logger = new Logger('NyxBot');
        this.m_BotCommands = new BotCommands();
        this.Logger.Verbose('Constructor');

        EventListenerUtils.RegisterEventListeners(this);
    }

    ///////////////////////////////////////////////////////////
    /// BOT API
    ///////////////////////////////////////////////////////////

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
        channel.send(message);
    }

    ///////////////////////////////////////////////////////////
    /// CLIENT EVENTS
    ///////////////////////////////////////////////////////////

    @ClientEvent('ready')
    protected HandleReady():void
    {
        this.m_BotCommands.Initialize(this, this.Logger);

        this.Logger.Debug('Ready');
        console.log('Ready');
    }

    @ClientEvent('message')
    protected async HandleMessage(message:Discord.Message):Promise<void>
    {
        if (message.author == this.user || message.system)
            return;

        // So we can shutdown the bot while developing the command parsing...
        if (message.content === 'shutdown')
        {
            await this.RequestShutdown();
            return;
        }

        const result:[ExecuteCommandResult, CommandErrorCode] = await this.TryExecuteCommand(message);
        this.DisplayError(message.channel, result[1]);
    }

    ///////////////////////////////////////////////////////////
    /// OTHER
    ///////////////////////////////////////////////////////////

    private async TryExecuteCommand(message:Discord.Message):Promise<[ExecuteCommandResult, CommandErrorCode]>
    {
        const messageWrapper:MessageInfo = 
        { 
            Server:message.guild, 
            Channel:message.channel, 
            Author:message.author, 
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
            this.DisplayError(message.channel, pluginResult[1], this.GetErrorContext(botResult[1], parsedCommand));
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
        // TODO: implement

        return [ExecuteCommandResult.STOP, CommandErrorCode.SUCCESS];
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
            context = { command:parsedCommand.Tag };
            break;
        case CommandErrorCode.INSUFFICIENT_BOT_PERMISSIONS:
            break;
        case CommandErrorCode.INSUFFICIENT_USER_PERMISSIONS:
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

            message = `Incorrect usage of command ${context.command}. Please see the usage to learn how to properly use this command.\nJust Type: \`!usage ${context.tag} ${context.command}\``;
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