import { Message } from 'discord.js';
import { Logger } from '../utils/loggerutils'
import { BotAPI } from '../nyxbot';

// Aliases
export type Tag = string;
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

export interface CommandAPI
{
    m_Bot:BotAPI;
    m_CommandRegistry:CommandRegistry;
    m_DefaultParser:Function;
    m_DefaultParserType:ParamParserType;

    IsCommand(command:Command):boolean;
    IsReadingMessages():boolean;

    // Async Functions
    Initialize(bot:BotAPI, parentContext?:Logger):Promise<void>;
    ExecuteCommand():Promise<void>;
    ReadMessage(message:Message):Promise<void>;
    Shutdown():Promise<void>
}

export interface VoiceEventHandler
{
    HandleJoinVoiceChannel():Promise<void>;
    HandleLeaveVoiceChannel():Promise<void>;
}