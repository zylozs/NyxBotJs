import 'reflect-metadata';

export type EventListenerMetaData = 
{
    event:string;
    function:string;
};

export interface EventListener {}

export class EventListenerUtils
{
    public static ClientEvent(eventName:string):MethodDecorator
    {
        return function (target:any, key:string, descriptor:PropertyDescriptor):PropertyDescriptor
        {
            let listeners:EventListenerMetaData[] = Reflect.getMetadata('eventlisteners', target) || [];
            listeners.push({event:eventName, function:key});
            Reflect.defineMetadata('eventlisteners', listeners, target);

            return descriptor;
        }
    }

    public static RegisterEventListeners(listener:EventListener):void
    {
        for (const metaData of <EventListenerMetaData[]> Reflect.getMetadata('eventlisteners', listener))
        {
            let callback: (...eventArgs: any[]) => void = (...eventArgs) => (<any> listener)[metaData.function](...eventArgs);
            (<any> listener)['on'](metaData.event, callback);
        }
    }
}