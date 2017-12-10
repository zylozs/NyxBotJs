import { CommandUtils } from "../utils/commandutils";
import { BotCommandAPI, CommandAPI, Command, CommandRegistry, ParamParserType, ExecuteCommandResult, CommandError, CommandErrorCode, Tag, TagAlias } from '../command/commandapi';
import { Logger, LoggingEnabled } from '../utils/loggerutils';
import { ExtendedBotAPI, MessageInfo, VoiceEventHandler } from './botapi';
import { DiscordGuildMember, DiscordVoiceChannel, DiscordUser, DiscordSnowflake, DiscordGuildChannel, Collection } from '../discord/discordtypes';
import { PluginCommand, BotCommand, Usage } from '../command/commanddecorator';
import { ParsedCommandInfo, InputParserUtils } from '../utils/inputparserutils';
import { HelpCommandUtils } from './utils/helpcommandutils';
import { UsageCommandUtils } from './utils/usagecommandutils';
import { ImageUtils } from "../utils/imageutils";

export class BotCommands implements BotCommandAPI, VoiceEventHandler, LoggingEnabled
{
    public Logger:Logger;
    public m_Bot:ExtendedBotAPI;
    public m_Tag:Tag;
    public m_TagAlias:TagAlias;
    public m_CommandRegistry:CommandRegistry;
    public m_DefaultParser:Function;
    public m_DefaultParserType:ParamParserType;
    private m_VoiceStarter:DiscordUser | undefined;

    public IsCommand(command:Command):boolean
    {
        return this.m_CommandRegistry.has(command);
    }

    public IsReadingMessages(): boolean
    {
        return false;
    }

    public async Initialize(bot:ExtendedBotAPI, parentContext?:Logger):Promise<void>
    {
        this.Logger = Logger.CreateLogger(parentContext, 'BotCommands');
        this.m_Bot = bot;
        this.m_Tag = 'bot';
        this.m_TagAlias = 'b';
        this.m_DefaultParser = CommandUtils.ParamParserSpaces;
        this.m_DefaultParserType = ParamParserType.SPACES;
        this.m_VoiceStarter = undefined;

        this.m_Bot.RegisterVoiceEventHandler(this);
        CommandUtils.LoadCommandRegistry(this);
    }

    public async TryExecuteCommand(messageInfo:MessageInfo, parsedCommand:ParsedCommandInfo):Promise<[ExecuteCommandResult, CommandError]>
    {
        const parsedArgs:[string, string[]] | undefined = InputParserUtils.ParseCommandArgs(this.m_CommandRegistry, parsedCommand.Tag, parsedCommand.RawContent, this.m_DefaultParser, this.m_DefaultParserType, this.Logger);
        if (parsedArgs == undefined)
        {
            return [ExecuteCommandResult.STOP, CommandError.New(CommandErrorCode.INCORRECT_BOT_COMMAND_USAGE)];
        }

        // Setup our args
        let args:any[] = [];
        args.push(messageInfo);
        args = args.concat(parsedArgs[1]);

        // Call the command
        const result:CommandError = await (<any>this)[parsedArgs[0]].apply(this, args);

        return [ExecuteCommandResult.STOP, result];
    }

    public async ReadMessage(message:MessageInfo):Promise<void>
    {

    }

    public async Shutdown():Promise<void>
    {

    }

    public async HandleJoinVoiceChannel():Promise<void>
    {

    }

    public async HandleLeaveVoiceChannel():Promise<void>
    {

    }

    ///////////////////////////////////////////////////////////
    /// BOT COMMANDS
    ///////////////////////////////////////////////////////////

    @Usage(
       `Changes the bot's avatar to the image you provide.
        \`!changebotavatar <image_url>\`
        **Example:** \`!changebotavatar www.website.com/url_to_image.png\``
    )
    @BotCommand('Change the bot\s avatar image. Url must be a PNG or JPG image.', { name:'changebotavatar', paramParserType:ParamParserType.ALL })
    private async _ChangeBotAvatar_(messageInfo:MessageInfo, image_url:string):Promise<CommandError>
    {
        let newAvatar:Buffer = await ImageUtils.GetBase64ImageFromUrl(image_url);

        await this.m_Bot.SetAvatar(newAvatar);

        return CommandError.Success();
    }

