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

    public constructor(context:string, parentContext?:string | Logger)
    {
        this.m_Context = '';
        if (parentContext != undefined)
        {
            if (typeof parentContext === 'string')
            {
                this.m_Context = <string>parentContext;
            }
            else if (parentContext instanceof Logger)
            {
                this.m_Context = (<Logger>parentContext).m_Context;
            }

            this.m_Context += '.';
        }

        this.m_Context += context;
        LoggerUtils.CreateLoggerInstance();
    }

    public Verbose(...args:any[]):void
    {
        LoggerUtils.GetLoggerInstance().Verbose(args.join(' '), { context:this.m_Context });
    }

    public Debug(...args:any[]):void
    {
        LoggerUtils.GetLoggerInstance().Debug(args.join(' '), { context:this.m_Context });
    }

    public Warning(...args:any[]):void
    {
        LoggerUtils.GetLoggerInstance().Warning(args.join(' '), { context:this.m_Context });
    }

    public Error(...args:any[]):void
    {
        LoggerUtils.GetLoggerInstance().Error(args.join(' '), { context:this.m_Context });
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
