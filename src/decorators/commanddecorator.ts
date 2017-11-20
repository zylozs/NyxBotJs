import { CommandMetaData, CommandUtils, ParamParserType, Command } from '../utils/commandutils';
import { Logger } from '../utils/loggerutils';
const GetParameterNames = require('get-parameter-names');

export type CommandInfo = {
    name?:string,
    paramParser?:Function,
    paramParserType?:ParamParserType
};

export function PluginCommand(description:string, args?:CommandInfo):MethodDecorator
{
    return function (target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
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
        const temp:CommandMetaData = {
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

        let logger:Logger = new Logger('Plugin Command Decorator');
        logger.Debug(JSON.stringify(temp));

        commandRegistry.push(temp);
        Reflect.defineMetadata(CommandUtils.COMMAND_REGISTRY_KEY, commandRegistry, target);

        return descriptor;
    }
}

// Conceptually the same as a plugin command, it is just to have a different decorator name to easily
// distinguish between the two
/*export function BotCommand(description:string, ...args:any[])
{
    return function (target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
    {

    }
}*/