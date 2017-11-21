import * as Discord from 'discord.js';
import 'reflect-metadata';
import { EventListenerUtils, EventListener } from './utils/eventlistenerutils';
import { Message } from 'discord.js';
import { Logger, LoggingEnabled, LoggerUtils } from './utils/loggerutils';
import { BotCommands } from './bot/botcommands';
import { CommandAPI } from './command/command';

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
    protected async HandleMessage(message:Message):Promise<void>
    {
        if (message.content === 'ping')
        {
            message.reply('pong');
            this.Logger.Debug('pong');
        }
        else if (message.content === 'shutdown')
        {
            await this.RequestShutdown();
        }
    }
};

LoggerUtils.SetVerboseLogging(options.verbose != undefined ? options.verbose : false);
let bot:NyxBot = new NyxBot();
bot.login(BotConfig.token);