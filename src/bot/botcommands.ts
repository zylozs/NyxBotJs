import { Message } from 'discord.js';
import { CommandUtils } from "../utils/commandutils";
import { CommandAPI, Command, VoiceEventHandler, CommandRegistry, ParamParserType } from '../command/command';
import { Logger, LoggingEnabled } from '../utils/loggerutils';
import { BotAPI } from '../nyxbot';
import { PluginCommand, BotCommand, Usage } from '../command/commanddecorator';

export class BotCommands implements CommandAPI, VoiceEventHandler, LoggingEnabled
{
    public Logger:Logger;
    public m_Bot:BotAPI;
    public m_CommandRegistry:CommandRegistry;
    public m_DefaultParser:Function;
    public m_DefaultParserType:ParamParserType;

    public IsCommand(command:Command):boolean
    {
        return this.m_CommandRegistry.has(command);
    }

    public IsReadingMessages(): boolean
    {
        return false;
    }

    public async Initialize(bot:BotAPI, parentContext?:Logger):Promise<void>
    {
        this.Logger = new Logger('BotCommands', parentContext);
        this.m_Bot = bot;
        this.m_DefaultParser = CommandUtils.ParamParserSpaces;
        this.m_DefaultParserType = ParamParserType.SPACES;
    }

    public async ExecuteCommand():Promise<void>
    {

    }

    public async ReadMessage(message:Message):Promise<void>
    {
        // So the compiler stops yelling at me...
        message;
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

    @PluginCommand('Test description', {name:'test'})
    public async TestCommand(ihateyou:boolean, unused:number, variables?:string):Promise<void>
    {
        // So the compiler stops yelling at me...
        ihateyou;
        unused;
        variables;
    }

    @BotCommand('Bots sounds like beep boop', {name:'bots'})
    public async BotCommand(bots:number, arepretty:string, dope:any):Promise<void>
    {
        // So the compiler stops yelling at me...
        bots;
        arepretty;
        dope;
    }

    @Usage(`This is my documentation... WEEEEEEEEEEEEEEEEEEEEE 
            line testtttt.. idk if this will work tho...
            LOOKS LIKE IT DOES... BUT WITH NO AUTOMATIC NEW LINES :(
            jk, it works. also caps are dumb`
    )
    @BotCommand('wooo')
    public async UsageTest():Promise<void>
    {

    }
}