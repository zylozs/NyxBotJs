import { Logger } from '../utils/loggerutils'
import { BotAPI, MessageInfo, ExtendedBotAPI } from '../bot/botapi';
import { ParsedCommandInfo } from '../utils/inputparserutils';

// Aliases
export type Tag = string;
export type TagAlias = string;
export type Command = string;
export type CommandRegistry = Map<Command, Array<CommandMetaData>>;

export type CommandMetaData = 
{
    NumParams:number;
    ParamNames:string[];
    Description:string;
    CommandName:Command;
    FunctionName:string;
    OverrideDefaultParser:boolean;
    ParamParser:Function;
    ParamParserType:ParamParserType;
    Usage:string;
};

export enum ParamParserType
{
    SPACES = 0,
    ALL,
    CUSTOM
}

export enum ExecuteCommandResult
{
    CONTINUE = 0,
    STOP
}

export enum CommandErrorCode
{
    SUCCESS = 0,
    INCORRECT_BOT_COMMAND_USAGE,
    UNRECOGNIZED_BOT_COMMAND,
    INCORRECT_PLUGIN_COMMAND_USAGE,
    UNRECOGNIZED_PLUGIN_COMMAND,
    PLUGIN_DISABLED,
    NOT_A_COMMAND,
    INSUFFICIENT_BOT_PERMISSIONS,
    INSUFFICIENT_USER_PERMISSIONS,
    GUILD_ONLY_COMMAND,
    PLUGIN_COMMAND_COLLISION,
    PLUGIN_TAG_COLLISION,
    UNRECOGNIZED_PLUGIN_TAG,
    CUSTOM
}

export class CommandError
{
    public ErrorCode:CommandErrorCode;
    public Context?:any;
    public CustomMessage?:string;

    public static New(errorCode:CommandErrorCode, context?:any, customMessage?:string):CommandError
    {
        let commandError:CommandError = new CommandError();
        commandError.ErrorCode = errorCode;
        commandError.Context = context;
        commandError.CustomMessage = customMessage;

        return commandError;
    }

    // Shorthand to make it more convenient for custom errors
    public static Custom(customMessage?:string):CommandError
    {
        return CommandError.New(CommandErrorCode.CUSTOM, undefined, customMessage);
    }

    // Shorthand for success since its frequently used
    public static Success(): CommandError
    {
        return CommandError.New(CommandErrorCode.SUCCESS);
    }
}

export interface CommandAPI
{
    m_Bot:BotAPI;
    m_Tag:Tag;
    m_TagAlias:TagAlias;
    m_CommandRegistry:CommandRegistry;
    m_DefaultParser:Function;
    m_DefaultParserType:ParamParserType;

    IsCommand(command:Command):boolean;
    IsReadingMessages():boolean;

    // Async Functions
    Initialize(bot:BotAPI, parentContext?:Logger):Promise<void>;
    TryExecuteCommand(messageInfo:MessageInfo, parsedCommand:ParsedCommandInfo):Promise<[ExecuteCommandResult, CommandError]>;
    ReadMessage(message:MessageInfo):Promise<void>;
    Shutdown():Promise<void>
}

export interface BotCommandAPI extends CommandAPI
{
    m_Bot:ExtendedBotAPI;
    Initialize(bot:ExtendedBotAPI, parentContext?:Logger):Promise<void>;
}