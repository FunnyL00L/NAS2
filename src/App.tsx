/**
 * LNAS App - Mobile-First React Native Concept
 * Refactored to use RN-style component patterns and mobile-centric UI.
 */
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { 
  HardDrive, 
  Users, 
  Settings, 
  Share2, 
  Upload, 
  LayoutGrid, 
  Info, 
  ChevronRight, 
  Folder, 
  FileText,
  Smartphone,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- React Native Style Components (Web Implementation) ---

/**
 * View: Basic container, defaults to Flexbox
 */
const View = ({ children, className = "", id, ...props }: { children?: React.ReactNode, className?: string, id?: string, [key: string]: any }) => (
  <div id={id} className={`flex flex-col ${className}`} {...props}>
    {children}
  </div>
);

/**
 * Text: Typography component
 */
const Text = ({ children, className = "", id, ...props }: { children?: React.ReactNode, className?: string, id?: string, [key: string]: any }) => (
  <span id={id} className={`${className}`} {...props}>
    {children}
  </span>
);

/**
 * TouchableOpacity: Button with active state feel
 */
const TouchableOpacity = ({ 
  children, 
  onClick, 
  className = "", 
  disabled = false,
  id,
  ...props
}: { 
  children?: React.ReactNode, 
  onClick?: () => void, 
  className?: string,
  disabled?: boolean,
  id?: string,
  [key: string]: any
}) => (
  <button
    id={id}
    onClick={onClick}
    disabled={disabled}
    className={`active:scale-95 transition-transform duration-100 disabled:opacity-50 disabled:active:scale-100 ${className}`}
    {...props}
  >
    {children}
  </button>
);

/**
 * ScrollView: Scrollable container
 */
const ScrollView = ({ children, className = "", id, ...props }: { children?: React.ReactNode, className?: string, id?: string, [key: string]: any }) => (
  <div id={id} className={`overflow-y-auto flex-1 ${className}`} {...props}>
    {children}
  </div>
);

// --- App Components ---

const Header = ({ title, showBack = false }: { title: string, showBack?: boolean }) => {
  const navigate = useNavigate();
  return (
    <View className="h-16 px-6 bg-white border-b border-zinc-100 flex-row items-center justify-between sticky top-0 z-50">
      <View className="flex-row items-center gap-4">
        {showBack && (
          <TouchableOpacity onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ChevronRight className="rotate-180 text-zinc-900" size={24} />
          </TouchableOpacity>
        )}
        <Text className="text-xl font-bold text-zinc-900 tracking-tight">{title}</Text>
      </View>
      <Smartphone className="text-zinc-400" size={20} />
    </View>
  );
};

const TabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: '/host', label: 'Host', icon: HardDrive },
    { path: '/client', label: 'Client', icon: Smartphone },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <View className="h-20 bg-white border-t border-zinc-100 flex-row items-center justify-around px-2 pb-safe">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        const Icon = tab.icon;
        return (
          <TouchableOpacity
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className="flex-1 flex-col items-center gap-1"
          >
            <View className={`p-2 rounded-2xl transition-colors ${isActive ? 'bg-zinc-900 text-white' : 'text-zinc-400'}`}>
              <Icon size={22} />
            </View>
            <Text className={`text-[10px] font-medium uppercase tracking-widest ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const HostScreen = () => {
  const [hostConfig, setHostConfig] = useState<{ ips: any; port: number; currentUploadDir: string } | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/host/config').then(res => res.json()).then(setHostConfig);
    const fetchFiles = () => {
      fetch('/api/files').then(res => res.json()).then(setReceivedFiles);
    };
    fetchFiles();
    const interval = setInterval(fetchFiles, 3000);
    return () => clearInterval(interval);
  }, []);

  const ipAddress = hostConfig?.ips?.wifi || hostConfig?.ips?.fallback || 'localhost';

  return (
    <View className="flex-1 bg-zinc-50">
      <Header title="Host Dashboard" />
      <ScrollView className="p-6">
        {/* QR Section */}
        <View className="bg-white rounded-3xl p-8 items-center shadow-sm border border-zinc-100 mb-6">
          <Text className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-4">Scan to Connect</Text>
          <View className="w-48 h-48 bg-zinc-50 rounded-2xl items-center justify-center border-2 border-dashed border-zinc-200">
            {hostConfig ? (
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=http://${ipAddress}:${hostConfig.port}`} 
                alt="QR Code"
                className="w-40 h-40"
              />
            ) : (
              <View className="animate-pulse bg-zinc-200 w-32 h-32 rounded-xl" />
            )}
          </View>
          <View className="mt-6 items-center">
            <Text className="text-zinc-900 font-mono font-medium">{ipAddress}:{hostConfig?.port}</Text>
            <Text className="text-zinc-400 text-sm mt-1">Local Network Only</Text>
          </View>
        </View>

        {/* Storage Info */}
        <View className="bg-zinc-900 rounded-3xl p-6 mb-6 flex-row items-center justify-between">
          <View className="flex-row items-center gap-4">
            <View className="w-12 h-12 bg-white/10 rounded-2xl items-center justify-center">
              <Folder className="text-white" size={24} />
            </View>
            <View className="flex-1">
              <Text className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Storage Location</Text>
              <Text className="text-white font-medium truncate max-w-[180px] block">{hostConfig?.currentUploadDir || 'Loading...'}</Text>
            </View>
          </View>
          <TouchableOpacity onClick={() => {}} className="p-2 bg-white/10 rounded-xl">
            <Settings className="text-white" size={18} />
          </TouchableOpacity>
        </View>

        {/* Files List */}
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-zinc-900 font-bold text-lg">Received Files</Text>
          <Text className="text-zinc-400 text-xs font-medium">{receivedFiles.length} Total</Text>
        </View>

        <View className="gap-3">
          {receivedFiles.length === 0 ? (
            <View className="py-12 items-center justify-center bg-white rounded-3xl border border-dashed border-zinc-200">
              <Upload className="text-zinc-300 mb-2" size={32} />
              <Text className="text-zinc-400 text-sm">No files received yet</Text>
            </View>
          ) : (
            receivedFiles.map((file, idx) => (
              <View key={idx} className="bg-white p-4 rounded-2xl flex-row items-center gap-4 border border-zinc-100 shadow-sm">
                <View className="w-10 h-10 bg-zinc-50 rounded-xl items-center justify-center">
                  <FileText className="text-zinc-400" size={20} />
                </View>
                <View className="flex-1 overflow-hidden">
                  <Text className="text-zinc-900 font-medium text-sm truncate block">{file.name}</Text>
                  <Text className="text-zinc-400 text-[10px] uppercase tracking-wider">{(file.size / 1024).toFixed(1)} KB • {new Date(file.uploadedAt).toLocaleTimeString()}</Text>
                </View>
                <CheckCircle2 className="text-emerald-500" size={18} />
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <TabBar />
    </View>
  );
};

const ClientScreen = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [hostConfig, setHostConfig] = useState<any>(null);

  useEffect(() => {
    fetch('/api/host/config').then(res => res.json()).then(setHostConfig);
  }, []);

  const handleUpload = async () => {
    if (!file || !hostConfig) return;
    setUploading(true);
    setStatus(null);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', hostConfig.sessionId);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        setStatus({ type: 'success', msg: 'File sent successfully!' });
        setFile(null);
      } else {
        const data = await res.json();
        setStatus({ type: 'error', msg: data.error || 'Upload failed.' });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: 'Network error occurred.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="flex-1 bg-zinc-50">
      <Header title="Send Files" />
      <ScrollView className="p-6">
        <View className="bg-white rounded-3xl p-8 items-center shadow-sm border border-zinc-100 mb-6">
          <View className="w-20 h-20 bg-zinc-50 rounded-full items-center justify-center mb-6">
            <Share2 className="text-zinc-900" size={32} />
          </View>
          <Text className="text-center text-zinc-900 font-bold text-xl mb-2">Wireless Transfer</Text>
          <Text className="text-center text-zinc-400 text-sm leading-relaxed">
            Select any file from your device to send it directly to the host computer.
          </Text>
        </View>

        <View className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm">
          <input 
            type="file" 
            id="file-input" 
            className="hidden" 
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <label htmlFor="file-input" className="cursor-pointer">
            <View className={`py-10 border-2 border-dashed rounded-2xl items-center justify-center transition-colors ${file ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-zinc-50'}`}>
              {file ? (
                <>
                  <FileText className="text-emerald-500 mb-2" size={32} />
                  <Text className="text-emerald-700 font-medium text-sm truncate max-w-[200px] block">{file.name}</Text>
                  <Text className="text-emerald-500 text-[10px] mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</Text>
                </>
              ) : (
                <>
                  <Upload className="text-zinc-300 mb-2" size={32} />
                  <Text className="text-zinc-400 text-sm">Tap to select file</Text>
                </>
              )}
            </View>
          </label>

          {status && (
            <View className={`mt-4 p-4 rounded-2xl flex-row items-center gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <Text className="text-xs font-medium">{status.msg}</Text>
            </View>
          )}

          <TouchableOpacity
            onClick={handleUpload}
            disabled={!file || uploading}
            className={`mt-6 py-4 rounded-2xl items-center justify-center ${!file || uploading ? 'bg-zinc-100' : 'bg-zinc-900'}`}
          >
            <Text className={`font-bold uppercase tracking-widest text-sm ${!file || uploading ? 'text-zinc-400' : 'text-white'}`}>
              {uploading ? 'Sending...' : 'Send to Host'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <TabBar />
    </View>
  );
};

const SettingsScreen = () => {
  const [path, setPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [showNativeGuide, setShowNativeGuide] = useState(false);

  useEffect(() => {
    fetch('/api/host/config').then(res => res.json()).then(data => setPath(data.currentUploadDir));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/host/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: path })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', msg: 'Storage path updated!' });
        setPath(data.path);
      } else {
        setStatus({ type: 'error', msg: data.error || 'Failed to update path.' });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: 'Network error.' });
    } finally {
      setSaving(false);
    }
  };

  const quickPaths = [
    { label: 'Internal', path: '/storage/emulated/0' },
    { label: 'Downloads', path: '/storage/emulated/0/Download' },
    { label: 'Documents', path: '/storage/emulated/0/Documents' },
    { label: 'SD Card', path: '/storage/sdcard1' },
  ];

  return (
    <View className="flex-1 bg-zinc-50">
      <Header title="Settings" />
      <ScrollView className="p-6">
        <View className="mb-8">
          <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-4 ml-1">Native App Integration</Text>
          <TouchableOpacity 
            onClick={() => setShowNativeGuide(!showNativeGuide)}
            className="mb-6 p-5 bg-zinc-900 rounded-3xl flex-row items-center justify-between shadow-lg shadow-zinc-200"
          >
            <View className="flex-row items-center gap-4">
              <View className="w-10 h-10 bg-white/10 rounded-2xl items-center justify-center">
                <Smartphone className="text-white" size={20} />
              </View>
              <View>
                <Text className="text-white font-bold">Build Native App</Text>
                <Text className="text-zinc-400 text-[10px] uppercase tracking-wider">Convert to React Native</Text>
              </View>
            </View>
            <ChevronRight className={`text-white transition-transform duration-300 ${showNativeGuide ? 'rotate-90' : ''}`} size={20} />
          </TouchableOpacity>

          <AnimatePresence>
            {showNativeGuide && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <View className="p-6 bg-white border border-zinc-100 rounded-3xl gap-5">
                  <Text className="font-bold text-zinc-900">Cara Menjadi Aplikasi Native:</Text>
                  
                  <View className="gap-4">
                    <View className="flex-row gap-4">
                      <View className="w-6 h-6 rounded-full bg-zinc-900 items-center justify-center shrink-0">
                        <Text className="text-white text-[10px] font-bold">1</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-zinc-900 font-bold text-sm">PWA (Rekomendasi)</Text>
                        <Text className="text-zinc-500 text-xs leading-relaxed">Buka URL ini di Chrome/Safari HP, lalu pilih "Add to Home Screen". Aplikasi akan terpasang secara instan.</Text>
                      </View>
                    </View>

                    <View className="flex-row gap-4">
                      <View className="w-6 h-6 rounded-full bg-zinc-100 items-center justify-center shrink-0">
                        <Text className="text-zinc-900 text-[10px] font-bold">2</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-zinc-900 font-bold text-sm">Capacitor / Cordova</Text>
                        <Text className="text-zinc-500 text-xs leading-relaxed">Gunakan Capacitor untuk membungkus web ini menjadi file APK/IPA tanpa mengubah kode.</Text>
                      </View>
                    </View>

                    <View className="flex-row gap-4">
                      <View className="w-6 h-6 rounded-full bg-zinc-100 items-center justify-center shrink-0">
                        <Text className="text-zinc-900 text-[10px] font-bold">3</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-zinc-900 font-bold text-sm">React Native (Expo)</Text>
                        <Text className="text-zinc-500 text-xs leading-relaxed">Salin logika di `App.tsx` ke proyek Expo baru. Saya sudah menggunakan pola komponen yang kompatibel.</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </motion.div>
            )}
          </AnimatePresence>

          <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-4 ml-1">Storage Configuration</Text>
          <View className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm">
            <Text className="text-zinc-900 font-bold mb-2">Destination Path</Text>
            <Text className="text-zinc-400 text-xs mb-4 leading-relaxed">
              Files received from clients will be saved to this directory on the host.
            </Text>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/path/to/folder"
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-zinc-900 font-mono text-sm focus:outline-none focus:border-zinc-900 transition-colors"
            />
            
            <View className="mt-6">
              <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-3">Quick Select (Android)</Text>
              <View className="flex-row flex-wrap gap-2">
                {quickPaths.map((qp) => (
                  <TouchableOpacity
                    key={qp.label}
                    onClick={() => setPath(qp.path)}
                    className={`px-4 py-2 rounded-xl border transition-colors ${path === qp.path ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-100 text-zinc-600'}`}
                  >
                    <Text className="text-xs font-medium">{qp.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {status && (
              <View className={`mt-4 p-4 rounded-2xl flex-row items-center gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <Text className="text-xs font-medium">{status.msg}</Text>
              </View>
            )}

            <TouchableOpacity
              onClick={handleSave}
              disabled={saving}
              className="mt-8 bg-zinc-900 py-4 rounded-2xl items-center justify-center"
            >
              <Text className="text-white font-bold uppercase tracking-widest text-sm">
                {saving ? 'Saving...' : 'Save Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-4 ml-1">About LNAS</Text>
          <View className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm items-center">
            <View className="w-12 h-12 bg-zinc-50 rounded-2xl items-center justify-center mb-4">
              <Info className="text-zinc-900" size={24} />
            </View>
            <Text className="text-zinc-900 font-bold">Version 2.0.0</Text>
            <Text className="text-zinc-400 text-xs mt-1">Local Network Asset Sync</Text>
          </View>
        </View>
      </ScrollView>
      <TabBar />
    </View>
  );
};

// --- Main App ---

export default function App() {
  return (
    <Router>
      <View className="h-screen w-full max-w-md mx-auto bg-white shadow-2xl overflow-hidden relative">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/host" element={
              <motion.div 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: 20 }}
                className="flex-1 flex flex-col h-full"
              >
                <HostScreen />
              </motion.div>
            } />
            <Route path="/client" element={
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 1.05 }}
                className="flex-1 flex flex-col h-full"
              >
                <ClientScreen />
              </motion.div>
            } />
            <Route path="/settings" element={
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 flex flex-col h-full"
              >
                <SettingsScreen />
              </motion.div>
            } />
            <Route path="*" element={<Navigate to="/host" replace />} />
          </Routes>
        </AnimatePresence>
      </View>
    </Router>
  );
}
