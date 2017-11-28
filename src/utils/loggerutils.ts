const winston = require('winston');

const nyxBotCustomLevels = {
    levels: {
        Error: 0,
        Warning: 1,
        Debug: 2,
        Verbose: 3
    },
    colors: {
        Error: 'red',
        Warning: 'yellow',
        Debug: 'white',
        Verbose: 'grey'
    }
}

export interface LoggingEnabled
{
    Logger:Logger;
}

export class Logger
{
    private m_Context:string;
    private m_AdditionalContext:string[];

    public constructor(context:string)
    {
        this.m_Context = context;
        this.m_AdditionalContext = [];

        LoggerUtils.CreateLoggerInstance();
    }

    public static CreateLogger(parentContext:string | Logger | undefined, childContext:string):Logger
    {
        if (parentContext != undefined)
        {
            if (typeof parentContext === 'string') 
            {
                return new Logger(`${parentContext}.${childContext}`);
            }
            else if (parentContext instanceof Logger) 
            {
                return parentContext.CreateChildLogger(childContext);
            }
        }

        return new Logger(childContext);
    }

    public CreateChildLogger(childContext:string):Logger
    {
        return new Logger(`${this.m_Context}.${childContext}`);
    }

    public AddAdditionalContext(context:string):void
    {
        this.m_AdditionalContext.push(context);
    }

    public RemoveAdditionalContext():void
    {
        if (this.m_AdditionalContext.length == 0)
        {
            throw RangeError(`You can't remove an additional context when there are none to remove.`);
        }

        this.m_AdditionalContext.pop();
    }

    public GetContext():string
    {
        let context:string = this.m_Context;

        this.m_AdditionalContext.forEach((value: string) => 
        {
            context += `.${value}`;
        });

        return context;
    }

    public Verbose(...args:any[]):void
    {
        LoggerUtils.GetLoggerInstance().Verbose(args.join(' '), { context:this.GetContext() });
    }

    public Debug(...args:any[]):void
    {
        LoggerUtils.GetLoggerInstance().Debug(args.join(' '), { context:this.GetContext() });
    }

    public Warning(...args:any[]):void
    {
        LoggerUtils.GetLoggerInstance().Warning(args.join(' '), { context:this.GetContext() });
    }

    public Error(...args:any[]):void
    {
        LoggerUtils.GetLoggerInstance().Error(args.join(' '), { context:this.GetContext() });
    }
}

export class LoggerUtils
{
    private static m_Logger:any = null;
    // Defaulted to on so that things like decorators can always successfully log. This value gets overriden based on the command line arguments.
    private static m_VerboseLogging:boolean = true;

    public static GetVerboseLogging() { return this.m_VerboseLogging; }
    public static SetVerboseLogging(value:boolean) 
    { 
        this.m_VerboseLogging = value;
        this.m_Logger.transports.log.level = value ? 'Verbose' : 'Debug';
    }

    public static CreateLoggerInstance():void
    {
        // Only create an instance the first time
        if (this.m_Logger != null) 
            return;

        this.m_Logger = new winston.Logger(
        {
            levels: nyxBotCustomLevels.levels,
            colors: nyxBotCustomLevels.colors,
            transports: [
                new (winston.transports.Console)({
                    name: 'console',
                    level: 'Error',
                    formatter: function (options: any): string {
                        return winston.config.colorize(options.level, LoggerUtils.LogFormatter(options));
                    }
                }),
                new (winston.transports.File)({
                    name: 'log',
                    filename: 'nyxbot.log',
                    level: this.m_VerboseLogging ? 'Verbose' : 'Debug',
                    json: false,
                    formatter: LoggerUtils.LogFormatter
                })
            ]
        });
    }

    public static GetLoggerInstance():any
    {
        return this.m_Logger;
    }

    public static LogFormatter(options: any): string
    {
        const time:string = new Date().toLocaleString();
        const level:string = options.level.toUpperCase();
        const context:string = options.meta.context;
        const message:string = options.message;

        return `[${time}] [${level}] [${context}]: ${message}`;
    }
}
