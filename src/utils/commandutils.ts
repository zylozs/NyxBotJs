import { CommandInfo } from "../command/commanddecorator";
import { Command, CommandMetaData, ParamParserType, CommandRegistry, CommandAPI } from "../command/command";
import { Logger } from '../utils/loggerutils';
const GetParameterNames = require('get-parameter-names');

export class CommandUtils
{
    public static COMMAND_REGISTRY_KEY:string = 'commandregistry';

    public static ParamParserSpaces(args:string):string[]
    {
        const splitArgs:string[] = args.split(' ');
        if (splitArgs.length == 1 && splitArgs[0] === '')
            return [];

        return splitArgs;
    }

    public static ParamParserAll(args:string):string[]
    {
        return [args];
    }

    public static RegisterCommandMetaData(description:string, target:any, key:string, args?:CommandInfo):void
    {
        const commandRegistry:CommandMetaData[] = Reflect.getMetadata(CommandUtils.COMMAND_REGISTRY_KEY, target) || [];
        const params:string[] = GetParameterNames(target[key]);
        let commandName:Command = key;
        let overrideDefaultParser:boolean = false;
        let paramParser:Function = CommandUtils.ParamParserSpaces;
        let paramParserType:ParamParserType = ParamParserType.SPACES;
        let logger:Logger = new Logger('Command Decorator');

        if (params.length == 0)
            logger.Error(`Improper command function ${key}. Command functions cannot have 0 parameters`);

        // Strip out the message info from params
        if (params[0].toLowerCase() === 'messageinfo')
            params.shift();
        else
            logger.Error(`Improper command function ${key}. Command functions must have their first parameter be "messageinfo". This parameter is not case sensitive.`);

        if (args != undefined)
        {
            if (args.name != undefined)
                commandName = args.name;

            if (args.paramParser != undefined)
            {
                paramParser = args.paramParser;
                paramParserType = ParamParserType.CUSTOM;
                overrideDefaultParser = true;
            }
            // We don't care about this value if we have a param parser
            else if (args.paramParserType != undefined)
            {
                switch(args.paramParserType)
                {
                case ParamParserType.ALL:
                    paramParser = CommandUtils.ParamParserAll;
                    break;
                case ParamParserType.SPACES:
                    paramParser = CommandUtils.ParamParserSpaces;
                    break;
                }

                paramParserType = args.paramParserType;
                overrideDefaultParser = true;
            }
        }
        const temp:CommandMetaData = 
        {
            Description:description,
            NumParams:params.length, // TEST
            ParamNames:params, // TEST
            CommandName:commandName, 
            FunctionName:key, 
            OverrideDefaultParser:overrideDefaultParser,
            ParamParser:paramParser,
            ParamParserType:paramParserType,
            Usage:'' // Will be added with a separate decorator for ease of reading
        };

        logger.Verbose(JSON.stringify(temp));

        commandRegistry.push(temp);
        Reflect.defineMetadata(CommandUtils.COMMAND_REGISTRY_KEY, commandRegistry, target);
    }

    public static LoadCommandRegistry(target:CommandAPI):void
    {
        let registry:CommandRegistry = new Map();
        let metaData:CommandMetaData[] = Reflect.getMetadata(CommandUtils.COMMAND_REGISTRY_KEY, <any>target) || [];

        for (let data of metaData)
        {
            if (registry.has(data.CommandName))
            {
                (<CommandMetaData[]>registry.get(data.CommandName)).push(data);
            }
            else
            {
                registry.set(data.CommandName, [data]);
            }
        }

        target.m_CommandRegistry = registry;

        let logger:Logger = new Logger(`Load Command Registry ${target.m_Tag}`);
        logger.Verbose(JSON.stringify([...registry]));
    }

    public static GetParamParserAndTypeFromRegistry(commandRegistry:CommandRegistry, command:Command):[ParamParserType, Function] | undefined
    {
        if (!commandRegistry.has(command))
        {
            let logger: Logger = new Logger(`Get Param Parser And Type From Registry`);
            logger.Error(`Failed to get param parser and type from registry because ${command} does not exist in registry.`);
            return undefined;
        }

        let metaData:CommandMetaData[] = <CommandMetaData[]>commandRegistry.get(command);
        let parser:Function = function() {};
        let parserType:ParamParserType = ParamParserType.SPACES;
        let override:boolean = false;

        for (let data of metaData)
        {
            if (data.OverrideDefaultParser)
            {
                override = true;
                parser = data.ParamParser;
                parserType = data.ParamParserType;
            }
        }

        if (!override)
            return undefined;

        return [parserType, parser];
    }
}