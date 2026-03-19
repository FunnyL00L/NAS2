import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const PORT = 3000;

function getNetworkInterfaces() {
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
  return ips;
}

// In-memory store for our prototype
interface AppState {
  hostSessionId: string | null;
  connectedClients: { id: string; name: string }[];
  files: { id: string; name: string; size: number; url: string; type: string; uploadedAt: number; absolutePath: string }[];
}

const state: AppState = {
  hostSessionId: null,
  connectedClients: [],
  files: [],
};

// Ensure uploads directory exists
let currentUploadDir = path.join(process.cwd(), 'uploads');

// Smart default for Android or Vercel
if (process.env.VERCEL === '1') {
  currentUploadDir = '/tmp/uploads';
} else if (process.platform === 'android' || process.env.ANDROID_ROOT) {
  // Try to use a more persistent location on Android if possible
  const androidHome = process.env.HOME || '/data/user/0/com.trigantalapati.lnas/files';
  currentUploadDir = path.join(androidHome, 'LNAS2_Uploads');
}

if (!fs.existsSync(currentUploadDir)) {
  try {
    fs.mkdirSync(currentUploadDir, { recursive: true });
  } catch (e) {
    console.error('Failed to create default upload dir, falling back to cwd/uploads', e);
    currentUploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(currentUploadDir)) {
      fs.mkdirSync(currentUploadDir, { recursive: true });
    }
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(currentUploadDir)) {
      fs.mkdirSync(currentUploadDir, { recursive: true });
    }
    cb(null, currentUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(express.json());

// --- API Routes ---

  // Get current host config
  app.get('/api/host/config', (req, res) => {
    res.json({ 
      sessionId: state.hostSessionId, 
      ips: getNetworkInterfaces(), 
      port: PORT, 
      currentUploadDir 
    });
  });

  // Host creates a session
  app.post('/api/host/session', (req, res) => {
    const sessionId = uuidv4();
    state.hostSessionId = sessionId;
    state.connectedClients = [];
    state.files = [];
    res.json({ sessionId, ips: getNetworkInterfaces(), port: PORT, currentUploadDir });
  });

  // Host changes storage path
  app.post('/api/host/storage', (req, res) => {
    const { storagePath } = req.body;
    if (!storagePath) {
      return res.status(400).json({ error: 'Storage path is required' });
    }
    try {
      // Check if path is absolute
      if (!path.isAbsolute(storagePath)) {
        return res.status(400).json({ error: 'Please provide an absolute path' });
      }

      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }
      
      // Test write permission by creating a temporary file
      const testFile = path.join(storagePath, '.lnas_test_' + Date.now());
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      currentUploadDir = storagePath;
      res.json({ success: true, path: currentUploadDir });
    } catch (error: any) {
      console.error('Failed to set storage path:', error);
      let msg = 'Failed to set storage path.';
      if (error.code === 'EACCES') msg += ' Permission denied.';
      if (error.code === 'ENOENT') msg += ' Path does not exist and could not be created.';
      res.status(500).json({ error: msg + ' Error: ' + error.message });
    }
  });

  // Client verifies session
  app.get('/api/client/verify/:sessionId', (req, res) => {
    if (req.params.sessionId === state.hostSessionId) {
      res.json({ valid: true });
    } else {
      res.status(401).json({ valid: false, error: 'Invalid or expired session' });
    }
  });

  // Client uploads a file
  app.post('/api/upload', upload.single('file'), (req, res) => {
    const { sessionId, clientId } = req.body;
    
    if (sessionId !== state.hostSessionId) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = uuidv4();
    const newFile = {
      id: fileId,
      name: req.file.originalname,
      size: req.file.size,
      url: `/api/file/${fileId}`,
      type: req.file.mimetype,
      uploadedAt: Date.now(),
      absolutePath: req.file.path
    };

    state.files.push(newFile);
    
    // Notify host and other clients
    io.emit('file_uploaded', newFile);

    res.json({ success: true, file: newFile });
  });

  // Get all files
  app.get('/api/files', (req, res) => {
    res.json(state.files);
  });

  // Serve file content dynamically (since storage path can change)
  app.get('/api/file/:id', (req, res) => {
    const file = state.files.find(f => f.id === req.params.id);
    if (file && file.absolutePath && fs.existsSync(file.absolutePath)) {
      res.sendFile(file.absolutePath);
    } else {
      res.status(404).send('File not found or has been moved/deleted from disk');
    }
  });

  // Delete all files
  app.delete('/api/files', (req, res) => {
    try {
      state.files.forEach(file => {
        if (file.absolutePath && fs.existsSync(file.absolutePath)) {
          fs.unlinkSync(file.absolutePath);
        }
      });
    } catch (e) {
      console.error('Failed to delete some physical files', e);
    }
    
    state.files = [];
    io.emit('files_cleared');
    res.json({ success: true });
  });

  // Delete single file
  app.delete('/api/files/:id', (req, res) => {
    const fileId = req.params.id;
    const fileIndex = state.files.findIndex(f => f.id === fileId);
    
    if (fileIndex !== -1) {
      const file = state.files[fileIndex];
      try {
        if (file.absolutePath && fs.existsSync(file.absolutePath)) {
          fs.unlinkSync(file.absolutePath);
        }
      } catch (e) {
        console.error('Failed to delete physical file', e);
      }
      
      state.files.splice(fileIndex, 1);
      io.emit('file_deleted', fileId);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // --- Socket.io ---
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_session', ({ sessionId, role, name }) => {
      if (role === 'host') {
        socket.join('host_room');
      } else if (role === 'client') {
        if (sessionId === state.hostSessionId) {
          const client = { id: socket.id, name: name || 'Anonymous' };
          state.connectedClients.push(client);
          socket.join('client_room');
          
          // Notify host
          io.to('host_room').emit('client_joined', state.connectedClients);
        } else {
          socket.emit('error', 'Invalid session');
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      const index = state.connectedClients.findIndex((c) => c.id === socket.id);
      if (index !== -1) {
        state.connectedClients.splice(index, 1);
        io.to('host_room').emit('client_left', state.connectedClients);
      }
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.VERCEL !== '1') {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

export default app;
