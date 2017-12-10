import { ExtendedBotAPI } from "../../bot/botapi";
import { DiscordChannel } from '../../discord/discordtypes';
import { Command, CommandAPI, Tag, TagAlias, CommandErrorCode, CommandError } from "../../command/commandapi";
import { CommandUtils } from "../../utils/commandutils";
import { Plugin } from '../../plugins/plugin';

export class HelpCommandUtils
{
    public static async GetHelp(commandAPI:CommandAPI, bot:ExtendedBotAPI, channel:DiscordChannel, command:Command, modifier?:Function):Promise<CommandError>
    {
        const ApplyModifier = (message:string):string => 
        {
            if (modifier != undefined)
            {
                return modifier(message);
            }

            return message;
        }

        if (command === '')
        {
            await bot.SendMessage(channel, ApplyModifier(this.GetHelpHowTo()));
        }
        else if (command === 'all')
        {
            await bot.SendMessage(channel, ApplyModifier(this.GetHelpBot(commandAPI)));

            const plugins:Plugin[] = await bot.GetPlugins();
            plugins.forEach(async (plugin:Plugin) =>
            {
                let pluginHelp:string = this.GetHelpPluginHeader(plugin);

                let commands:string[] = CommandUtils.GetCommandHelp(plugin.m_CommandRegistry, plugin.m_Tag);

                commands.forEach((command:string) => 
                {
                    pluginHelp += command + '\n';
                });

                await bot.SendMessage(channel, ApplyModifier(pluginHelp));
            });
        }
        else if (command === 'bot')
        {
            await bot.SendMessage(channel, ApplyModifier(this.GetHelpBot(commandAPI)));
        }
        else if (command === 'plugin' || command === 'plugins' || command === 'tags')
        {
            await bot.SendMessage(channel, ApplyModifier(await this.GetHelpPluginTags(bot)));
        }
        else
        {
            if (bot.DoesPluginTagAliasHaveCollision(command))
            {
                return CommandError.New(CommandErrorCode.PLUGIN_TAG_COLLISION);
            }

            let foundPlugin:boolean = false;
            const plugins:Plugin[] = await bot.GetPlugins();

            for (let plugin of plugins)
            {
                if (command === plugin.m_Tag || command === plugin.m_TagAlias)
                {
                    foundPlugin = true;

                    let pluginHelp:string = this.GetHelpPluginHeader(plugin);

                    let commands:string[] = CommandUtils.GetCommandHelp(plugin.m_CommandRegistry, plugin.m_Tag);

                    commands.forEach((command:string) => 
                    {
                        pluginHelp += command + '\n';
                    });

                    await bot.SendMessage(channel, ApplyModifier(pluginHelp));

                    break;
                }
            }

            if (!foundPlugin)
            {
                return CommandError.New(CommandErrorCode.UNRECOGNIZED_PLUGIN_TAG);
            }
        }

        return CommandError.Success();
    }

    private static GetHelpBot(commandAPI:CommandAPI):string
    {
        let helpStr:string = '__**Basic Commands:**__\n';
        let commands:string[] = CommandUtils.GetCommandHelp(commandAPI.m_CommandRegistry);

        commands.forEach((command:string)=>
        {
            helpStr += command + '\n';
        });

        return helpStr;
    }

    private static GetHelpHowTo():string
    {
        let helpStr:string = '__**How to use commands:**__\n';
        helpStr += 'The command structure is like this: `!<tag> <command> <arguments>`\n\n';
        helpStr += 'You must always start with an `!` and this is immediately followed with a `tag`. Each plugin has its own specific tag which you have to use to execute one of its commands. These tags are *unique* and no two plugins will have the same one.\n\n';
        helpStr += 'Since these tags can get long and tedious, each plugin also has an `alias`. You can use this instead of the tag to reduce typing. If two plugins have the same alias, you will have to use the tag.\n\n';
        helpStr += 'Plugins might also have commands. This is what follows the tag, separated with a space. See the help page for a Plugin to know what commands it has.\n\n';
        helpStr += 'Some commands don\'t require any additional arguments, to learn more about how commands are used, type `!usage`\n\n';
        helpStr += 'The bot also has special commands which follow a slightly different command structure than plugins. They are just `!<command>`. These are unique to the bot itself and a plugin will never do this.\n\n';
        helpStr += '**Example plugin command 1:** `!music play`\n';
        helpStr += '**Example plugin command 2:** `!m queue throughthefireandflames`\n';
        helpStr += '**Example bot command:** `!hello`\n\n';
        helpStr += '__**More help:**__\n';
        helpStr += 'To see which commands the bot has, type `!help bot`\n';
        helpStr += 'To see which plugins the bot has, type `!help plugins` or `!help tags`\n';
        helpStr += 'To see which commands a plugin has, type `!help <tag>` or `!help <alias>`\n';
        helpStr += 'To see all commands available for the bot and all plugins, type `!help all`\n\n';
        return helpStr;
    }

    private static async GetHelpPluginTags(bot:ExtendedBotAPI):Promise<string>
    {
        let helpStr:string = '__**Plugin Tags:**__\n\n';
        helpStr += 'Use `!help <plugintag>` or `!help <pluginalias>` to see which commands a plugin has.\n';
        helpStr += 'To see which commands the bot has, type `!help bot`\n';
        helpStr += 'To see all commands available, type `!help all`\n\n';

        const plugins:Plugin[] = await bot.GetPlugins();
        for (let plugin of plugins)
        {
            // TOOD: handle disabled plugins
            helpStr += `**[${plugin.m_Name}]** Tag: \`${plugin.m_Tag}\` Alias: \`${plugin.m_TagAlias}\`\n`;
        }

        return helpStr;
    }

    private static GetHelpPluginHeader(plugin:Plugin):string
    {
        let helpStr:string = `\n__**${plugin.m_Name} Commands:**__\n`;
        helpStr += `**Tag:** ${plugin.m_Tag}\n`;
        helpStr += `**Alias:** ${plugin.m_TagAlias}\n`;
        helpStr += `**Usage:** \`!usage ${plugin.m_Tag} <command>\` or \`!usage ${plugin.m_TagAlias} <command>\`\n\n`;
        return helpStr;
    }
}