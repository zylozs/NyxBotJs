import { Plugin } from '../plugin';
import { MessageInfo } from '../../bot/botapi';
import { PluginCommand, Usage } from '../../command/commanddecorator';
import { CommandError } from '../../command/commandapi';

export class TestPlugin extends Plugin
{
    public async InitPlugin():Promise<void>
    {
        this.m_Tag = 'test';
        this.m_TagAlias = 't';
    }

    @Usage(
       `Woof!
        \`!test woof\`
        **Example:** \`!test woof\``
    )
    @PluginCommand('Woof!', { name:'woof' })
    protected async _Woof_(messageInfo:MessageInfo):Promise<CommandError>
    {
        await this.m_Bot.SendMessage(messageInfo.Channel, 'woof!');
        return CommandError.Success();
    }
}