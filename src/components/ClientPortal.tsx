import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Upload, Camera, Video, File as FileIcon, CheckCircle2, AlertCircle, Loader2, Download, Image as ImageIcon, Trash2, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileData {
  id: string;
  name: string;
  size: number;
  url: string;
  type: string;
  uploadedAt: number;
}

export default function ClientPortal() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [clientName, setClientName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [files, setFiles] = useState<FileData[]>([]);
  const [previewFile, setPreviewFile] = useState<FileData | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Verify session
    fetch(`/api/client/verify/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        setIsValidating(false);
        if (data.valid) {
          setIsValid(true);
        } else {
          setIsValid(false);
        }
      })
      .catch(() => {
        setIsValidating(false);
        setIsValid(false);
      });
  }, [sessionId]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    const newSocket = io();
    setSocket(newSocket);
    newSocket.emit('join_session', { sessionId, role: 'client', name: clientName });
    
    newSocket.on('file_uploaded', (newFile: FileData) => {
      setFiles((prev) => {
        if (prev.some(f => f.id === newFile.id)) return prev;
        return [newFile, ...prev];
      });
    });

    newSocket.on('file_deleted', (deletedFileId: string) => {
      setFiles((prev) => prev.filter(f => f.id !== deletedFileId));
    });

    newSocket.on('files_cleared', () => {
      setFiles([]);
    });

    fetch('/api/files')
      .then(res => res.json())
      .then(data => {
        setFiles(prev => {
          const existingIds = new Set(prev.map(f => f.id));
          const newFiles = data.filter((f: FileData) => !existingIds.has(f.id));
          const combined = [...newFiles, ...prev];
          return combined.sort((a, b) => b.uploadedAt - a.uploadedAt);
        });
      });

    setHasJoined(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Upload files sequentially
    for (let i = 0; i < selectedFiles.length; i++) {
      await uploadFile(selectedFiles[i]);
    }
    
    // Reset input
    if (e.target) e.target.value = '';
  };

  const uploadFile = async (file: File) => {
    return new Promise<void>((resolve) => {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadStatus('idle');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId || '');
      formData.append('clientId', socket?.id || '');

      try {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadStatus('success');
          } else {
            setUploadStatus('error');
          }
          setTimeout(() => setUploadStatus('idle'), 2000);
          setIsUploading(false);
          resolve();
        });

        xhr.addEventListener('error', () => {
          setUploadStatus('error');
          setIsUploading(false);
          setTimeout(() => setUploadStatus('idle'), 2000);
          resolve();
        });

        xhr.open('POST', '/api/upload', true);
        xhr.send(formData);

      } catch (error) {
        console.error('Upload failed:', error);
        setUploadStatus('error');
        setIsUploading(false);
        setTimeout(() => setUploadStatus('idle'), 2000);
        resolve();
      }
    });
  };

  const handleDelete = async (fileId: string) => {
    try {
      await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
      // UI will update via socket event 'file_deleted'
    } catch (error) {
      console.error('Failed to delete file', error);
    }
  };

  const renderPreviewContent = () => {
    if (!previewFile) return null;

    const { type, url, name } = previewFile;

    if (type.startsWith('image/')) {
      return <img src={url} alt={name} className="max-w-full max-h-[70vh] object-contain rounded-lg" />;
    }

    if (type.startsWith('video/')) {
      return (
        <video controls className="max-w-full max-h-[70vh] rounded-lg" autoPlay>
          <source src={url} type={type} />
          Your browser does not support the video tag.
        </video>
      );
    }

    if (type === 'application/pdf') {
      return (
        <iframe 
          src={url} 
          className="w-full h-[70vh] rounded-lg border-none" 
          title={name}
        />
      );
    }

    // Office files fallback using Google Docs Viewer (requires internet on client side)
    const officeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint'
    ];

    if (officeTypes.includes(type)) {
      const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin + url)}&embedded=true`;
      return (
        <iframe 
          src={googleDocsUrl} 
          className="w-full h-[70vh] rounded-lg border-none" 
          title={name}
        />
      );
    }

    return (
      <div className="p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <FileIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Preview not available for this file type.</p>
        <p className="text-slate-400 text-sm mt-1">{name}</p>
        <a 
          href={url} 
          download={name}
          className="mt-6 inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download to View
        </a>
      </div>
    );
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Invalid Session</h1>
          <p className="text-slate-500">The QR code or link you used is invalid or has expired. Please ask the host for a new one.</p>
        </div>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md w-full"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Connect to NAS</h1>
            <p className="text-slate-500 mt-2">Enter your name to join the session and start transferring files.</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
              <input
                type="text"
                id="name"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="e.g. John's Phone"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
            >
              Join Session
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 font-sans">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Header */}
        <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Connected as {clientName}</h1>
          <p className="text-sm text-slate-500 mt-1">You can now upload files to the host.</p>
        </header>

        {/* Upload Actions */}
        <div className="grid grid-cols-2 gap-4">
          {/* Hidden Inputs */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            multiple
          />
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={cameraInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            multiple
          />
          <input 
            type="file" 
            accept="video/*" 
            capture="environment" 
            ref={videoInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            multiple
          />

          <button 
            onClick={() => cameraInputRef.current?.click()}
            disabled={isUploading}
            className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Camera className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-slate-700">Take Photo</span>
          </button>

          <button 
            onClick={() => videoInputRef.current?.click()}
            disabled={isUploading}
            className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Video className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-slate-700">Record Video</span>
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="col-span-2 flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FileIcon className="w-7 h-7" />
            </div>
            <span className="text-base font-medium text-slate-900">Upload File</span>
            <span className="text-sm text-slate-500 mt-1">Select any file from your device</span>
          </button>
        </div>

        {/* Upload Status */}
        <AnimatePresence>
          {isUploading && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
            >
              <div className="flex justify-between text-sm font-medium text-slate-700 mb-2">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <motion.div 
                  className="bg-indigo-600 h-2.5 rounded-full" 
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.2 }}
                ></motion.div>
              </div>
            </motion.div>
          )}

          {uploadStatus === 'success' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200 flex items-center gap-3"
            >
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">File uploaded successfully!</span>
            </motion.div>
          )}

          {uploadStatus === 'error' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">Failed to upload file. Try again.</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gallery Section */}
        <div className="pt-6 border-t border-slate-200 mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-slate-500" />
            Shared Gallery
          </h2>
          
          {files.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-slate-500 text-sm">No files have been shared yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {files.map((file) => (
                <div key={file.id} className="relative group aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  {file.type.startsWith('image/') ? (
                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                  ) : file.type.startsWith('video/') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-50 text-indigo-400">
                      <Video className="w-8 h-8 mb-1" />
                      <span className="text-xs font-medium">Video</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                      <FileIcon className="w-8 h-8 mb-1" />
                      <span className="text-xs font-medium truncate w-full px-2 text-center">{file.name}</span>
                    </div>
                  )}
                  
                  {/* Overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-2 px-2 flex items-end justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setPreviewFile(file)}
                      className="p-2 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm text-white transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <a 
                      href={file.url} 
                      download={file.name}
                      className="p-2 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm text-white transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button 
                      onClick={() => handleDelete(file.id)}
                      className="p-2 bg-red-500/80 hover:bg-red-600 rounded-full backdrop-blur-sm text-white transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Modal */}
        <AnimatePresence>
          {previewFile && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col"
              >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                      <FileIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 truncate max-w-[200px] sm:max-w-md">{previewFile.name}</h3>
                      <p className="text-xs text-slate-500">File Preview</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPreviewFile(null)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="p-4 sm:p-6 overflow-auto flex items-center justify-center bg-slate-50 min-h-[300px]">
                  {renderPreviewContent()}
                </div>

                <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-white">
                  <span className="text-xs text-slate-400 mr-auto">
                    Uploaded {new Date(previewFile.uploadedAt).toLocaleString()}
                  </span>
                  <button 
                    onClick={() => setPreviewFile(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                  <a 
                    href={previewFile.url} 
                    download={previewFile.name}
                    className="px-6 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
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
