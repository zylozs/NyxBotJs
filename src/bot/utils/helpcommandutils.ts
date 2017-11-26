import { DiscordChannel, BotAPI } from "../../nyxbot";
import { Command, CommandAPI } from "../../command/command";
import { CommandUtils } from "../../utils/commandutils";

export class HelpCommandUtils
{
    public static async GetHelp(commandAPI:CommandAPI, bot:BotAPI, channel:DiscordChannel, command:Command, modifier?:Function):Promise<void>
    {
        const ApplyModifier = (message:string):string => {
            if (modifier != undefined)
                return modifier(message);
            return message;
        }

        if (command === '')
        {
            await bot.SendMessage(channel, ApplyModifier(this.GetHelpHowTo()));
        }
        else if (command === 'all')
        {
            await bot.SendMessage(channel, ApplyModifier(this.GetHelpBot(commandAPI)));

            // TODO: implement plugin help here
        }
        else if (command === 'bot')
        {
            await bot.SendMessage(channel, ApplyModifier(this.GetHelpBot(commandAPI)));
        }
        else if (command === 'plugin' || command === 'plugins' || command === 'tags')
        {
            await bot.SendMessage(channel, ApplyModifier(this.GetHelpPluginTags()));
        }
        else
        {
            // TODO: implement plugin help here
        }
    }

    private static GetHelpBot(commandAPI:CommandAPI):string
    {
        let helpStr:string = '__**Basic Commands:**__\n';
        let commands:string[] = CommandUtils.GetCommandHelp(commandAPI.m_CommandRegistry);

        for(let command of commands)
            helpStr += command + '\n';

        return helpStr;
    }

    private static GetHelpHowTo():string
    {
        let helpStr = '__**How to use commands:**__\n'
        helpStr += 'The command structure is like this: `!<tag> <command> <arguments>`\n\n'
        helpStr += 'You must always start with an `!` and this is immediately followed with a `tag`. Each plugin has its own specific tag which you have to use to execute one of its commands. These tags are *unique* and no two plugins will have the same one.\n\n'
        helpStr += 'Since these tags can get long and tedious, each plugin also has an `alias`. You can use this instead of the tag to reduce typing. If two plugins have the same alias, you will have to use the tag.\n\n'
        helpStr += 'Plugins might also have commands. This is what follows the tag, separated with a space. See the help page for a Plugin to know what commands it has.\n\n'
        helpStr += 'Some commands don\'t require any additional arguments, to learn more about how commands are used, type `!usage`\n\n'
        helpStr += 'The bot also has special commands which follow a slightly different command structure than plugins. They are just `!<command>`. These are unique to the bot itself and a plugin will never do this.\n\n'
        helpStr += '**Example plugin command 1:** `!music play`\n'
        helpStr += '**Example plugin command 2:** `!m queue throughthefireandflames`\n'
        helpStr += '**Example bot command:** `!hello`\n\n'
        helpStr += '__**More help:**__\n'
        helpStr += 'To see which commands the bot has, type `!help bot`\n'
        helpStr += 'To see which plugins the bot has, type `!help plugins` or `!help tags`\n'
        helpStr += 'To see which commands a plugin has, type `!help <tag>` or `!help <alias>`\n'
        helpStr += 'To see all commands available for the bot and all plugins, type `!help all`\n\n'
        return helpStr;
    }

    private static GetHelpPluginTags():string
    {
        // TODO: implement

        return '';
    }
}