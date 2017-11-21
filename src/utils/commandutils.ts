import { CommandInfo } from "../command/commanddecorator";
import { Command, CommandMetaData, ParamParserType } from "../command/command";
import { Logger } from '../utils/loggerutils';
const GetParameterNames = require('get-parameter-names');

export class CommandUtils
{
    public static COMMAND_REGISTRY_KEY:string = 'commandregistry';

    public static ParamParserSpaces(...args:string[]):string[]
    {
        // TODO: implement
        return args;
    }

    public static ParamParserAll(...args:string[]):string[]
    {
        return args;
    }

    public static RegisterCommandMetaData(description:string, target:any, key:string, args?:CommandInfo):void
    {
        let commandRegistry:CommandMetaData[] = Reflect.getMetadata(CommandUtils.COMMAND_REGISTRY_KEY, target) || [];
        const params:string[] = GetParameterNames(target[key]);
        let commandName:Command = key;
        let overrideDefaultParser:boolean = false;
        let paramParser:Function = CommandUtils.ParamParserSpaces;
        let paramParserType:ParamParserType = ParamParserType.SPACES;

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

        let logger:Logger = new Logger('Command Decorator');
        logger.Verbose(JSON.stringify(temp));

        commandRegistry.push(temp);
        Reflect.defineMetadata(CommandUtils.COMMAND_REGISTRY_KEY, commandRegistry, target);
    }
}