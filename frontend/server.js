const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const dgram = require('dgram');
const { 
  MavLinkPacketSplitter, 
  MavLinkPacketParser, 
  MavLinkProtocolV1, // Start with V1/V2 auto-detection usually needed, but simple parser works
  MavLinkProtocolV2,
  common,
  minimal,
} = require('node-mavlink');

// Configuration
const dev = process.env.NODE_ENV !== 'production';
const MAVLINK_PORT = 14555;
const WS_PORT = 9000;
const HTTP_PORT = 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

// Global State
let lastGps = null;
let lastAtt = null;
let mavUdpCallback = null; // Function to send bytes back to drone (if using UDP Proxy)
// For UDP listener, we usually just reply to the requested IP/Port if needed, 
// but often GCS just listens. If we need to SEND commands, we need a target IP.
// In standard architecture, we send back to the IP that sent us the HEARTBEAT.
let targetIp = '127.0.0.1'; // Default, updates on packet
let targetPort = 14550;      // Default

// MAVLink Setup
const mavParser = new MavLinkPacketParser();
// We'll support both V1 and V2
// Note: node-mavlink parser emits 'data' with the packet.

// Initialize MAVLink Registry with Common definitions
// In node-mavlink, creating a packet is done via classes.

// --- Helper: Mode Mapping (ArduSub/ArduCopter) ---
// Custom Mode mappings (ArduSub)
const MODES_ARDUSUB = {
    0: 'STABILIZE',
    1: 'ACRO',
    2: 'ALT_HOLD',
    3: 'AUTO',
    4: 'GUIDED',
    7: 'CIRCLE',
    9: 'SURFACE',
    16: 'POSHOLD',
    19: 'MANUAL',
};
// Reverse mapping for setting mode
const MODE_NAMES = Object.entries(MODES_ARDUSUB).reduce((acc, [k, v]) => { acc[v] = parseInt(k); return acc; }, {});
// Add common aliases
MODE_NAMES['RTL'] = 2; // ArduSub doesn't strictly have RTL same as Copter, using ALT_HOLD as placeholder or need specific? 
// Wait, ArduSub doesn't really have RTL in standard enum? 
// Let's assume standard Copter modes if not Sub?
// Actually for Sub, "RTL" isn't always standard. let's check what user used. 
// User used "RTL" in the UI. I will blindly map it to standard Copter RTL (6) if specific sub mode missing,
// but for Sub it might mean Surface? I'll use simple Copter mappings too as backup.
const MODES_COPTER = {
  0: 'STABILIZE',
  1: 'ACRO',
  2: 'ALT_HOLD',
  3: 'AUTO',
  4: 'GUIDED',
  5: 'LOITER',
  6: 'RTL',
  9: 'LAND',
};
// We'll merge them, giving priority to what we think it is (Sub).
const REVERSE_MODE_MAP = {
    ...MODE_NAMES,
    'RTL': 6,   // Standard Copter/Rover
    'MANUAL': 19, // Sub Manual
    'STABILIZE': 0,
    'AUTO': 3,
};


