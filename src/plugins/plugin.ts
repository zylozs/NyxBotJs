import { CommandAPI, Tag, CommandRegistry, ParamParserType, Command, ExecuteCommandResult, CommandErrorCode, TagAlias, CommandError } from '../command/commandapi';
import { BotAPI, MessageInfo } from '../bot/botapi';
import { Logger, LoggingEnabled } from '../utils/loggerutils';
import { CommandUtils } from '../utils/commandutils';
import { InputParserUtils, ParsedCommandInfo } from '../utils/inputparserutils';
import { DiscordPermissionResolvable } from '../discord/discordtypes';

export enum PluginDisabledState
{
    ENABLED = 0,
    DISABLED_TEMPORARY,
    DISABLED_PERMANENT 
}

export abstract class Plugin implements CommandAPI, LoggingEnabled
{
    public Logger:Logger;
    public m_Bot:BotAPI;
    public m_Name:string;
    public m_Tag:Tag;
    public m_TagAlias:TagAlias;
    public m_Config:any;
    public m_CommandRegistry:CommandRegistry;
    public m_DefaultParser:Function;
    public m_DefaultParserType:ParamParserType;

    private m_DisabledState:PluginDisabledState;

    public IsDisabled():boolean { return this.m_DisabledState != PluginDisabledState.ENABLED; }
    public GetDisabledState():PluginDisabledState { return this.m_DisabledState; }
    public SetDisabledState(value:PluginDisabledState):void { this.m_DisabledState = value; }

    public IsThisPlugin(tag:Tag | TagAlias) { return tag === this.m_Tag || tag === this.m_TagAlias; }

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
        this.m_DisabledState = PluginDisabledState.ENABLED;

        CommandUtils.LoadCommandRegistry(this);

        this.InitPlugin();

        this.Logger.Debug(`Initialized plugin ${this.m_Tag}`);
    }

    protected abstract async InitPlugin():Promise<void>;

    public async TryExecuteCommand(messageInfo:MessageInfo, parsedCommand:ParsedCommandInfo):Promise<[ExecuteCommandResult, CommandError]>
    {
        const parsedArgs:[string, string[]] | undefined = InputParserUtils.ParseCommandArgs(this.m_CommandRegistry, parsedCommand.Command, parsedCommand.Args, this.m_DefaultParser, this.m_DefaultParserType, this.Logger);
        if (parsedArgs == undefined)
        {
            return [ExecuteCommandResult.STOP, CommandError.New(CommandErrorCode.INCORRECT_PLUGIN_COMMAND_USAGE)];
        }

        // Check permissions if the command came from a guild channel
        const permissions:[number, DiscordPermissionResolvable[]] = CommandUtils.GetCommandPermissionFlags(this.m_CommandRegistry, parsedCommand.Command, parsedArgs[0]);
        if (messageInfo.Member && !await this.m_Bot.HasPermission(messageInfo.Member, permissions[0], permissions[1]))
        {
            return [ExecuteCommandResult.STOP, CommandError.New(CommandErrorCode.INSUFFICIENT_USER_PERMISSIONS)];
        }

        // Setup our args
        let args:any[] = [];
        args.push(messageInfo);
        args = args.concat(parsedArgs[1]);

        // Call the command
        const result:CommandError = await (<any>this)[parsedArgs[0]].apply(this, args);

        return [ExecuteCommandResult.STOP, result];
    }

    public async ReadMessage(message:MessageInfo):Promise<void>
    {

    }

    public async Shutdown():Promise<void>
    {

    }
}