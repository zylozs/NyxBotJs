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

export type DiscordChannel = Discord.TextChannel | Discord.DMChannel | Discord.GroupDMChannel;

export interface BotAPI
{
    SendMessage(channel:DiscordChannel, message:string):Promise<void>;
    RequestShutdown():Promise<void>;
}

// Message wrapper
export type MessageInfo = 
{
    Server:Discord.Guild;
    Channel:DiscordChannel;
    Author:Discord.User;
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

    public async RequestShutdown():Promise<void>
    {
        // TODO: test for admin permission

        this.m_BotCommands.Shutdown();
        this.destroy();
        process.exit(0);
    }

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

    public async SendMessage(channel:DiscordChannel, message:string):Promise<void>
    {
        // TODO: add checks for things like message length
        this.Logger.Debug(message);
        channel.send(message);
    }

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
            this.Logger.Verbose(`Failed command: ${message.content}`)
            return [ExecuteCommandResult.STOP, CommandErrorCode.UNRECOGNIZED_BOT_COMMAND];
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
            break;
        case CommandErrorCode.INCORRECT_PLUGIN_COMMAND_USAGE:
            context = { tag:parsedCommand.Tag, command:parsedCommand.Command };
            break;
        case CommandErrorCode.UNRECOGNIZED_PLUGIN_COMMAND:
            break;
        case CommandErrorCode.PLUGIN_DISABLED:
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
            message = `That is not a recognized command. For help, just type \`!help\``;
            break;
        case CommandErrorCode.INCORRECT_PLUGIN_COMMAND_USAGE:
            if (context == undefined)
                this.Logger.Error(`No context was provided for Error ${errorCode}`);

            message = `Incorrect usage of command ${context.command}. Please see the usage to learn how to properly use this command.\nJust Type: \`!usage ${context.tag} ${context.command}\``;
            break;
        case CommandErrorCode.UNRECOGNIZED_PLUGIN_COMMAND:
            message = `That is not a recognized command. For help, just type \`!help\``;
            break;
        case CommandErrorCode.PLUGIN_DISABLED:
            message = `This plugin is currently disabled. To use commands for this plugin, please enable it first.`;
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