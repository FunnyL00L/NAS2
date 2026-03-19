import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { io, Socket } from 'socket.io-client';
import { HardDrive, Users, FileText, Download, Link as LinkIcon, Copy, Check, Wifi, Usb, Bluetooth, FolderOpen, Trash2, Image as ImageIcon, Video } from 'lucide-react';
import { motion } from 'motion/react';
import { Capacitor } from '@capacitor/core';

interface FileData {
  id: string;
  name: string;
  size: number;
  url: string;
  type: string;
  uploadedAt: number;
}

interface ClientData {
  id: string;
  name: string;
}

export default function HostDashboard() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ips, setIps] = useState<{wifi: string, usb: string, bluetooth: string, fallback: string} | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<'wifi' | 'usb' | 'bluetooth'>('wifi');
  const [port, setPort] = useState<number>(3000);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [files, setFiles] = useState<FileData[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [copied, setCopied] = useState(false);
  const [storagePath, setStoragePath] = useState<string>('');
  const [isEditingStorage, setIsEditingStorage] = useState(false);

  useEffect(() => {
    let currentSocket: Socket | null = null;
    let isMounted = true;

    // Listen for IP from mobile server if on native
    if (Capacitor.isNativePlatform()) {
      import('capacitor-nodejs').then(({ NodeJS }) => {
        (NodeJS as any).channel.addListener('server-ip', (ip: string) => {
          if (isMounted) {
            setIps(prev => ({
              ...(prev || { wifi: '', usb: '', bluetooth: '', fallback: '' }),
              wifi: ip,
              fallback: ip
            }));
          }
        });
      });
    }

    // Initialize session
    fetch('/api/host/session', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setSessionId(data.sessionId);
        setIps(data.ips);
        setPort(data.port);
        setStoragePath(data.currentUploadDir || '');
        
        // Connect socket
        currentSocket = io();
        setSocket(currentSocket);

        currentSocket.emit('join_session', { sessionId: data.sessionId, role: 'host' });

        currentSocket.on('client_joined', (updatedClients: ClientData[]) => {
          setClients(updatedClients);
        });

        currentSocket.on('client_left', (updatedClients: ClientData[]) => {
          setClients(updatedClients);
        });

        currentSocket.on('file_uploaded', (newFile: FileData) => {
          setFiles((prev) => {
            if (prev.some(f => f.id === newFile.id)) return prev;
            return [...prev, newFile];
          });
        });

        currentSocket.on('file_deleted', (deletedFileId: string) => {
          setFiles((prev) => prev.filter(f => f.id !== deletedFileId));
        });

        currentSocket.on('files_cleared', () => {
          setFiles([]);
        });
      });

    return () => {
      isMounted = false;
      if (currentSocket) currentSocket.disconnect();
    };
  }, []);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const totalStorage = files.reduce((acc, file) => acc + file.size, 0);
  
  // Calculate active IP based on selected method
  const getActiveIp = () => {
    if (!ips) return 'localhost';
    if (connectionMethod === 'wifi' && ips.wifi) return ips.wifi;
    if (connectionMethod === 'usb' && ips.usb) return ips.usb;
    if (connectionMethod === 'bluetooth' && ips.bluetooth) return ips.bluetooth;
    return ips.fallback !== 'localhost' ? ips.fallback : (ips.wifi || ips.usb || ips.bluetooth || 'localhost');
  };

  const activeIp = getActiveIp();
  // Use APP_URL if available (in production/cloud), otherwise fallback to the detected local IP
  const baseUrl = process.env.APP_URL || (activeIp !== 'localhost' ? `http://${activeIp}:${port}` : window.location.origin);
  const clientUrl = sessionId ? `${baseUrl}/client/${sessionId}` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(clientUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveStorage = async (newPath?: string) => {
    const pathToSave = newPath || storagePath;
    try {
      const res = await fetch('/api/host/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: pathToSave })
      });
      const data = await res.json();
      if (data.success) {
        setStoragePath(data.path);
        setIsEditingStorage(false);
      } else {
        alert(data.error || 'Failed to update storage path');
      }
    } catch (error) {
      alert('Failed to update storage path');
    }
  };

  const commonAndroidPaths = [
    { name: 'Internal Storage (App)', path: '/data/user/0/com.lnas2.app/files/LNAS2_Uploads' },
    { name: 'Downloads (Public)', path: '/storage/emulated/0/Download/LNAS2' },
    { name: 'Documents (Public)', path: '/storage/emulated/0/Documents/LNAS2' },
    { name: 'SD Card (If exists)', path: '/storage/sdcard1/LNAS2' }
  ];

  const handleDelete = async (fileId: string) => {
    try {
      await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete file', error);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus semua file?')) return;
    try {
      await fetch('/api/files', { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to clear files', error);
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4 sm:gap-0">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="p-2 sm:p-3 bg-indigo-100 text-indigo-600 rounded-xl">
              <HardDrive className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                <span className="sm:hidden">LNAS</span>
                <span className="hidden sm:inline">Local NAS Host</span>
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                <span className="sm:hidden">Scan QR to connect</span>
                <span className="hidden sm:inline">Scan QR to connect and transfer files</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4 sm:space-x-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0">
            <div className="text-left sm:text-right">
              <p className="text-xs sm:text-sm text-slate-500 font-medium uppercase tracking-wider">
                <span className="sm:hidden">Storage</span>
                <span className="hidden sm:inline">Total Storage Used</span>
              </p>
              <p className="text-lg sm:text-2xl font-bold text-slate-900">{formatBytes(totalStorage)}</p>
            </div>
            <div className="h-8 sm:h-12 w-px bg-slate-200"></div>
            <div className="text-right">
              <p className="text-xs sm:text-sm text-slate-500 font-medium uppercase tracking-wider">
                <span className="sm:hidden">Connect:</span>
                <span className="hidden sm:inline">Connected</span>
              </p>
              <p className="text-lg sm:text-2xl font-bold text-slate-900 flex items-center justify-end gap-1 sm:gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                {clients.length}
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: QR Code & Connection Info */}
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center"
            >
              <div className="flex space-x-2 w-full mb-6 bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setConnectionMethod('wifi')} title="Wi-Fi" className={`flex-1 flex items-center justify-center gap-2 py-3 sm:py-2.5 text-sm font-medium rounded-lg transition-colors ${connectionMethod === 'wifi' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Wifi className="w-5 h-5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Wi-Fi</span>
                </button>
                <button onClick={() => setConnectionMethod('usb')} title="Kabel USB" className={`flex-1 flex items-center justify-center gap-2 py-3 sm:py-2.5 text-sm font-medium rounded-lg transition-colors ${connectionMethod === 'usb' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Usb className="w-5 h-5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Kabel</span>
                </button>
                <button onClick={() => setConnectionMethod('bluetooth')} title="Bluetooth" className={`flex-1 flex items-center justify-center gap-2 py-3 sm:py-2.5 text-sm font-medium rounded-lg transition-colors ${connectionMethod === 'bluetooth' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Bluetooth className="w-5 h-5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Bluetooth</span>
                </button>
              </div>

              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                {connectionMethod === 'wifi' ? 'Scan QR Wi-Fi' : connectionMethod === 'usb' ? 'Koneksi Kabel USB' : 'Koneksi Bluetooth'}
              </h2>
              
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 inline-block mb-4">
                <QRCodeSVG value={clientUrl} size={200} level="H" includeMargin={true} />
              </div>
              
              {connectionMethod === 'wifi' && (
                <p className="text-sm text-slate-500 mb-4">
                  Pastikan HP dan Laptop berada di jaringan Wi-Fi/Tethering yang sama, lalu scan QR ini.
                </p>
              )}
              {connectionMethod === 'usb' && (
                <p className="text-sm text-slate-500 mb-4">
                  Hubungkan HP dengan kabel USB, aktifkan <b>USB Tethering</b> di HP, lalu scan QR atau buka link di bawah.
                </p>
              )}
              {connectionMethod === 'bluetooth' && (
                <p className="text-sm text-slate-500 mb-4">
                  Pairing Bluetooth HP dan Laptop, aktifkan <b>Bluetooth Tethering</b>, lalu scan QR atau buka link di bawah.
                </p>
              )}
              
              <div className="w-full">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <LinkIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-600 truncate">{clientUrl}</span>
                  </div>
                  <button 
                    onClick={copyToClipboard}
                    className="ml-2 p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title="Copy Link"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
            >
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" />
                Active Clients
              </h2>
              {clients.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-4">No clients connected yet.</p>
              ) : (
                <ul className="space-y-3">
                  {clients.map((client) => (
                    <li key={client.id} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-sm font-medium text-slate-700">{client.name}</span>
                      <span className="text-xs text-slate-400 ml-auto font-mono">{client.id.substring(0, 6)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </div>

          {/* Right Column: File List */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full min-h-[500px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-400" />
                  Received Files
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {files.length} files
                  </span>
                  {files.length > 0 && (
                    <button 
                      onClick={handleClearAll}
                      className="text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>
              
              {files.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="p-4 bg-slate-50 rounded-full">
                    <HardDrive className="w-12 h-12 text-slate-300" />
                  </div>
                  <p>Waiting for files to be uploaded...</p>
                </div>
              ) : (
                <div className="overflow-auto flex-1 pr-2">
                  <div className="space-y-3">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors group">
                        <div className="flex items-center space-x-4 overflow-hidden">
                          <div className="w-12 h-12 flex-shrink-0 bg-white rounded-lg shadow-sm overflow-hidden flex items-center justify-center border border-slate-200">
                            {file.type.startsWith('image/') ? (
                              <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                            ) : file.type.startsWith('video/') ? (
                              <Video className="w-6 h-6 text-indigo-400" />
                            ) : (
                              <FileText className="w-6 h-6 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                            <div className="flex items-center text-xs text-slate-500 space-x-2 mt-1">
                              <span>{formatBytes(file.size)}</span>
                              <span>•</span>
                              <span>{new Date(file.uploadedAt).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <a 
                            href={file.url} 
                            download={file.name}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-5 h-5" />
                          </a>
                          <button 
                            onClick={() => handleDelete(file.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

        </div>

        {/* Footer */}
        <footer className="mt-8 text-center pb-4">
          <a 
            href="https://wa.me/6285148444215" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-slate-400 hover:text-indigo-500 transition-colors"
          >
            develop by trigantalapati studio
          </a>
        </footer>
      </div>
    </div>
  );
}
