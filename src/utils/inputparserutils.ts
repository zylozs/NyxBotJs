import { Tag, Command, CommandRegistry, ParamParserType, CommandMetaData } from '../command/command';
import { Logger } from './loggerutils';
import { CommandUtils } from './commandutils';

export type ParsedCommandInfo =
{
    Tag:Tag;
    Command:Command;
    Args:string;
    RawContent:string;
};

export class InputParserUtils
{
    public static ParseTextForCommandInfo(text:string, logContext?:Logger):ParsedCommandInfo | undefined 
    {
        if (text.startsWith(CommandUtils.GetCommandPrefix()))
        {
            let result:ParsedCommandInfo = { Tag:'', Command:'', Args:'', RawContent:'' };
            let temp:string[] = text.split(' ');

            result.Tag = <string>temp.shift();
            result.Tag = result.Tag.slice(1); // Get rid of !
            
            // Grab the rest of the string and store it 
            if (temp.length > 0)
                result.RawContent = temp.join(' ');

            // Split the next space and store it
            result.Command = <string>temp.shift();

            // Store whatever is left, if any
            if (temp.length > 0)
                result.Args = temp.join(' ');

            let logger: Logger = Logger.CreateLogger(logContext, 'ParseTextForCommandInfo');
            logger.Verbose(`Parsed Command Info: ${JSON.stringify(result)}`);

            return result;
        }

        return undefined;
    }

    public static ParseCommandArgs(commandRegistry:CommandRegistry, command:Command, args:string, defaultParser:Function, defaultParserType:ParamParserType, logContext?:Logger):[string, string[]] | undefined
    {
        let logger:Logger = Logger.CreateLogger(logContext, 'ParseCommandArgs');

        if (!commandRegistry.has(command))
        {
            logger.Error(`You can't parse for command args if the command [${command}] does not exist in the command registry.`);
        }
        else
        {
            let metaData: CommandMetaData[] = <CommandMetaData[]>commandRegistry.get(command);
            let parsedArgs:string[] = defaultParser(args);
            let parserType:ParamParserType = defaultParserType;

            let result:[ParamParserType, Function] | undefined = CommandUtils.GetParamParserAndTypeFromRegistry(commandRegistry, command);

            if (result != undefined)
            {
                parsedArgs = result[1](args);
                parserType = result[0];
                logger.Debug(`Command [${command}] overrode the default parser.`);
            }

            logger.Verbose(`Raw parsed args: ${parsedArgs}`);
            logger.Debug(`Command [${command}] Parsed`);
            logger.Debug(`ParserType: ${ParamParserType[parserType]}`);

            let selectedData:CommandMetaData | undefined = undefined;

            // Determine which function to call based on the number of parameters
            for (let data of metaData)
            {
                if (data.NumParams == parsedArgs.length)
                {
                    selectedData = data;
                    break;
                }
            }

            if (selectedData != undefined)
            {
                if (selectedData.NumParams == 0)
                {
                    logger.Debug('Args: []');
                    return [selectedData.FunctionName, []];
                }

                logger.Debug(`Args: ${parsedArgs}`)
                return [selectedData.FunctionName, parsedArgs];
            }

            logger.Warning(`There are no command overloads for [${command}] with argument length of ${parsedArgs.length}`);
        }

        return undefined;
    }
}