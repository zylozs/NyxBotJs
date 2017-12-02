import { CommandAPI, Tag, CommandRegistry, ParamParserType, Command, ExecuteCommandResult, CommandErrorCode, TagAlias } from '../command/commandapi';
import { BotAPI, MessageInfo } from '../bot/botapi';
import { Logger, LoggingEnabled } from '../utils/loggerutils';
import { CommandUtils } from '../utils/commandutils';
import { InputParserUtils, ParsedCommandInfo } from '../utils/inputparserutils';

export abstract class Plugin implements CommandAPI, LoggingEnabled
{
    public Logger:Logger;
    public m_Bot:BotAPI;
    public m_Tag:Tag;
    public m_TagAlias:TagAlias;
    public m_CommandRegistry:CommandRegistry;
    public m_DefaultParser:Function;
    public m_DefaultParserType:ParamParserType;

    public IsCommand(command:Command):boolean
    {
        return this.m_CommandRegistry.has(command);
    }

    public IsReadingMessages():boolean
    {
        return false;
    }

    public async Initialize(bot:BotAPI, parentContext?:Logger):Promise<void>
    {
        this.Logger = Logger.CreateLogger(parentContext, `Plugin ${this.m_Tag}`);
        this.m_Bot = bot;
        this.m_Tag = ''
        this.m_TagAlias = '';
        this.m_DefaultParser = CommandUtils.ParamParserSpaces;
        this.m_DefaultParserType = ParamParserType.SPACES;

        CommandUtils.LoadCommandRegistry(this);

        this.InitPlugin();
    }

    protected abstract async InitPlugin():Promise<void>;

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
        const result:CommandErrorCode = await (<any>this)[parsedArgs[0]].apply(this, args);

        return [ExecuteCommandResult.STOP, result];
    }

    public async ReadMessage(message:MessageInfo):Promise<void>
    {

    }

    public async Shutdown():Promise<void>
    {

    }
}