import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { config } from './config.js';
import { createServer as createMcpServer } from './server.js';

const http = createServer(async (req, res) => {
  if (req.url === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  if (req.url !== '/mcp') { res.writeHead(404); res.end('Not found'); return; }
  if (config.bearerToken && req.headers.authorization !== `Bearer ${config.bearerToken}`) { res.writeHead(401, { 'www-authenticate': 'Bearer' }); res.end('Unauthorized'); return; }
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer();
  res.on('close', () => { void transport.close(); void server.close(); });
  try { await server.connect(transport); await transport.handleRequest(req, res); } catch (error) { console.error(error); if (!res.headersSent) { res.writeHead(500); res.end('MCP request failed'); } }
});
http.listen(config.port, config.host, () => console.log(`MCP email server listening on http://${config.host}:${config.port}/mcp`));
