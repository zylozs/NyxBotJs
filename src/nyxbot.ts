import * as Discord from 'discord.js';
import 'reflect-metadata';
import { EventListenerUtils, EventListener } from './utils/eventlistenerutils'
import { Message } from 'discord.js';

const BotConfig = require('./config.json');
const { ClientEvent } = EventListenerUtils;

class NyxBot extends Discord.Client implements EventListener
{
    public constructor()
    {
        super();

        EventListenerUtils.RegisterEventListeners(this);
    }

    @ClientEvent('ready')
    protected HandleReady():void
    {
        console.log('Ready');
    }

    @ClientEvent('message')
    protected HandleMessage(message:Message):void
    {
        if (message.content === 'ping')
        {
            message.reply('pong');
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