import { CommandAPI, Tag, Command, CommandErrorCode, CommandMetaData, CommandError } from '../../command/commandapi';
import { ExtendedBotAPI } from '../../bot/botapi';
import { DiscordChannel, DiscordPermissionResolvable } from '../../discord/discordtypes';
import { Plugin } from '../../plugins/plugin';
import { PermissionFlags } from '../../command/commanddecorator';

export class UsageCommandUtils
{
    public static async GetUsage(commandAPI:CommandAPI, bot:ExtendedBotAPI, channel:DiscordChannel, tag:Tag | null, command:Command | null):Promise<CommandError>
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
                let usageStr:string = this.GetUsageForCommandAPI(commandAPI, command);

                if (usageStr === '')
                {
                    return CommandError.Custom('This command does not have any usage documentation.');
                }

                await bot.SendMessage(channel, usageStr);
            }
            else 
            {
                return CommandError.New(CommandErrorCode.UNRECOGNIZED_BOT_COMMAND, { command:command });
            }
        }
        // Plugin commands
        else
        {
            if (command == null)
            {
                return CommandError.New(CommandErrorCode.UNRECOGNIZED_PLUGIN_COMMAND, { command:command });
            }

            let pluginFound:boolean = false;
            const plugins:Plugin[] = await bot.GetPlugins();

            for (let plugin of plugins)
            {
                if (plugin.IsThisPlugin(tag) && plugin.IsCommand(command))
                {
                    pluginFound = true;

                    let usageStr:string = this.GetUsageForCommandAPI(plugin, command);

                    if (usageStr === '')
                    {
                        return CommandError.Custom('This command does not have any usage documentation.');
                    }

                    await bot.SendMessage(channel, usageStr);
                    break;
                }
            }

            if (!pluginFound)
            {
                return CommandError.New(CommandErrorCode.UNRECOGNIZED_PLUGIN_COMMAND, { command:command });
            }
        }

        return CommandError.Success();
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

        const metaData:CommandMetaData[] = <CommandMetaData[]>commandAPI.m_CommandRegistry.get(command);

        metaData.forEach((data:CommandMetaData, index:number) => 
        {
            if (index != 0)
            {
                commandsStr += '\n';
            }

            if (data.PermissionFlags & PermissionFlags.ADMIN)
            {
                commandsStr += '**This Command is Admin Only**\n';
            }
            else if (data.PermissionFlags != 0)
            {
                commandsStr += '**Required Permissions:** ';
                let needsSeperator:boolean = false;

                if (data.PermissionFlags & PermissionFlags.ROLE)
                {
                    commandsStr += `${needsSeperator ? ' or ' : ''}\`Registered Role\``;
                    needsSeperator = true;
                }
                if (data.PermissionFlags & PermissionFlags.USER)
                {
                    commandsStr += `${needsSeperator ? ' or ' : ''}\`Registered User\``;
                    needsSeperator = true;
                }
                if (data.PermissionFlags & PermissionFlags.PERMISSION)
                {
                    commandsStr += `${needsSeperator ? ' or ' : ''}\`All of these Discord Permissions: `;
                    needsSeperator = true;

                    if (data.DiscordPermissions && data.DiscordPermissions.length > 0)
                    {
                        for (let i:number = 0; i < data.DiscordPermissions.length; ++i)
                        {
                            const seperator:string = i + 1 < data.DiscordPermissions.length ? ', ' : '';
                            commandsStr += `${data.DiscordPermissions[i]}${seperator}`;
                        };
                    }

                    commandsStr += '\`';
                }

                commandsStr += '\n';
            }

            commandsStr += `${data.Usage}\n`;
        });

        if (commandsStr === '')
        {
            return '';
        }
        else
        {
            return usageStr + commandsStr;
        }
    }
}