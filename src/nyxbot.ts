import * as Discord from 'discord.js';
import 'reflect-metadata';
import { EventListenerUtils, EventListener } from './utils/eventlistenerutils';
import { Message } from 'discord.js';
import { Logger, LoggingEnabled } from './utils/loggerutils';

const BotConfig = require('./config.json');
const { ClientEvent } = EventListenerUtils;

class NyxBot extends Discord.Client implements EventListener, LoggingEnabled
{
    Logger:Logger;

    public constructor()
    {
        super();
        this.Logger = new Logger('NyxBot');

        EventListenerUtils.RegisterEventListeners(this);
    }

    @ClientEvent('ready')
    protected HandleReady():void
    {
        this.Logger.Debug('Ready');
    }

    @ClientEvent('message')
    protected HandleMessage(message:Message):void
    {
        if (message.content === 'ping')
        {
            message.reply('pong');
            this.Logger.Debug('pong');
        }
        else if (message.content === 'shutdown')
        {
            this.destroy();
            process.exit(0);
        }
    }
};

let bot:NyxBot = new NyxBot();
bot.login(BotConfig.token);