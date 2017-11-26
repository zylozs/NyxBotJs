import { Message } from 'discord.js';
import { CommandUtils } from "../utils/commandutils";
import { CommandAPI, Command, VoiceEventHandler, CommandRegistry, ParamParserType, ExecuteCommandResult, CommandErrorCode, Tag } from '../command/command';
import { Logger, LoggingEnabled } from '../utils/loggerutils';
import { BotAPI, MessageInfo, DiscordGuildMember } from '../nyxbot';
import { PluginCommand, BotCommand, Usage } from '../command/commanddecorator';
import { ParsedCommandInfo, InputParserUtils } from '../utils/inputparserutils';

export class BotCommands implements CommandAPI, VoiceEventHandler, LoggingEnabled
{
    public Logger:Logger;
    public m_Bot:BotAPI;
    public m_Tag:Tag;
    public m_CommandRegistry:CommandRegistry;
    public m_DefaultParser:Function;
    public m_DefaultParserType:ParamParserType;

    public IsCommand(command:Command):boolean
    {
        return this.m_CommandRegistry.has(command);
    }

    public IsReadingMessages(): boolean
    {
        return false;
    }

    public async Initialize(bot:BotAPI, parentContext?:Logger):Promise<void>
    {
        this.Logger = new Logger('BotCommands', parentContext);
        this.m_Bot = bot;
        this.m_Tag = 'bot';
        this.m_DefaultParser = CommandUtils.ParamParserSpaces;
        this.m_DefaultParserType = ParamParserType.SPACES;

        CommandUtils.LoadCommandRegistry(this);
    }

    public async TryExecuteCommand(messageInfo:MessageInfo, parsedCommand:ParsedCommandInfo):Promise<[ExecuteCommandResult, CommandErrorCode]>
    {
        const parsedArgs:[string, string[]] | undefined = InputParserUtils.ParseCommandArgs(this.m_CommandRegistry, parsedCommand.Tag, parsedCommand.RawContent, this.m_DefaultParser, this.m_DefaultParserType, this.Logger);
        if (parsedArgs == undefined)
        {
            return [ExecuteCommandResult.STOP, CommandErrorCode.INCORRECT_BOT_COMMAND_USAGE];
        }

        // Setup our args
        let args:any[] = [];
        args.push(messageInfo);
        args = args.concat(parsedArgs[1]);

        // Call the command
        const result:CommandErrorCode = await (<any>this)[parsedArgs[0]].apply(this, args);

        return [ExecuteCommandResult.STOP, result];
    }

    public async ReadMessage(message:Message):Promise<void>
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

    @Usage(
       `Changes the bot's server nickname to the name you provide.
        \`!changebotname <name>\`
        **Example:** \`!changebotname He-man, Master of the Universe\``
    )
    @BotCommand('Change the name of the bot to <name>', { name:'changebotname', paramParserType:ParamParserType.ALL })
    public async _ChangeBotName_(messageInfo:MessageInfo, name:string):Promise<CommandErrorCode>
    {
        let botMember:DiscordGuildMember = messageInfo.Server.me;
        try
        {
            await botMember.setNickname(name);
        }
        catch (error)
        {
            return CommandErrorCode.INSUFFICIENT_BOT_PERMISSIONS;
        }

        return CommandErrorCode.SUCCESS;
    }

    @Usage(
       `Shuts down the bot. This can only be done by an admin.
        \`!shutdown\`
        **Example:** \`!shutdown\``
    )
    @BotCommand('Shutdown the bot (requires server admin permission)', { name:'exit' })
    private async _Shutdown_(messageInfo:MessageInfo):Promise<CommandErrorCode>
    {
        await this.m_Bot.RequestShutdown();

        return CommandErrorCode.SUCCESS;
    }
}