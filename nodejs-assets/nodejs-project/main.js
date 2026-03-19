const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let connectedClients = [];

io.on('connection', (socket) => {
  socket.on('join_session', ({ sessionId, role, name }) => {
    if (sessionId === state.sessionId) {
      socket.join(sessionId);
      if (role === 'client') {
        connectedClients.push({ id: socket.id, name });
        io.to(sessionId).emit('client_joined', connectedClients);
      }
    }
  });

  socket.on('disconnect', () => {
    connectedClients = connectedClients.filter(c => c.id !== socket.id);
    io.to(state.sessionId).emit('client_left', connectedClients);
  });
});

const PORT = 3000;

// State management
let state = {
  files: [],
  storagePath: path.join(os.homedir(), 'LNAS_Uploads'),
  sessionId: uuidv4().substring(0, 8),
};

// Ensure storage path exists
if (!fs.existsSync(state.storagePath)) {
  try {
    fs.mkdirSync(state.storagePath, { recursive: true });
  } catch (e) {
    console.error('Failed to create storage path', e);
  }
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(state.storagePath)) {
      fs.mkdirSync(state.storagePath, { recursive: true });
    }
    cb(null, state.storagePath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// API Routes
app.post('/api/host/session', (req, res) => {
  state.sessionId = uuidv4().substring(0, 8);
  state.files = [];
  
  const interfaces = os.networkInterfaces();
  const ips = { wifi: '', usb: '', bluetooth: '', fallback: 'localhost' };
  
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (!iface) continue;
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        const name = devName.toLowerCase();
        if (name.includes('wi-fi') || name.includes('wlan')) {
          ips.wifi = alias.address;
        } else if (name.includes('usb') || name.includes('rndis') || name.includes('ethernet')) {
          ips.usb = alias.address;
        } else if (name.includes('bluetooth') || name.includes('bnep')) {
          ips.bluetooth = alias.address;
        } else {
          if (ips.fallback === 'localhost') ips.fallback = alias.address;
        }
      }
    }
  }
  
  res.json({ 
    sessionId: state.sessionId, 
    ips, 
    port: PORT, 
    currentUploadDir: state.storagePath 
  });
});

// Host changes storage path
app.post('/api/host/storage', (req, res) => {
  const { storagePath } = req.body;
  try {
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
    state.storagePath = storagePath;
    res.json({ success: true, path: state.storagePath });
  } catch (error) {
    console.error('Failed to set storage path:', error);
    res.status(500).json({ error: 'Failed to set storage path. Please check permissions.' });
  }
});

app.get('/api/client/verify/:sessionId', (req, res) => {
  res.json({ valid: req.params.sessionId === state.sessionId });
});

app.get('/api/state', (req, res) => res.json(state));

app.get('/api/files', (req, res) => res.json(state.files));

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const newFile = {
    id: uuidv4(),
    name: req.file.originalname,
    size: req.file.size,
    url: `/api/files/download/${req.file.filename}`,
    type: req.file.mimetype,
    uploadedAt: Date.now(),
    filename: req.file.filename,
    absolutePath: req.file.path
  };

  state.files.unshift(newFile);
  io.emit('file_uploaded', newFile);
  res.json(newFile);
});

app.get('/api/files/download/:filename', (req, res) => {
  const filePath = path.join(state.storagePath, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

app.delete('/api/files/:id', (req, res) => {
  const fileIndex = state.files.findIndex(f => f.id === req.params.id);
  if (fileIndex > -1) {
    const file = state.files[fileIndex];
    try {
      if (fs.existsSync(file.absolutePath)) fs.unlinkSync(file.absolutePath);
    } catch (e) {}
    state.files.splice(fileIndex, 1);
    io.emit('file_deleted', req.params.id);
    res.json({ success: true });
  } else {
    res.status(404).send('File not found');
  }
});

app.delete('/api/files', (req, res) => {
  state.files.forEach(file => {
    try {
      if (fs.existsSync(file.absolutePath)) fs.unlinkSync(file.absolutePath);
    } catch (e) {}
  });
  state.files = [];
  io.emit('files_cleared');
  res.json({ success: true });
});

// Serve static files for the web client
// In mobile mode, the React app will be served by Capacitor, 
// but we still need the API to work.

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mobile Server running on port ${PORT}`);
  
  // Send IP to React app if capacitor-nodejs is available
  try {
    const nodejs = require('bridge');
    const interfaces = os.networkInterfaces();
    let ip = '127.0.0.1';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ip = iface.address;
          break;
        }
      }
    }
    nodejs.channel.send('server-ip', ip);
  } catch (e) {}
});