    @Usage(
       `Changes the bot's server nickname to the name you provide.
        \`!changebotname <name>\`
        **Example:** \`!changebotname He-man, Master of the Universe\``
    )
    @BotCommand('Change the name of the bot to <name>', { name:'changebotname', paramParserType:ParamParserType.ALL })
    private async _ChangeBotName_(messageInfo:MessageInfo, name:string):Promise<CommandError>
    {
        let botMember:DiscordGuildMember = messageInfo.Guild.me;
        try
        {
            await botMember.setNickname(name);
        }
        catch (error)
        {
            return CommandError.New(CommandErrorCode.INSUFFICIENT_BOT_PERMISSIONS);
        }

        return CommandError.Success();
    }

    @Usage(
       `Says hello!
        \`!hello\`
        **Example:** \`!hello\``
    )
    @BotCommand('Say Hello', { name:'hello' })
    private async _Hello_(messageInfo:MessageInfo):Promise<CommandError>
    {
        this.m_Bot.SendMessage(messageInfo.Channel, `Hello <@${messageInfo.Author.id}>`);
        return CommandError.Success();
    }

    @Usage(
       `Displays the basic howto message for the bot. This explains how to use commands.
        \`!help\`
        **Example:** \`!help\``
    )
    @BotCommand('Provides the basic help page', { name:'help' })
    private async _Help_(messageInfo:MessageInfo):Promise<CommandError>
    {
        return await HelpCommandUtils.GetHelp(this, this.m_Bot, messageInfo.Channel, '');
    }

    @Usage(
       `Displays the help for the bot or a specific plugin. This shows the different commands available.
        \`!help <pagename>\`
        **Example for bot:** \`!help bot\`
        **Example for plugin:** \`!help music\``
    )
    @BotCommand('Provides the help page for a specific part of the bot or its plugins', { name:'help' })
    private async _HelpPage_(messageInfo:MessageInfo, pagename:string):Promise<CommandError>
    {
        return await HelpCommandUtils.GetHelp(this, this.m_Bot, messageInfo.Channel, pagename);
    }

    @Usage(
       `Tells the bot to join the voice channel you are currently in.
        \`!join\`
        **Example:** \`!join\``
    )
    @BotCommand('Join the voice channel you are currently in', { name:'join' })
    private async _JoinMe_(messageInfo:MessageInfo):Promise<CommandError>
    {
        if (messageInfo.Member != undefined)
        {
            let channel:DiscordVoiceChannel = messageInfo.Member.voiceChannel;
            if (channel != undefined)
            {
                this.m_VoiceStarter = messageInfo.Author;
                await this.m_Bot.JoinVoiceChannel(channel);
            }
            else
            {
                await this.m_Bot.SendMessage(messageInfo.Channel, 'You are not currently in a voice channel.');
            }
        }
        else
        {
            return CommandError.New(CommandErrorCode.GUILD_ONLY_COMMAND);
        }

        return CommandError.Success();
    }

