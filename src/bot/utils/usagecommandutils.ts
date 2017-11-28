import { CommandAPI, Tag, Command, CommandErrorCode, CommandMetaData } from '../../command/command';
import { BotAPI, DiscordChannel } from '../../nyxbot';

export class UsageCommandUtils
{
    public static async GetUsage(commandAPI:CommandAPI, bot:BotAPI, channel:DiscordChannel, tag:Tag | undefined, command:Command | undefined):Promise<CommandErrorCode>
    {
        // Bot commands
        if (tag == undefined)
        {
            if (command == undefined)
            {
                await bot.SendMessage(channel, this.GetUsageHowTo());
                command = 'usage';
            }

            if (commandAPI.IsCommand(command)) 
            {
                let usageStr:string = `__**Usage for ${command}:**__\n`;
                let commandsStr:string = '';

                // TODO: sort these
                const metaData:CommandMetaData[] = <CommandMetaData[]>commandAPI.m_CommandRegistry.get(command);

                metaData.forEach((data: CommandMetaData, index:number) => 
                {
                    if (index != 0)
                        commandsStr += '\n';

                    commandsStr += `${data.Usage}\n`;
                });

                if (commandsStr === '')
                {
                    await bot.SendMessage(channel, 'This command does not have any usage documentation.');
                }
                else
                {
                    await bot.SendMessage(channel, usageStr + commandsStr);
                }
            }
            else 
            {
                return CommandErrorCode.UNRECOGNIZED_BOT_COMMAND;
            }
        }
        // Plugin commands
        else
        {
            // TODO: implement this when plugins exist
        }

        return CommandErrorCode.SUCCESS;
    }

    public static GetUsageHowTo():string
    {
        let helpStr:string = '__**How to use usage:**__\n';
        helpStr += 'Usage is a command designed to help you understand how to use commands. When you provide a command, it will display the command\'s structure and examples for how to use it.\n\n';

        return helpStr;
    }
}