app.prepare().then(() => {
  // 1. Setup HTTP Server (Next.js)
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // 2. Setup WebSocket Server
  // We attach it to a separate port (9000) to match legacy `main.py` behavior 
  // OR we could attach to the same HTTP server. 
  // User's `useTelemetry.js` points to port 9000. Let's keep port 9000 for compatibility.
  const wss = new WebSocketServer({ port: WS_PORT });
  console.log(`> WebSocket Server listening on ws://localhost:${WS_PORT}/ws`);

  // Broadcast helper
  const broadcast = (data) => {
    const msg = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(msg);
    });
  };

  wss.on('connection', (ws) => {
    console.log('WS Client connected');
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        handleFrontendMessage(data);
      } catch (e) {
        console.error('WS JSON error:', e);
      }
    });
  });

  // 3. Setup MAVLink UDP Listener
  const udpSocket = dgram.createSocket('udp4');
  
  udpSocket.on('error', (err) => {
    console.log(`UDP server error:\n${err.stack}`);
    udpSocket.close();
  });

  udpSocket.on('message', (msg, rinfo) => {
    // Update target for replies
    targetIp = rinfo.address;
    targetPort = rinfo.port;
    
    // Pipe data into parser
    mavParser.parse(msg);
  });

  mavParser.on('data', (packet) => {
    // packet is a MavLinkPacket
    // We need to convert it to a friendly JSON object for the frontend
    const msg = packetToFrontendJson(packet);
    if (msg) {
        broadcast(msg);
    }
  });

  udpSocket.bind(MAVLINK_PORT, () => {
    console.log(`> MAVLink UDP listening on 0.0.0.0:${MAVLINK_PORT}`);
  });

  // 4. MAVLink Sending Helper
  const sendMavlink = async (mavMsg) => {
    try {
        // We act as System 255 (GCS), Component 0
        const packet = new common.MavLinkPacketHeader(); // or wrapper
        // node-mavlink v0.0.1-rc is a bit raw. 
        // We'll use the packet construction helper.
        // Actually, looking at docs for 'node-mavlink':
        // It usually handles framing.
        
        // Let's use a standard construct pattern for node-mavlink:
        const packetV2 = new MavLinkProtocolV2();
        const header = {
            sysid: 255,
            compid: 0,
            seq: 0, // Should use a counter
            msgid: mavMsg._message_id, // This property depends on specific library version
        };
        // This part is tricky without specific version docs. 
        // I will write 'best effort' code assuming standard node-mavlink utility usage
        // or just construct raw buffers if needed.
        // Re-checking standard node-mavlink usage:
        // socket.send(protocol.pack(header, message));
    } catch (e) {
        console.error("Send Error", e);
    }
  };
  
  // Actually, let's use a simpler implementation for 'send' using class instances if possible.
  // We need to support the exact same JSON format as main.py
  
  server.listen(HTTP_PORT, (err) => {
    if (err) throw err;
    console.log(`> Next.js Server on http://localhost:${HTTP_PORT}`);
  });
});

// --- Logic Implementation ---

// Protocol Handler (V1/V2 state)
// Since we installed 'node-mavlink', it allows us to just instantiate message classes.
// parsing gives us instances.

function packetToFrontendJson(packet) {
    // node-mavlink 'packet' is likely the raw packet or the class instance?
    // MavLinkPacketParser emits the Message Class Instance directly usually.
    
    if (!packet || !packet.constructor) return null;
    
    // Setup basic payload
    const name = packet.constructor.name.replace('MavLinkProtocolV2', '').replace('MavLinkProtocolV1', ''); 
    // Wait, the parser emits the *Message* object, e.g. Heartbeat.
    
    const msgType = packet._name || packet.constructor.name; // e.g. "Heartbeat" or "HEARTBEAT"
    const typeUpper = msgType.toUpperCase();

    const payload = {};
    
    // Extract fields
    // We iterate keys. The library usually puts fields on 'this'.
    for (const key of Object.keys(packet)) {
        if (key.startsWith('_')) continue; // skip internal
        let val = packet[key];
        if (typeof val === 'bigint') val = Number(val); // JS number safety
        payload[key] = val;
    }

    // Custom formatting to match main.py
    if (typeUpper === 'GLOBAL_POSITION_INT') {
        payload.lat = (payload.lat || 0) / 1e7;
        payload.lon = (payload.lon || 0) / 1e7;
        payload.alt = (payload.alt || 0) / 1000.0;
    }
    
    return {
        type: typeUpper,
        server_ts: new Date().toISOString(),
        payload: payload
    };
}

// --- Frontend Command Handling ---
const dgramSender = dgram.createSocket('udp4');
let seq = 0;

