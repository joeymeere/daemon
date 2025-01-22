import { MemoryServer } from '@spacemangaming/mcp-servers';
const memPort = 6002;
const memProxy = 3002;

try {
    const memServer = new MemoryServer({name: "memory-server"});
    await memServer.init(
        {
            baseUrl: 'https://api.openai.com/v1',
            apiKey: process.env.OPENAI_API_KEY,
            vectorDimensions: 1536
        },
        {socket: {host: 'falkordb', port: 6379}}, 
        {host: 'postgres', port: 5432, user: 'postgres', password: 'postgres', database: 'memserver'}
    );
    await memServer.start(memPort);
    console.log('Memory Server started');
} catch (e) {
    console.error(e); 
}  

// Hono Proxy
import { Hono } from 'hono';
import { cors } from 'hono/cors';
const app = new Hono();

app.use(
    '*',
    cors({
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        exposeHeaders: ['Content-Length']
    })
);

app.get("/health", (c) => {
    return c.text("OK");
})

app.all('*', async (c) => {
    const url = new URL(c.req.url);
    const targetUrl = `http://localhost:${memPort}${url.pathname}${url.search}`;

    try {
        const response = await fetch(targetUrl, {
            method: c.req.method,
            headers: c.req.raw.headers,
            body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : await c.req.blob()
        });

        // Forward the response headers
        const headers = new Headers();
        response.headers.forEach((value, key) => {
            headers.set(key, value);
        });

        return new Response(response.body, {
            status: response.status,
            headers
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return new Response('Proxy Error', { status: 502 });
    }
});

export default {
    port: memProxy,
    fetch: app.fetch
}; // 3000 by default
