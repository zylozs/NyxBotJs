import * as Discord from 'discord.js';
import 'reflect-metadata';
import { EventListenerUtils, EventListener } from './utils/eventlistenerutils';
import { Message } from 'discord.js';
import { Logger, LoggingEnabled } from './utils/loggerutils';
import { BotCommands } from './bot/botcommands';
import { CommandsAPI } from './utils/commandutils';

const BotConfig = require('./config.json');
const { ClientEvent } = EventListenerUtils;

export interface BotAPI
{

}

class NyxBot extends Discord.Client implements BotAPI, EventListener, LoggingEnabled
{
    public Logger:Logger;

    private m_BotCommands:CommandsAPI;

    public constructor()
    {
        super();
        this.Logger = new Logger('NyxBot');
        this.m_BotCommands = new BotCommands();

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

let bot:NyxBot = new NyxBot();
bot.login(BotConfig.token);