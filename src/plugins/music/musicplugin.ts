import { Plugin } from '../plugin';
import { MessageInfo, VoiceRequest, VoiceEventHandler, VoiceRequestID } from '../../bot/botapi';
import { PluginCommand, Usage } from '../../command/commanddecorator';
import { CommandErrorCode, CommandError } from '../../command/commandapi';
import { DiscordChannel } from '../../discord/discordtypes';

const YoutubeDownloader = require('ytdl-core');

export class MusicPlugin extends Plugin implements VoiceEventHandler
{
    private m_LastUsedChannel:DiscordChannel;
    private m_WasStopped:boolean;

    public async InitPlugin():Promise<void>
    {
        this.m_Tag = 'music';
        this.m_TagAlias = 'm';
        this.m_WasStopped = false;

        this.m_Bot.RegisterVoiceEventHandler(this);
    }

    public async OnJoinVoiceChannel(): Promise<void> {}
    public async OnLeaveVoiceChannel():Promise<void> {}
    public async OnVoiceRequestFinished(request:VoiceRequest):Promise<void> {}
    public async OnVoiceRequestPaused(request:VoiceRequest):Promise<void> {}
    public async OnVoiceRequestResumed(request:VoiceRequest):Promise<void> {}

    public async OnVoiceRequestQueueFinished():Promise<void>
    {
        if (!this.m_WasStopped)
        {
            await this.m_Bot.SendMessage(this.m_LastUsedChannel, `**Song queue finished**`);
        }

        this.m_WasStopped = false;
    }

    public async OnVoiceRequestStarted(request:VoiceRequest):Promise<void>
    {
        this.m_LastUsedChannel = request.requestedChannel;

        await this.m_Bot.SendMessage(request.requestedChannel, `**Playing :notes:** \`${request.url}\``);
    }

    @Usage(
        `Play the current song queue if not already started.
        \`!music play\`
        **Example:** \`!music play\``
    )
    @PluginCommand('Play current song queue.', { name:'play' })
    protected async _Play_(messageInfo:MessageInfo):Promise<CommandError>
    {
        if (this.m_Bot.IsVoiceRequestPlaying())
        {
            return CommandError.Custom(`There is already a song queue playing.`);
        }

        if (!this.m_Bot.HasVoiceRequest())
        {
            return CommandError.Custom(`There aren't any songs in the queue.`);
        }

        if (!this.m_Bot.IsInVoiceChannel())
        {
            return CommandError.Custom(`The bot needs to be in a voice channel to play the song queue.`);
        }

        await this.m_Bot.SendMessage(messageInfo.Channel, '**Playing song queue** :notes:');
        await this.m_Bot.PlayVoiceRequests();
        return CommandError.Success();
    }

    @Usage(
        `Add song to current song queue and play the current song queue if not already started.
        \`!music play <youtubeLink>\`
        **Example:** \`!music play https://www.youtube.com/watch?v=dQw4w9WgXcQ\``
    )
    @PluginCommand('Add song to current song queue.', { name:'play' })
    protected async _PlaySong_(messageInfo:MessageInfo, youtubeLink:string):Promise<CommandError>
    {
        // Try to validate we have a proper youtube url or id and generate a url
        if (!YoutubeDownloader.validateURL(youtubeLink))
        {
            if (YoutubeDownloader.validateID(youtubeLink))
            {
                youtubeLink = `https://www.youtube.com/watch?v=${youtubeLink}`;
            }
            else
            {
                return CommandError.New(CommandErrorCode.INCORRECT_PLUGIN_COMMAND_USAGE);
            }
        }

        const isInVoiceChannel:boolean = this.m_Bot.IsInVoiceChannel();
        const isSongPlaying:boolean = this.m_Bot.IsVoiceRequestPlaying();
        const newRequest:VoiceRequest = 
        { 
            requester:messageInfo.Author, 
            requestedChannel:messageInfo.Channel,
            url: youtubeLink, 
            startPlaying:isInVoiceChannel
        };

        await this.m_Bot.AddVoiceRequest(newRequest);

        if (!isInVoiceChannel || isSongPlaying)
        {
            await this.m_Bot.SendMessage(messageInfo.Channel, `**Queued** :soon: \`${youtubeLink}\``);
        }

        return CommandError.Success();
    }

    @Usage(
        `Stop the current song queue.
        \`!music stop\`
        **Example:** \`!music stop\``
    )
    @PluginCommand('Stop the current song queue.', { name:'stop' })
    protected async _Stop_(messageInfo:MessageInfo):Promise<CommandError>
    {
        if (!this.m_Bot.IsVoiceRequestPlaying() && !this.m_Bot.HasVoiceRequest())
        {
            return CommandError.Custom(`There is no song queue playing.`);
        }

        this.m_WasStopped = true;
        await this.m_Bot.SendMessage(messageInfo.Channel, `**Stopping song queue** :octagonal_sign:`);
        await this.m_Bot.StopAndClearVoiceRequests();
        return CommandError.Success();
    }

    @Usage(
        `Pause the current song.
        \`!music pause\`
        **Example:** \`!music pause\``
    )
    @PluginCommand('Pause the current song.', { name:'pause' })
    protected async _Pause_(messageInfo:MessageInfo):Promise<CommandError>
    {
        if (!this.m_Bot.IsVoiceRequestPlaying())
        {
            return CommandError.Custom(`There is no song currently playing.`);
        }

        if (this.m_Bot.IsVoiceRequestPaused())
        {
            return CommandError.Custom(`The current song is already paused.`);
        }

        await this.m_Bot.SendMessage(messageInfo.Channel, `**Pausing** :pause_button:`);
        await this.m_Bot.PauseCurrentVoiceRequest();
        return CommandError.Success();
    }

    @Usage(
        `Resume the current song if paused.
        \`!music resume\`
        **Example:** \`!music resume\``
    )
    @PluginCommand('Resume the current song if paused.', { name:'resume' })
    protected async _Resume_(messageInfo:MessageInfo):Promise<CommandError>
    {
        if (!this.m_Bot.IsVoiceRequestPlaying())
        {
            return CommandError.Custom(`There is no song currently playing.`);
        }

        if (!this.m_Bot.IsVoiceRequestPaused())
        {
            return CommandError.Custom(`The current song isn't paused.`);
        }

        await this.m_Bot.SendMessage(messageInfo.Channel, `**Resuming** :arrow_forward:`);
        await this.m_Bot.ResumeCurrentVoiceRequest();
        return CommandError.Success();
    }

    @Usage(
        `Skip the current song.
        \`!music skip\`
        **Example:** \`!music skip\``
    )
    @PluginCommand('Skip the current song.', { name:'skip' })
    protected async _Skip_(messageInfo:MessageInfo):Promise<CommandError>
    {
        if (!this.m_Bot.IsVoiceRequestPlaying())
        {
            return CommandError.Custom(`There is no song currently playing.`);
        }

        await this.m_Bot.SendMessage(messageInfo.Channel, `**Skipping** :next_track:`);
        await this.m_Bot.RemoveVoiceRequest(this.m_Bot.GetCurrentVoiceRequestID());
        return CommandError.Success();
    }
}