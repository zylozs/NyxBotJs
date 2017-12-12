export class TypeUtils
{
    public static ToBool(value:any):boolean | null
    {
        if (typeof(value) == 'boolean')
        {
            return <boolean>value;
        }
        else if (typeof(value) == 'string')
        {
            if (value.toLowerCase() == 'true')
            {
                return true;
            }
            else if (value.toLowerCase() == 'false')
            {
                return false;
            }

            return null;
        }

        return null;
    }
}