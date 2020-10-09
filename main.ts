import spdy, { ServerRequest, ServerResponse } from 'spdy';
import { promises as fs } from 'fs';
import { Agent, request } from 'https';
import { Http2ServerRequest, Http2ServerResponse } from 'http2';

const localAgent = new Agent({
    rejectUnauthorized: false
});

interface Server {
    host: string;
    port: number;
    path: string;
}

const mainServer: Server = {
    host: '127.0.0.1',
    port: 444,
    path: ''
};

const apiServer: Server = {
    host: '127.0.0.1',
    port: 446,
    path: '/api'
};

const servers: Server[] = [mainServer, apiServer];

const proxyHandler = async (
    clientReq: ServerRequest,
    clientRes: ServerResponse
) => {
    const tryServers = [...servers].reverse();
    tryServers.some(server => {
        if (clientReq.url.indexOf(server.path) !== 0) return false;

        const proxyReq = request(
            {
                hostname: server.host,
                port: server.port,
                path: clientReq.url.substring(server.path.length),
                method: clientReq.method,
                headers: clientReq.headers,
                agent: localAgent
            },
            async res => {
                clientRes.writeHead(res.statusCode, res.headers);
                res.pipe(clientRes, { end: true });
            }
        );

        clientReq.pipe(proxyReq, { end: true });
        return true;
    });
};

process.on('uncaughtException', error => {
    switch (error.message) {
        case 'connect ECONNREFUSED': {
            console.warn('Connection refused!');
            break;
        }
        case 'read ECONNRESET': {
            console.warn('Connection reset!');
            break;
        }
        default: {
            console.error(error.message);
        }
    }
});

const main = async () => {
    const host = process.env.HOST || '127.0.0.1';
    const port = Number(process.env.PORT) || 443;

    const [key, cert] = await Promise.all([
        fs.readFile('./server.key'),
        fs.readFile('./server.crt')
    ]);

    spdy.createServer({ key, cert }, proxyHandler).listen(port, host);

    console.log(`[Ready] Listening on ${host}:${port}`);
};

main();
