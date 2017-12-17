import { CommandUtils } from '../utils/commandutils';
import { ParamParserType, CommandMetaData, CommandError, CommandErrorCode, CommandAPI, PropertyMetaData } from './commandapi';
import { Logger, LoggingEnabled } from '../utils/loggerutils';
import { TypeUtils } from '../utils/typeutils';
import { DiscordPermissionResolvable } from '../discord/discordtypes';
import { MessageInfo } from '../bot/botapi';

export type CommandInfo = 
{
    name?:string,
    paramParser?:Function,
    paramParserType?:ParamParserType
};

// Used as bits so we can use bit operations
export enum PermissionFlags
{
    // Only those with the administrator permission on discord can run this command
    ADMIN = 1,
    // Only those with the roles you registered with the bot can run this command
    ROLE = 2,
    // Only the users you registered with the bot in this guild can run this command
    USER = 4,
    // Only the users with the specific discord permission/s can run this command
    PERMISSION = 8
}

// Parameter decorator that defines meta data for the function to tell the command decorator that it needs
// to convert the value of this property to the proper type before calling the command function
export function ConvertTo(type:string, convertFunc:(value:any, messageInfo:MessageInfo) => any | null):ParameterDecorator
{
    return function(target:Object, key:string | symbol, parameterIndex:number):void
    {
        CommandUtils.RegisterPropertyMetaData(target, key, parameterIndex, type, convertFunc);
    };
}

// Shorthand for boolean type conversion
export function ToBool(target:Object, key:string | symbol, parameterIndex:number):void
{
    const ConvertFunc:(value:any, messageInfo:MessageInfo) => any | null = (value:any, messageInfo:MessageInfo):any | null =>
    {
        return TypeUtils.ToBool(value);
    };

    CommandUtils.RegisterPropertyMetaData(target, key, parameterIndex, 'boolean', ConvertFunc);
}

// Shorthand for number type conversion
export function ToNum(target:Object, key:string | symbol, parameterIndex:number):void
{
    const ConvertFunc:(value:any, messageInfo:MessageInfo) => any | null = (value:any, messageInfo:MessageInfo):any | null =>
    {
        return TypeUtils.ToNum(value);
    };

    CommandUtils.RegisterPropertyMetaData(target, key, parameterIndex, 'number', ConvertFunc);
}

// Shorthand for discord role type conversion
export function ToDiscordRole(target:Object, key:string | symbol, parameterIndex:number):void
{
    const ConvertFunc:(value:any, messageInfo:MessageInfo) => any | null = (value:any, messageInfo:MessageInfo):any | null =>
    {
        return TypeUtils.ToDiscordRole(value, messageInfo.Guild);
    };

    CommandUtils.RegisterPropertyMetaData(target, key, parameterIndex, 'DiscordRole', ConvertFunc);
}

// Shorthand for discord guild member type conversion
export function ToDiscordGuildMember(target:Object, key:string | symbol, parameterIndex:number):void
{
    const ConvertFunc:(value:any, messageInfo:MessageInfo) => any | null = (value:any, messageInfo:MessageInfo):any | null =>
    {
        return TypeUtils.ToDiscordGuildMember(value, messageInfo.Guild);
    };

    CommandUtils.RegisterPropertyMetaData(target, key, parameterIndex, 'DiscordGuildMember', ConvertFunc);
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
        // Check if the command is guild only that that we are actually in a guild
        if (CommandUtils.GetIsGuildOnlyCommand(target, key))
        {
            const messageInfo:MessageInfo = <MessageInfo>args[0];
            if (!messageInfo.Guild || !messageInfo.Member)
            {
                return CommandError.New(CommandErrorCode.GUILD_ONLY_COMMAND);
            }
        }

        // Iterate through the property decorators and do the type conversions
        const propertyMetaData:PropertyMetaData[] = Reflect.getMetadata(CommandUtils.PROPERTY_METADATA_KEY, target, key) || [];

        for (let metaData of propertyMetaData)
        {
            let result:any = metaData.ConvertFunction(args[metaData.Index], args[0])

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
        let result:CommandError = originalValue.apply(this, args);
        (<LoggingEnabled>this).Logger.RemoveAdditionalContext();
        return result;
    };

    return descriptor;
}

export function GuildOnly(target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
{
    const metaData:CommandMetaData[] = Reflect.getMetadata(CommandUtils.COMMAND_REGISTRY_KEY, target) || [];
    let logger:Logger = new Logger('Guild Only Decorator');

    for (let data of metaData)
    {
        if (data.FunctionName == key)
        {
            data.GuildOnly = true;
            logger.Verbose(JSON.stringify(data));
            return descriptor;
        }
    }

    logger.Error(`${target.constructor.name}.${key} has a guild only decorator but is not a Plugin or Bot Command. Please make sure that it is a Plugin or Bot Command and that the guild only decorator is above the command decorator.`);
    throw EvalError(`Improper use of Guild OnlyDecorator on ${target.constructor.name}.${key}`);
}

// flags is a bitfield containing the flags defined in the PermissionFlags enum
// permissions is an array of all the discord permissions a user must have to run this command
// For a list of valid permissions, see the discord.js documentation: https://discord.js.org/#/docs/main/stable/class/Permissions?scrollTo=s-FLAGS
export function PermissionConstraint(flags:number, permissions?:DiscordPermissionResolvable[]):MethodDecorator
{
    return function (target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
    {
        const metaData:CommandMetaData[] = Reflect.getMetadata(CommandUtils.COMMAND_REGISTRY_KEY, target) || [];
        let logger:Logger = new Logger('Permission Constraint Decorator');

        if (permissions != undefined)
        {
            // Special case for admin priviledge. Always make sure its in the flags bitfield
            if (permissions.includes('ADMINISTRATOR'))
            {
                flags |= PermissionFlags.ADMIN;
            }

            // Make sure to always have the Permission flag if we have values in the permissions array
            if (permissions.length > 0)
            {
                flags |= PermissionFlags.PERMISSION;
            }
        }

        for (let data of metaData)
        {
            if (data.FunctionName == key)
            {
                data.PermissionFlags = flags;
                data.DiscordPermissions = permissions;
                logger.Verbose(JSON.stringify(data));
                return descriptor;
            }
        }

        logger.Error(`${target.constructor.name}.${key} has a permission constraint decorator but is not a Plugin or Bot Command. Please make sure that it is a Plugin or Bot Command and that the permission constraint decorator is above the command decorator.`);
        throw EvalError(`Improper use of Permission Constraint Decorator on ${target.constructor.name}.${key}`);
    };
}

export function Usage(usage:string):MethodDecorator
{
    return function (target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
    {
        const metaData:CommandMetaData[] = Reflect.getMetadata(CommandUtils.COMMAND_REGISTRY_KEY, target) || [];
        let logger:Logger = new Logger('Usage Decorator');

        for (let data of metaData)
        {
            if (data.FunctionName == key)
            {
                data.Usage = usage.replace(/\s\s+/g, '\n');
                logger.Verbose(JSON.stringify(data));
                return descriptor;
            }
        }

        logger.Error(`${target.constructor.name}.${key} has a usage decorator but is not a Plugin or Bot Command. Please make sure that it is a Plugin or Bot Command and that the usage decorator is above the command decorator.`);
        throw EvalError(`Improper use of Usage Decorator on ${target.constructor.name}.${key}`);
    };
}