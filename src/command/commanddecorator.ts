import { CommandUtils } from '../utils/commandutils';
import { ParamParserType, CommandMetaData } from './command';
import { Logger } from '../utils/loggerutils';

export type CommandInfo = 
{
    name?:string,
    paramParser?:Function,
    paramParserType?:ParamParserType
};

export function PluginCommand(description:string, args?:CommandInfo):MethodDecorator
{
    return function (target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
    {
        CommandUtils.RegisterCommandMetaData(description, target, key, args);
        return descriptor;
    }
}

// It is the same as a plugin command in every way, it is just to have a different decorator name to easily
// distinguish between the two when reading code
export function BotCommand(description:string, args?:CommandInfo):MethodDecorator
{
    return function (target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
    {
        CommandUtils.RegisterCommandMetaData(description, target, key, args);
        return descriptor;
    }
}

export function Usage(usage:string):MethodDecorator
{
    return function (target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
    {
        let commandRegistry:CommandMetaData[] = Reflect.getMetadata(CommandUtils.COMMAND_REGISTRY_KEY, target);
        let logger: Logger = new Logger('Usage Decorator');
        const error:Function = (target:any, key:string, logger:Logger) =>
        {
            logger.Error(`${target.constructor.name}.${key} has a usage decorator but is not a Plugin or Bot Command. Please make sure that it is a Plugin or Bot Command and that the usage decorator is above the command decorator.`);
            throw EvalError(`Improper use of Usage Decorator on ${target.constructor.name}.${key}`);
        };

        if (commandRegistry == undefined)
        {
            error(target, key, logger);
        }

        for (let metaData of commandRegistry)
        {
            if (metaData.FunctionName == key)
            {
                metaData.Usage = usage.replace(/\s\s+/g, '\n');
                logger.Verbose(JSON.stringify(metaData));
                return descriptor;
            }
        }

        error(target, key, logger);
        return descriptor;
    }
}