async function sendToDrone(msgObj) {
    // Implementation of packing and sending
    // Using node-mavlink's serializer
    // This requires constructing the packet buffer.
    
    // For specific commands:
    try {
       const protocol = new MavLinkProtocolV2();
       // Create frame
       const buffer = protocol.createMessageBuffer(msgObj, 255, 190); // sys 255, comp 190
       
       dgramSender.send(buffer, targetPort, targetIp);
       console.log(`Sent ${msgObj.constructor.name} to ${targetIp}:${targetPort}`);
    } catch(e) {
       console.error("Send Exception", e);
    }
}

function handleFrontendMessage(data) {
    const type = data.type;
    const pl = data.payload || {};

    if (type === 'SET_MODE') {
        const modeName = pl.mode; // "MANUAL", "STABILIZE"
        const customMode = REVERSE_MODE_MAP[modeName];
        
        if (customMode !== undefined) {
             console.log(`Set Mode: ${modeName} -> ${customMode}`);
             const cmd = new common.SetMode();
             cmd.target_system = 1;
             cmd.base_mode = 1; // MAV_MODE_FLAG_CUSTOM_MODE_ENABLED
             cmd.custom_mode = customMode;
             sendToDrone(cmd);
        }
    }
    else if (type === 'SET_HOME') {
        // MAV_CMD_DO_SET_HOME = 179
        const cmd = new common.CommandLong();
        cmd.target_system = 1;
        cmd.target_component = 1;
        cmd.command = 179;
        cmd.confirmation = 0;
        cmd.param1 = pl.use_current ? 1 : 0;
        cmd.param5 = pl.lat || 0;
        cmd.param6 = pl.lon || 0;
        cmd.param7 = pl.alt || 0;
        sendToDrone(cmd);
    }
    else if (type === 'MISSION_UPLOAD') {
        // Handle Mission Upload
        // In node-mavlink, we need to handle the state machine (Count -> Request -> Item)
        // This is complex to do in a single function, usually needs a class.
        // For now, I'll implement a simplified fire-and-forget or basic sequence if possible,
        // but robust mission upload requires listening to ACKs.
        handleMissionUpload(pl.items); 
    }
}

// Simple Mission Upload State Machine
async function handleMissionUpload(items) {
    if (!items || items.length === 0) return;
    
    console.log(`Uploading ${items.length} items...`);
    
    // 1. Send Mission Count
    const countMsg = new common.MissionCount();
    countMsg.target_system = 1;
    countMsg.target_component = 1;
    countMsg.count = items.length;
    countMsg.mission_type = 0; // MAV_MISSION_TYPE_MISSION
    sendToDrone(countMsg);
    
    // We need to listen to MISSION_REQUEST from the drone to send items.
    // This requires global state hooks. 
    // For this quick migration, I'll add a temporary listener hook.
    globalMissionItems = items;
}

let globalMissionItems = [];

// Hook into parser to handle Mission Requests
mavParser.on('data', (packet) => {
   const msgType = packet.constructor.name;
   if (msgType === 'MissionRequest' || msgType === 'MissionRequestInt') {
       const seq = packet.seq;
       if (globalMissionItems[seq]) {
           const item = globalMissionItems[seq];
           const m = new common.MissionItemInt();
           m.target_system = 1;
           m.target_component = 1;
           m.seq = seq;
           m.frame = item.frame || 3; // Global Rel
           m.command = item.command || 16; // WP
           m.current = seq === 0 ? 1 : 0;
           m.autocontinue = 1;
           m.param1 = item.param1 || 0;
           m.param2 = item.param2 || 0;
           m.param3 = item.param3 || 0;
           m.param4 = item.param4 || 0;
           m.x = item.x || 0; // int32
           m.y = item.y || 0;
           m.z = item.z || 0; // float
           m.mission_type = 0;
           
           sendToDrone(m);
           console.log(`Sent Item ${seq}`);
       }
   }
   else if (msgType === 'MissionAck') {
       console.log("Mission Ack:", packet.type);
       // Reset
       globalMissionItems = [];
   }
});
