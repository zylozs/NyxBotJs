import * as Discord from 'discord.js';
import 'reflect-metadata';
import { EventListenerUtils, EventListener } from './utils/eventlistenerutils';
import { Logger, LoggingEnabled, LoggerUtils } from './utils/loggerutils';
import { BotCommands } from './bot/botcommands';
import { CommandAPI, ExecuteCommandResult } from './command/command';
import { ParsedCommandInfo, InputParserUtils } from './utils/inputparserutils';

const BotConfig = require('./config.json');
const { ClientEvent } = EventListenerUtils;
const commandLineArgs = require('command-line-args');

const optionDefinitions = [
    { name: 'verbose', alias: 'v', type:Boolean }
];

const options = commandLineArgs(optionDefinitions);

export interface BotAPI
{

}

// Message wrapper
export type MessageInfo = 
{
    Server:Discord.Guild;
    Channel:Discord.TextChannel | Discord.DMChannel | Discord.GroupDMChannel;
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
        this.m_BotCommands.Shutdown();
        this.destroy();
        process.exit(0);
    }

    @ClientEvent('ready')
    protected HandleReady():void
    {
        this.Logger.Debug('Ready');
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
        }

        this.TryExecuteCommand(message);
    }

    private TryExecuteCommand(message:Discord.Message):ExecuteCommandResult
    {
        const messageWrapper:MessageInfo = 
        { 
            Server:message.guild, 
            Channel:message.channel, 
            Author:message.author, 
            RawContent:message.content, 
            CleanContent:message.cleanContent 
        };

        const parsedCommand:any = InputParserUtils.ParseTextForCommandInfo(message.content);

        if (parsedCommand == null)
        {
            this.Logger.Debug('Command failed to execute because it isn\'t a valid command');
            this.Logger.Verbose(`Failed command: ${message.content}`)
            return ExecuteCommandResult.FAILURE;
        }

        if (this.m_BotCommands.TryExecuteCommand(messageWrapper, <ParsedCommandInfo>parsedCommand))
        {

        }

        return ExecuteCommandResult.FAILURE;
    }
};

LoggerUtils.SetVerboseLogging(options.verbose != undefined ? options.verbose : false);
let bot:NyxBot = new NyxBot();
bot.login(BotConfig.token);