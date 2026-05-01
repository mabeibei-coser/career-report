/**
 * 最小化 Custom Server WS PoC（不依赖 Next.js，只验证 ws 包能跑 WS server）
 * 验证通过后，真正的 custom server 会集成 Next.js handler
 */
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('HTTP OK');
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.send(JSON.stringify({ type: 'connected', msg: 'WS echo ready' }));
    ws.on('message', (data) => {
      ws.send(JSON.stringify({ type: 'echo', data: data.toString() }));
    });
  });
});

server.listen(3002, async () => {
  console.log('Test WS server on :3002');

  // 自测
  const ws = new WebSocket('ws://localhost:3002/');
  ws.on('open', () => {
    ws.send('hello');
  });
  ws.on('message', (data) => {
    const d = JSON.parse(data.toString());
    console.log('Received:', d.type, d.data ?? d.msg);
    if (d.type === 'echo') {
      console.log('T1.4 Custom Server PASS');
      ws.close();
      server.close();
      process.exit(0);
    }
  });
  ws.on('error', (e) => {
    console.log('T1.4 FAIL:', e.message);
    process.exit(1);
  });
});

setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 5000);
