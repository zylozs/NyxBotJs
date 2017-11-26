import { Message } from 'discord.js';
import { CommandUtils } from "../utils/commandutils";
import { CommandAPI, Command, VoiceEventHandler, CommandRegistry, ParamParserType, ExecuteCommandResult, CommandErrorCode, Tag } from '../command/command';
import { Logger, LoggingEnabled } from '../utils/loggerutils';
import { BotAPI, MessageInfo } from '../nyxbot';
import { PluginCommand, BotCommand, Usage } from '../command/commanddecorator';
import { ParsedCommandInfo, InputParserUtils } from '../utils/inputparserutils';

export class BotCommands implements CommandAPI, VoiceEventHandler, LoggingEnabled
{
    public Logger:Logger;
    public m_Bot:BotAPI;
    public m_Tag:Tag;
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
        this.m_Tag = 'bot';
        this.m_DefaultParser = CommandUtils.ParamParserSpaces;
        this.m_DefaultParserType = ParamParserType.SPACES;

        CommandUtils.LoadCommandRegistry(this);
    }

    public async TryExecuteCommand(messageInfo:MessageInfo, parsedCommand:ParsedCommandInfo):Promise<[ExecuteCommandResult, CommandErrorCode]>
    {
        const parsedArgs:[string, string[]] | undefined = InputParserUtils.ParseCommandArgs(this.m_CommandRegistry, parsedCommand.Tag, parsedCommand.RawContent, this.m_DefaultParser, this.m_DefaultParserType, this.Logger);
        if (parsedArgs == undefined)
        {
            return [ExecuteCommandResult.STOP, CommandErrorCode.INCORRECT_BOT_COMMAND_USAGE];
        }

        // Setup our args
        let args:any[] = [];
        args.push(messageInfo);
        args = args.concat(parsedArgs[1]);

        // Call the command
        await (<any>this)[parsedArgs[0]].apply(this, args);

        return [ExecuteCommandResult.STOP, CommandErrorCode.SUCCESS];
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
    public async TestCommand(messageInfo:MessageInfo, ihateyou:boolean, unused:number, variables?:string):Promise<void>
    {
        if (ihateyou == true)
            await this.m_Bot.SendMessage(messageInfo.Channel, 'true?');

        if (unused > 50)
            await this.m_Bot.SendMessage(messageInfo.Channel, 'counting is hard');

        await this.m_Bot.SendMessage(messageInfo.Channel, `Why are you saying ${<string>variables}?`);
    }

    @BotCommand('Bots sounds like beep boop', {name:'bots'})
    public async BotCommand(messageInfo:MessageInfo, bots:number, arepretty:string, dope:any):Promise<void>
    {
        await this.m_Bot.SendMessage(messageInfo.Channel, 'FOOTBALL');
    }

    @Usage(`This is my documentation... WEEEEEEEEEEEEEEEEEEEEE 
            line testtttt.. idk if this will work tho...
            LOOKS LIKE IT DOES... BUT WITH NO AUTOMATIC NEW LINES :(
            jk, it works. also caps are dumb`
    )
    @BotCommand('wooo')
    public async UsageTest(messageInfo:MessageInfo):Promise<void>
    {
        await this.m_Bot.SendMessage(messageInfo.Channel, 'usage?');
    }

    @Usage(
       `Shuts down the bot. This can only be done by an admin.
        \`!shutdown\`
        **Example:** \`!shutdown\``
    )
    @BotCommand('Shutdown the bot (requires server admin permission)', { name:'exit' })
    private async _Shutdown_(messageInfo:MessageInfo):Promise<void>
    {
        await this.m_Bot.RequestShutdown();
    }
}