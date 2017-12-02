const http = require('http');
const https = require('https');

export class ImageUtils
{
    public static async GetBase64ImageFromUrl(imageUrl:string):Promise<any>
    {
        return new Promise((resolve, reject)=>
        {
            const GetImage = (protocol:any) => 
            {
                protocol.get(imageUrl, (resp: any) => 
                {
                    resp.setEncoding('base64');
                    let body: string = "data:" + resp.headers["content-type"] + ";base64,";
                    resp.on('data', (data: any) => { body += data });
                    resp.on('end', () => 
                    {
                        resolve(body);
                    });
                })
                .on('error', (e: Error) => 
                {
                    reject(e);
                });
            }

            let protocol:string[] = imageUrl.split('/');
            if (protocol[0] === 'https:')
            {
                GetImage(https);
            }
            else
            {
                GetImage(http);
            }
        });
    }
}