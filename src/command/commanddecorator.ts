import { CommandUtils } from '../utils/commandutils';
import { ParamParserType, CommandMetaData, CommandError, CommandErrorCode, CommandAPI, PropertyMetaData } from './commandapi';
import { Logger, LoggingEnabled } from '../utils/loggerutils';
import { TypeUtils } from '../utils/typeutils';

export type CommandInfo = 
{
    name?:string,
    paramParser?:Function,
    paramParserType?:ParamParserType
};

// Parameter decorator that defines meta data for the function to tell the command decorator that it needs
// to convert the value of this property to the proper type before calling the command function
export function ConvertTo(type:string, convertFunc:(value:any) => any | null):ParameterDecorator
{
    return function(target:Object, key:string | symbol, parameterIndex:number):void
    {
        CommandUtils.RegisterPropertyMetaData(target, key, parameterIndex, type, convertFunc);
    };
}

// Shorthand for boolean type conversion
export function ToBool(target:Object, key:string | symbol, parameterIndex:number):void
{
    CommandUtils.RegisterPropertyMetaData(target, key, parameterIndex, 'boolean', TypeUtils.ToBool);
}

// Shorthand for number type conversion
export function ToNum(target:Object, key:string | symbol, parameterIndex:number):void
{
    CommandUtils.RegisterPropertyMetaData(target, key, parameterIndex, 'number', TypeUtils.ToNum);
}

export function PluginCommand(description:string, args?:CommandInfo):MethodDecorator
{
    return function (target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
    {
        CommandUtils.RegisterCommandMetaData(description, target, key, args);

        return DecorateAndCall(target, key, descriptor);
    };
}

// It is the same as a plugin command in every way, it is just to have a different decorator name to easily
// distinguish between the two when reading code
export function BotCommand(description:string, args?:CommandInfo):MethodDecorator
{
    return function (target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
    {
        CommandUtils.RegisterCommandMetaData(description, target, key, args);

        return DecorateAndCall(target, key, descriptor);
    };
}

function DecorateAndCall(target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
{
    let originalValue:any = descriptor.value;
    descriptor.value = function (...args:any[])
    {
        // Iterate through the property decorators and do the type conversions
        const propertyMetaData:PropertyMetaData[] = Reflect.getMetadata(CommandUtils.PROPERTY_METADATA_KEY, target, key) || [];

        for (let metaData of propertyMetaData)
        {
            let result:any = metaData.ConvertFunction(args[metaData.Index])

            // If we fail any conversions, return with an error instead of calling the function
            if (result == null)
            {
                // Get the argument name so we can give a more descriptive error
                let argName:string | null = CommandUtils.GetParameterNameByIndex(target, key, metaData.Index - 1);
                argName == null && (argName = 'NULL');

                return CommandError.New(CommandErrorCode.INVALID_ARGUMENT_TYPE, { type:metaData.Type, arg:argName, value:args[metaData.Index] });
            }

            args[metaData.Index] = result;
        }

        (<LoggingEnabled>this).Logger.AddAdditionalContext(key);
        let result:any = originalValue.apply(this, args);
        (<LoggingEnabled>this).Logger.RemoveAdditionalContext();
        return result;
    };

    return descriptor;
}

export function Usage(usage:string):MethodDecorator
{
    return function (target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
    {
        let metaData:CommandMetaData[] = Reflect.getMetadata(CommandUtils.COMMAND_REGISTRY_KEY, target);
        let logger: Logger = new Logger('Usage Decorator');
        const error:Function = (target:any, key:string, logger:Logger) =>
        {
            logger.Error(`${target.constructor.name}.${key} has a usage decorator but is not a Plugin or Bot Command. Please make sure that it is a Plugin or Bot Command and that the usage decorator is above the command decorator.`);
            throw EvalError(`Improper use of Usage Decorator on ${target.constructor.name}.${key}`);
        };

        if (metaData == undefined)
        {
            error(target, key, logger);
        }

        for (let data of metaData)
        {
            if (data.FunctionName == key)
            {
                data.Usage = usage.replace(/\s\s+/g, '\n');
                logger.Verbose(JSON.stringify(data));
                return descriptor;
            }
        }

        error(target, key, logger);
        return descriptor;
    };
}