import { Tag, Command } from '../command/command';

export type ParsedCommandInfo =
{
    Tag:Tag;
    Command:Command;
    Args:string;
    RawContent:string;
};

export class InputParserUtils
{
    public static ParseTextForCommandInfo(text:string):ParsedCommandInfo | null
    {
        if (text.startsWith('!'))
        {
            let result:ParsedCommandInfo = { Tag:'', Command:'', Args:'', RawContent:'' };
            let temp:string[] = text.split(' ', 1);
            temp[0] = temp[0].slice(1); // Get rid of !

            // Grab the rest of the string and store it 
            if (temp.length > 1)
                result.RawContent = temp[1];

            result.Tag = temp[0];

            // Split the next space and store it
            temp = result.RawContent.split(' ', 1);
            result.Command = temp[0];

            // Store whatever is left, if any
            if (temp.length > 1)
                result.Args = temp[1];

            return result;
        }

        return null;
    }
}