    @Usage(
       `Tells the bot to join the voice channel with the given name. This is not case sensitive unless there are multiple channels with the same name. If there are multiple channels with the same name you will need to provide the exact, case sensitive, name.
        \`!join <channel>\`
        **Example when not case sensitive:** \`!join general\`
        **Example when case sensitive:** \`!join GeNerAl\``
    )
    @BotCommand('Join voice channel with given name', { name:'join' })
    private async _JoinChannel_(messageInfo:MessageInfo, channel:string):Promise<CommandError>
    {
        if (messageInfo.Member != undefined)
        {
            const channels:Collection<DiscordSnowflake, DiscordGuildChannel> = messageInfo.Guild.channels;
            let duplicateChannels:DiscordGuildChannel[] = [];
            let selectedChannel:DiscordGuildChannel | undefined = undefined;
            
            channels.forEach((guildChannel:DiscordGuildChannel)=>
            {
                if (guildChannel.type === 'voice' && guildChannel.name.toLowerCase() === channel.toLowerCase())
                {
                    duplicateChannels.push(guildChannel);
                }
            });

            if (duplicateChannels.length == 0)
            {
                await this.m_Bot.SendMessage(messageInfo.Channel, `There is no voice channel called \`${channel}\`.`);
                return CommandError.Success();
            }
            else if (duplicateChannels.length == 1)
            {
                selectedChannel = duplicateChannels[0];
            }
            else
            {
                this.Logger.Debug('More than one channel with name found. Picking the channel with the same capitalization.');

                for (let guildChannel of duplicateChannels)
                {
                    if (guildChannel.name === channel)
                    {
                        selectedChannel = guildChannel;
                        break;
                    }
                }
            }

            if (selectedChannel != undefined) 
            {
                this.m_VoiceStarter = messageInfo.Author;
                await this.m_Bot.JoinVoiceChannel(<DiscordVoiceChannel>selectedChannel);
            }
            else
            {
                await this.m_Bot.SendMessage(messageInfo.Channel, 'There is more than one channel with this name. Please use the correct capitalization to join a specific one.');
            }
        }
        else
        {
            return CommandError.New(CommandErrorCode.GUILD_ONLY_COMMAND);
        }

        return CommandError.Success();
    }

    @Usage(
       `Tells the bot to leave the voice channel it is currently in. Only the person who brought it into the voice channel (or an admin) can do this.
        \`!leave\`
        **Example:** \`!leave\``
    )
    @BotCommand('Leave the current voice channel', { name:'leave' })
    private async _Leave_(messageInfo:MessageInfo):Promise<CommandError>
    {
        if (this.m_VoiceStarter == undefined)
        {
            this.m_Bot.SendMessage(messageInfo.Channel, 'I am not connected to any voice channel!');
            return CommandError.Success();
        }

        // TODO: add admin check
        if (messageInfo.Author == this.m_VoiceStarter)
        {
            this.m_VoiceStarter = undefined;
            await this.m_Bot.LeaveVoiceChannel();
        }
        else
        {
            return CommandError.New(CommandErrorCode.INSUFFICIENT_USER_PERMISSIONS);
        }

        return CommandError.Success();
    }

    @Usage(
       `Shuts down the bot. This can only be done by an admin.
        \`!shutdown\`
        **Example:** \`!shutdown\``
    )
    @BotCommand('Shutdown the bot (requires server admin permission)', { name:'shutdown' })
    private async _Shutdown_(messageInfo:MessageInfo):Promise<CommandError>
    {
        await this.m_Bot.RequestShutdown();

        return CommandError.Success();
    }

    @Usage(
       `Provides documentation on usage:
        \`!usage\``
    )
    @BotCommand('Get the basic help page for the usage command', { name:'usage' })
    private async _Usage_(messageInfo:MessageInfo):Promise<CommandError>
    {
        return await UsageCommandUtils.GetUsage(this, this.m_Bot, messageInfo.Channel, null, null);
    }

    @Usage(
       `Provides documentation on the bot command you specify:
        \`!usage <botcommand>\`
        **Example:** \`!usage help\``
    )
    @BotCommand('Shows the usage for a bot command', { name:'usage' })
    private async _UsageBot_(messageInfo:MessageInfo, botcommand:Command):Promise<CommandError>
    {
        return await UsageCommandUtils.GetUsage(this, this.m_Bot, messageInfo.Channel, null, botcommand);
    }

    @Usage(
       `Provides documentation on the plugin command you specify:
        \`!usage <tag> <command>\`
        **Example with plugin tag:** \`!usage troll rickroll\`
        **Example with plugin alias:** \`!usage t rickroll\``
    )
    @BotCommand('Shows the usage for a plugin command', { name:'usage' })
    private async _UsagePlugin(messageInfo:MessageInfo, tag:Tag, command:Command):Promise<CommandError>
    {
        return await UsageCommandUtils.GetUsage(this, this.m_Bot, messageInfo.Channel, tag, command);
    }
}