import { CommandAPI, Tag, Command, CommandErrorCode, CommandMetaData } from '../../command/commandapi';
import { ExtendedBotAPI } from '../../bot/botapi';
import { DiscordChannel } from '../../discord/discordtypes';
import { Plugin } from '../../plugins/plugin';

export class UsageCommandUtils
{
    public static async GetUsage(commandAPI:CommandAPI, bot:ExtendedBotAPI, channel:DiscordChannel, tag:Tag | null, command:Command | null):Promise<CommandErrorCode>
    {
        // Bot commands
        if (tag == null)
        {
            if (command == null)
            {
                await bot.SendMessage(channel, this.GetUsageHowTo());
                command = 'usage';
            }

            if (commandAPI.IsCommand(command)) 
            {
                await bot.SendMessage(channel, this.GetUsageForCommandAPI(commandAPI, command));
            }
            else 
            {
                return CommandErrorCode.UNRECOGNIZED_BOT_COMMAND;
            }
        }
        // Plugin commands
        else
        {
            if (command == null)
            {
                return CommandErrorCode.UNRECOGNIZED_PLUGIN_COMMAND;
            }

            let pluginFound:boolean = false;
            const plugins:Plugin[] = await bot.GetPlugins();

            for (let plugin of plugins)
            {
                const isThisPlugin:boolean = tag === plugin.m_Tag || tag === plugin.m_TagAlias;
                if (isThisPlugin && plugin.IsCommand(command))
                {
                    pluginFound = true;

                    await bot.SendMessage(channel, this.GetUsageForCommandAPI(plugin, command));

                    break;
                }
            }

            if (!pluginFound)
            {
                return CommandErrorCode.UNRECOGNIZED_PLUGIN_COMMAND;
            }
        }

        return CommandErrorCode.SUCCESS;
    }

    private static GetUsageHowTo():string
    {
        let helpStr:string = '__**How to use usage:**__\n';
        helpStr += 'Usage is a command designed to help you understand how to use commands. When you provide a command, it will display the command\'s structure and examples for how to use it.\n\n';

        return helpStr;
    }

    private static GetUsageForCommandAPI(commandAPI:CommandAPI, command:Command):string
    {
        let usageStr:string = `__**Usage for ${command}:**__\n`;
        let commandsStr:string = '';

        // TODO: sort these
        const metaData:CommandMetaData[] = <CommandMetaData[]>commandAPI.m_CommandRegistry.get(command);

        metaData.forEach((data:CommandMetaData, index:number) => 
        {
            if (index != 0)
                commandsStr += '\n';

            commandsStr += `${data.Usage}\n`;
        });

        if (commandsStr === '')
        {
            return 'This command does not have any usage documentation.';
        }
        else
        {
            return usageStr + commandsStr;
        }
    }
}