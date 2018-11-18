const fs    = require('fs');
const path  = require('path');

type FactoryFunction = (callback:Function) => any;

export type PluginLoadOptions = 
{
    // The name/names of the plugins you want to load
    Name?:string | string[];
    // Whether to load multiple plugins or only the first one found. This will default to true if not defined.
    Multi?:boolean;
    // Error handler
    OnError?:(error:Error, info:any) => void;
    // When its done loading all the plugins
    OnComplete?:(pluginInstances:any[], pluginConfigs:any[], pluginNames:string[]) => void;
};

enum PluginConfigConstants
{
    NAME = 'name',
    FILE = 'file',
    CLASS = 'class'
};

type PluginName = string;

class PluginModule
{
    private m_BaseDirectory:string;
    private m_Filename:string;
    private m_ClassType:string;
    private m_PluginFactory:Function;
    private m_Config:any;

    public constructor(dir:string, filename:string, classType:string, config:any)
    {
        this.m_BaseDirectory = dir;
        this.m_Filename = filename;
        this.m_ClassType = classType;
        this.m_Config = config;

        this.LoadPluginFactory();
    }

    private LoadPluginFactory():void
    {
        let module:any = undefined;
        let moduleFile:string = '';

        moduleFile = path.resolve(this.m_BaseDirectory, this.m_Filename);

        try
        {
            module = require(moduleFile);
        }
        catch (e)
        {
            // ignored
        }

        if (module != undefined && module[this.m_ClassType] != undefined)
        {
            this.m_PluginFactory = ():any => { return new module[this.m_ClassType]; }
        }
    }

    public PluginFactory():any
    {
        return this.m_PluginFactory != undefined ? this.m_PluginFactory() : null;
    }

    public static Factory(dir:any, file:string, classType:string, config:any):FactoryFunction
    {
        let plugin:PluginModule = new PluginModule(dir, file, classType, config);

        let factory:FactoryFunction = (callback:(error:Error | null, instance:any, config:any, filepath:string)=>any):any =>
        {
            let pluginInstance:any = plugin.PluginFactory();
            return callback(null, pluginInstance, config, path.join(dir, 'pluginconfig.json'));
        }

        return factory;
    }
}

export class PluginManager
{
    private m_Plugins:Map<PluginName, FactoryFunction>;
    private m_CachedPluginInstances:Map<PluginName, any>;
    private m_CachedPluginConfigs:Map<PluginName, any>;
    private m_CachedPluginConfigFilepaths:Map<PluginName, any>;

    public constructor()
    {
        this.m_Plugins = new Map();
        this.m_CachedPluginInstances = new Map();
        this.m_CachedPluginConfigs = new Map();
        this.m_CachedPluginConfigFilepaths = new Map();
    }

    public GetPlugin<T>(name:string):T { return <T>this.m_CachedPluginInstances.get(name); }
    public GetPlugins<T>():T[] { return <T[]>Array.from(this.m_CachedPluginInstances.values()); }
    public GetPluginConfig(name:string):any { return this.m_CachedPluginConfigs.get(name); }
    public GetPluginConfigs():any[] { return Array.from(this.m_CachedPluginConfigs.values()); }

    public SaveConfigFile(name:string, OnFail:(error:Error)=>void):void
    {
        try
        {
            const filepath:string = this.m_CachedPluginConfigFilepaths.get(name);
            const config:any = this.m_CachedPluginConfigs.get(name);
            fs.writeFile(filepath, JSON.stringify(config));
        }
        catch(e)
        {
            OnFail(e);
        }
    }

    public ScanSubdirs(dirs:string | string[]):this
    {
        if (!Array.isArray(dirs))
        {
            dirs = [dirs];
        }

        for (let dir of dirs)
        {
            let subDirs:string[] = [];

            try
            {
                subDirs = fs.readdirSync(dir);
            }
            catch(e)
            {
                // ignore invalid dirs
                continue;
            }

            subDirs.forEach((subDir:string)=>
            { 
                this.LoadPluginFromDirectory(path.join(dir, subDir));
            });
        }

        return this;
    }

    public LoadPlugins(options?:PluginLoadOptions):this
    {
        if (options == undefined)
        {
            options = {};
        }

        // Default Multi to true if not specified
        if (options.Multi == undefined)
        {
            options.Multi = true;
        }

        let complete = (pluginInstances:any[]) =>
        {
            const error:Error | null = pluginInstances.length == 0 ? new Error('No plugins were loaded.') : null;
            let instances:any[] = [];
            let names:string[] = [];
            let configs:any[] = [];

            pluginInstances.forEach((instance:any)=>
            {
                instances.push(instance.instance);
                names.push(instance.name);
                configs.push(instance.config);

                // Add the new plugin instances to the cache
                this.m_CachedPluginInstances.set(instance.name, instance.instance);
                this.m_CachedPluginConfigs.set(instance.name, instance.config);
                this.m_CachedPluginConfigFilepaths.set(instance.name, instance.filepath);
            });

            if (options != undefined)
            {
                if (error != null && options.OnError != undefined)
                {
                    options.OnError(error, null);
                }

                if (options.OnComplete != undefined)
                {
                    options.OnComplete(instances, configs, names);
                }
            }
        };

        // Backout early if we don't have any plugins
        if (this.m_Plugins.size == 0)
        {
            complete([]);
            return this;
        }

        // Try to instantiate the plugin/s
        if (options.Name)
        {
            const names:string[] = Array.isArray(options.Name) ? options.Name : [options.Name];
            this.InstantiateMultiplePlugins(names, options, complete);
        }
        else
        {
            this.InstantiateMultiplePlugins(Array.from(this.m_Plugins.keys()), options, complete);
        }

        return this;
    }

    private RegisterPlugin(name:string, pluginFactory:FactoryFunction):this
    {
        this.m_Plugins.set(name, pluginFactory);

        return this;
    }

    private InstantiateMultiplePlugins(names:string[], options:PluginLoadOptions, complete:(instances:any[])=>void)
    {
        let instances:any[] = [];

        for (let name of names)
        {
            const newInstance:any = this.InstantiatePlugin(name, options);
            if (newInstance != null)
            {
                instances.push(newInstance);

                if (!options.Multi)
                {
                    break;
                }
            }
        }

        complete(instances);
    }

    private InstantiatePlugin(name:string, options:PluginLoadOptions):any
    {
        let factory:FactoryFunction | undefined = this.m_Plugins.get(name);
        if (factory != undefined)
        {
            let info:any = { name:name };
            return factory((error:Error | null, instance:any, config:any, filepath:string):any =>
            {
                if (error != null && options.OnError != undefined)
                {
                    options.OnError(error, info);
                    return null;
                }

                return { instance:instance, name:name, config:config, filepath:filepath };
            });
        }
        else
        {
            return null;
        }
    }

    private LoadPluginFromDirectory(dir:string):void
    {
        let config:any;

        try
        {
            config = fs.readFileSync(path.join(dir, 'pluginconfig.json'));
            config = JSON.parse(config);
        }
        catch (e)
        {
            // ignore invalid modules
        }

        if (config != undefined)
        {
            let pluginName:string = config[PluginConfigConstants.NAME];
            let pluginFile:string = config[PluginConfigConstants.FILE];
            let pluginClass:string = config[PluginConfigConstants.CLASS];

            this.RegisterPlugin(pluginName, PluginModule.Factory(dir, pluginFile, pluginClass, config));
        }
    }
}