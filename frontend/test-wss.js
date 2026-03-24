const WebSocket = require('ws');

const ws = new WebSocket('wss://10.10.10.3:9000/ws', {
    rejectUnauthorized: false
});

ws.on('open', function open() {
    console.log('Connected successfully!');
    ws.close();
});

ws.on('error', function error(err) {
    console.error('Connection error:', err);
});
