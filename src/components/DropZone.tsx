import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { UploadCloud, FolderPlus, FileText, HardDrive, ArrowRight, X, Send, Check, Folder, Plus, FolderOpen, RefreshCw } from 'lucide-react';
import { Language, translations } from '../translations';
import { PeerInfo } from '../types';
import { formatBytes, getFileCategory } from '../utils/format';
import { extractFilesFromDataTransfer } from '../utils/fileSystem';

interface DropZoneProps {
  peers: PeerInfo[];
  selectedPeerId: string | null;
  onSelectPeer: (peerId: string | null) => void;
  onSendFiles: (
    files: File[],
    targetPeerIds: string[],
    sourceDrive: string,
    targetDrive: string
  ) => void;
  onTargetPathChange?: (targetPath: string) => void;
  onDragEndOrDrop?: () => void;
  selectedFiles: File[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  lang: Language;
}

export const DropZone: React.FC<DropZoneProps> = ({
  peers,
  selectedPeerId,
  onSelectPeer,
  onSendFiles,
  onTargetPathChange,
  onDragEndOrDrop,
  selectedFiles,
  setSelectedFiles,
  lang,
}) => {
  const t = translations[lang];
  const [isDragOver, setIsDragOver] = useState(false);
  const [sourceDrive, setSourceDrive] = useState<string>('D:\\ (Data Drive)');
  const [targetDrive, setTargetDrive] = useState<string>('Desktop');
  const [sendToAll, setSendToAll] = useState(false);

  // Subfolder browsing & creation on target PC
  const [remoteFolders, setRemoteFolders] = useState<string[]>([]);
  const [selectedSubFolder, setSelectedSubFolder] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [isCreatingFolderLoading, setIsCreatingFolderLoading] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  // Sync effective target destination path (Drive + Subfolder) with parent component
  useEffect(() => {
    const base = targetDrive.split(' (')[0].trim();
    let effective = base;
    if (selectedSubFolder && selectedSubFolder.trim()) {
      const cleanSub = selectedSubFolder.trim().replace(/^[\/\\]+/, '');
      effective = base.endsWith('\\') || base.endsWith('/')
        ? `${base}${cleanSub}`
        : `${base}\\${cleanSub}`;
    }
    onTargetPathChange?.(effective);
  }, [targetDrive, selectedSubFolder, onTargetPathChange]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Imperatively attach directory attributes and IDL properties for full browser & Electron compatibility
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
      folderInputRef.current.setAttribute('multiple', '');
      (folderInputRef.current as any).webkitdirectory = true;
      (folderInputRef.current as any).directory = true;
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    onDragEndOrDrop?.();

    const filesArray = await extractFilesFromDataTransfer(e.dataTransfer);
    if (filesArray.length > 0) {
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
    e.target.value = '';
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files).map((file) => {
        const rel = file.webkitRelativePath || (file as any).relativePath || file.name;
        if (rel) {
          Object.defineProperty(file, 'relativePath', {
            value: rel,
            writable: true,
            configurable: true,
          });
        }
        return file;
      });
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
    e.target.value = '';
  };

  const handleBrowseFolderClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Try modern native File System Access API directory picker first
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        if (dirHandle) {
          const collected: File[] = [];
          const readDirectoryRecursive = async (handle: any, parentPath: string) => {
            for await (const entry of handle.values()) {
              if (entry.kind === 'file') {
                const f = await entry.getFile();
                const relPath = parentPath ? `${parentPath}/${f.name}` : `${handle.name}/${f.name}`;
                Object.defineProperty(f, 'relativePath', {
                  value: relPath,
                  writable: true,
                  configurable: true,
                });
                collected.push(f);
              } else if (entry.kind === 'directory') {
                const nextPath = parentPath ? `${parentPath}/${entry.name}` : `${handle.name}/${entry.name}`;
                await readDirectoryRecursive(entry, nextPath);
              }
            }
          };

          await readDirectoryRecursive(dirHandle, dirHandle.name);
          if (collected.length > 0) {
            setSelectedFiles((prev) => [...prev, ...collected]);
            return;
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('showDirectoryPicker blocked or unsupported, falling back to input:', err);
      }
    }

    // 2. Standard webkitdirectory input fallback
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
      folderInputRef.current.click();
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const targetPeer = peers.find((p) => p.id === selectedPeerId);

  // Helper to get remote target base URL over LAN if IP is known
  const getTargetApiBase = useCallback((peer?: PeerInfo) => {
    if (!peer?.ip || peer.ip.includes('x') || peer.ip === '127.0.0.1' || peer.ip === window.location.hostname) {
      return '';
    }
    return `http://${peer.ip}:3000`;
  }, []);

  // Fetch real subfolders from the selected drive on target PC
  const fetchRemoteFolders = useCallback(async (drive: string, peer?: PeerInfo) => {
    if (!drive || !peer) {
      setRemoteFolders([]);
      return;
    }
    setIsLoadingFolders(true);
    try {
      const cleanDrive = drive.split(' (')[0].trim();
      const apiBase = getTargetApiBase(peer);
      let res: Response | null = null;
      if (apiBase) {
        res = await fetch(`${apiBase}/api/browse-folders?path=${encodeURIComponent(cleanDrive)}`, {
          signal: AbortSignal.timeout(1500),
        }).catch(() => null);
      }
      if (!res || !res.ok) {
        res = await fetch(`/api/browse-folders?path=${encodeURIComponent(cleanDrive)}`, {
          signal: AbortSignal.timeout(1500),
        }).catch(() => null);
      }
      if (res && res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.folders)) {
          setRemoteFolders(data.folders);
          return;
        }
      }
      setRemoteFolders([]);
    } catch {
      setRemoteFolders([]);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [getTargetApiBase]);

  // Handle creating a new folder on the target PC
  const handleCreateRemoteFolder = async () => {
    if (!newFolderNameInput.trim() || !targetPeer) return;
    setIsCreatingFolderLoading(true);
    try {
      const folderName = newFolderNameInput.trim().replace(/[\/\\:*?"<>|]/g, '_');
      const baseDrive = targetDrive.split(' (')[0].trim();
      const fullNewPath = baseDrive.endsWith('\\') || baseDrive.endsWith('/')
        ? `${baseDrive}${folderName}`
        : `${baseDrive}\\${folderName}`;

      const apiBase = getTargetApiBase(targetPeer);
      let res: Response | null = null;
      if (apiBase) {
        res = await fetch(`${apiBase}/api/create-folder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullNewPath }),
        }).catch(() => null);
      }
      if (!res || !res.ok) {
        res = await fetch('/api/create-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullNewPath }),
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.success) {
          setRemoteFolders((prev) => [folderName, ...prev.filter((f) => f !== folderName)]);
          setSelectedSubFolder(folderName);
          setNewFolderNameInput('');
          setIsCreatingFolder(false);
        }
      }
    } catch (err) {
      console.error('Error creating remote folder:', err);
    } finally {
      setIsCreatingFolderLoading(false);
    }
  };

  const handleStartTransfer = () => {
    if (selectedFiles.length === 0) return;

    let targetIds: string[] = [];
    if (sendToAll) {
      targetIds = peers.map((p) => p.id);
    } else if (selectedPeerId) {
      targetIds = [selectedPeerId];
    } else if (peers.length > 0) {
      targetIds = [peers[0].id];
    }

    if (targetIds.length === 0) return;

    const base = targetDrive.split(' (')[0].trim();
    let effectiveTargetDrive = base;
    if (selectedSubFolder && selectedSubFolder.trim()) {
      const cleanSub = selectedSubFolder.trim().replace(/^[\/\\]+/, '');
      effectiveTargetDrive = base.endsWith('\\') || base.endsWith('/')
        ? `${base}${cleanSub}`
        : `${base}\\${cleanSub}`;
    }

    onSendFiles(selectedFiles, targetIds, sourceDrive, effectiveTargetDrive);
    setSelectedFiles([]);
  };

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const lastTargetPeerIdRef = useRef<string | null>(null);
  const lastTargetDriveRef = useRef<string>('');

  // Dynamically detect and list the real drives of the connected target PC
  const targetPeerId = targetPeer?.id;
  const targetDrivesSerialized = targetPeer?.targetDrives?.join(',') || '';

  const targetDrivesList = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    list.push({ id: 'Desktop', label: 'Desktop (ডেস্কটপ)' });

    if (targetPeer?.targetDrives && targetPeer.targetDrives.length > 0) {
      for (const d of targetPeer.targetDrives) {
        const id = d.split(' ')[0] || d;
        if (id.toLowerCase() === 'desktop') continue;
        list.push({
          id,
          label: d.includes('(') ? d : id === 'Downloads' ? 'Downloads (ডাউনলোড)' : `${d} (Local Disk)`,
        });
      }
    } else {
      list.push({ id: 'C:\\', label: 'C:\\ (System / Local Disk)' });
      list.push({ id: 'D:\\', label: 'D:\\ (Data / Files)' });
      list.push({ id: 'Downloads', label: 'Downloads (ডাউনলোড)' });
    }
    return list;
  }, [targetPeerId, targetDrivesSerialized]);

  // When target peer connects or changes, set the initial drive and fetch its folders
  useEffect(() => {
    if (!targetPeer) {
      if (lastTargetPeerIdRef.current !== null) {
        lastTargetPeerIdRef.current = null;
        lastTargetDriveRef.current = '';
        setRemoteFolders([]);
        setSelectedSubFolder('');
      }
      return;
    }

    if (targetPeer.id !== lastTargetPeerIdRef.current) {
      lastTargetPeerIdRef.current = targetPeer.id;
      const preferred = targetDrivesList.find((d) => d.id === 'Desktop') || targetDrivesList[0] || { id: 'Desktop' };
      setTargetDrive(preferred.id);
      lastTargetDriveRef.current = preferred.id;
      setSelectedSubFolder('');
      fetchRemoteFolders(preferred.id, targetPeer);
    }
  }, [targetPeer?.id]);

  const handleTargetDriveChange = (newDrive: string) => {
    setTargetDrive(newDrive);
    if (newDrive !== lastTargetDriveRef.current) {
      lastTargetDriveRef.current = newDrive;
      setSelectedSubFolder('');
      if (targetPeer) {
        fetchRemoteFolders(newDrive, targetPeer);
      }
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
      {/* Drive Selectors Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
        {/* Source Drive */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t.sourceDrive}</span>
          </label>
          <select
            value={sourceDrive}
            onChange={(e) => setSourceDrive(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="Any Drive (Windows File Explorer)">{lang === 'bn' ? 'যেকোনো ড্রাইভ (Windows Explorer)' : 'Any Drive / File Explorer'}</option>
            <option value="C:\ (Local Disk)">C:\ (Local Disk / Desktop)</option>
            <option value="D:\ (Data Drive)">D:\ (Data Drive)</option>
            <option value="E:\ (Backup Drive)">E:\ (Backup / Media Drive)</option>
            <option value="F:\ (USB / Pen Drive)">F:\ (USB / Pen Drive)</option>
          </select>
          <span className="text-[11px] text-slate-500 block">
            {lang === 'bn'
              ? 'আপনার পিসির যেকোনো ড্রাইভ থেকে ফাইল আনতে পারেন'
              : 'Pick or drag files from any drive on this PC'}
          </span>
        </div>

        {/* Target Drive on Destination PC */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.targetDrive}</span>
            </label>
            {targetPeer && (
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{lang === 'bn' ? `${targetDrivesList.length}টি রিয়েল ড্রাইভ পাওয়া গেছে` : `${targetDrivesList.length} drives detected`}</span>
              </span>
            )}
          </div>

          <select
            value={targetPeer ? targetDrive : ''}
            disabled={!targetPeer}
            onChange={(e) => handleTargetDriveChange(e.target.value)}
            className={`w-full px-3 py-2 text-xs rounded-lg text-slate-100 focus:outline-none transition-colors cursor-pointer ${
              targetPeer
                ? 'bg-slate-900 border border-emerald-500/50 focus:border-emerald-400'
                : 'bg-slate-900/60 border border-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {targetPeer ? (
              targetDrivesList.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  💾 {opt.label}
                </option>
              ))
            ) : (
              <option value="" disabled>
                {lang === 'bn'
                  ? '⚠️ কোনো পিসি কানেক্টেড নেই (কানেক্ট হলে অপর পিসির রিয়েল ড্রাইভ দেখাবে)'
                  : '⚠️ No PC connected (connect to detect remote drives)'}
              </option>
            )}
          </select>

          <span className="text-[11px] text-slate-400 block">
            {targetPeer
              ? (lang === 'bn'
                  ? `কানেক্টেড ${targetPeer.name}-এর এই নির্বাচিত ড্রাইভে ফাইল সরাসরি পৌঁছাবে`
                  : `Files will be saved into this drive on connected ${targetPeer.name}`)
              : (lang === 'bn'
                  ? 'ওয়াইফাই বা ডাইরেক্ট আইপি দিয়ে অন্য পিসির সাথে কানেক্ট করলে তার রিয়েল ড্রাইভগুলো এখানে আসবে'
                  : 'Connect to another PC via Wi-Fi or Direct IP to see its real drives')}
          </span>

          {/* Subfolder Browser & Create New Folder UI */}
          {targetPeer && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2 mt-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-medium flex items-center gap-1">
                  <Folder className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{lang === 'bn' ? 'টার্গেট ফোল্ডার নির্বাচন' : 'Destination Subfolder'}:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fetchRemoteFolders(targetDrive, targetPeer)}
                    disabled={isLoadingFolders}
                    className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
                    title={lang === 'bn' ? 'ফোল্ডার তালিকা রিফ্রেশ করুন' : 'Refresh folder list'}
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingFolders ? 'animate-spin text-emerald-400' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                    className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/60 px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{lang === 'bn' ? 'নতুন ফোল্ডার তৈরি করুন' : 'New Folder'}</span>
                  </button>
                </div>
              </div>

              {/* Folder Selector Dropdown */}
              <select
                value={selectedSubFolder}
                onChange={(e) => setSelectedSubFolder(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-900/90 border border-emerald-500/40 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
              >
                <option value="">
                  📁 {lang === 'bn' ? '[ ড্রাইভের রুট / সরাসরি ড্রাইভে (Root Folder) ]' : '[ Drive Root Folder ]'}
                </option>
                {remoteFolders.map((folder) => (
                  <option key={folder} value={folder}>
                    📂 {folder}
                  </option>
                ))}
              </select>

              {/* Inline Create Folder Form */}
              {isCreatingFolder && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/70 space-y-2 animate-in fade-in duration-150">
                  <span className="text-[11px] font-medium text-emerald-300 block">
                    {lang === 'bn'
                      ? `"${targetDrive.split(' (')[0]}" ড্রাইভে নতুন ফোল্ডারের নাম লিখুন:`
                      : `Enter new folder name on drive "${targetDrive.split(' (')[0]}":`}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newFolderNameInput}
                      onChange={(e) => setNewFolderNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateRemoteFolder();
                        }
                      }}
                      placeholder={lang === 'bn' ? 'যেমন: Client_Photos' : 'e.g. My_Files'}
                      className="flex-1 px-2.5 py-1 text-xs bg-slate-900 border border-emerald-600/50 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateRemoteFolder}
                      disabled={isCreatingFolderLoading || !newFolderNameInput.trim()}
                      className="px-2.5 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {isCreatingFolderLoading ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      <span>{lang === 'bn' ? 'তৈরি করুন' : 'Create'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingFolder(false)}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}

              {/* Selected exact destination path preview */}
              <div className="text-[11px] text-emerald-400/90 font-mono flex items-center gap-1 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/40">
                <FolderOpen className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">
                  {lang === 'bn' ? 'গন্তব্য পাথ: ' : 'Target Path: '}
                  {targetDrive.split(' (')[0].trim()}
                  {selectedSubFolder ? (targetDrive.endsWith('\\') || targetDrive.endsWith('/') ? '' : '\\') + selectedSubFolder : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden File and Folder Inputs (positioned outside clickable container to prevent event collision) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFolderInputChange}
      />

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          isDragOver
            ? 'border-indigo-400 bg-indigo-950/40 shadow-inner'
            : 'border-slate-700/80 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-950/60'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${
              isDragOver
                ? 'bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-600/30'
                : 'bg-indigo-500/10 text-indigo-400'
            }`}
          >
            <UploadCloud className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">
              {isDragOver
                ? lang === 'bn'
                  ? 'এখনই ড্রপ করুন!'
                  : 'Drop Files Now!'
                : t.dragDropTitle}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {t.dragDropSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-3.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.browseFiles}</span>
            </button>

            <button
              type="button"
              onClick={handleBrowseFolderClick}
              className="px-3.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.browseFolder}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selected Files Preview & Recipient Action */}
      {selectedFiles.length > 0 && (
        <div className="space-y-4 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">
                {lang === 'bn' ? 'নির্বাচিত ফাইলসমূহ' : 'Selected Files'} (
                {selectedFiles.length})
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-indigo-300 font-mono tabular-nums">
                {formatBytes(totalSize)}
              </span>
            </div>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              {lang === 'bn' ? 'সব মুছুন' : 'Clear all'}
            </button>
          </div>

          {/* Files List */}
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-200 font-medium truncate">
                    {(file as any).relativePath || file.webkitRelativePath || file.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-slate-500 font-mono tabular-nums text-[11px]">
                    {formatBytes(file.size)}
                  </span>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-slate-500 hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Target Recipient Selector & Send Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
            {/* Recipient selection toggle */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-400 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendToAll}
                  onChange={(e) => setSendToAll(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span>{t.sendToAll}</span>
              </label>

              {!sendToAll && peers.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>{t.sendTo}:</span>
                  <select
                    value={selectedPeerId || (peers[0]?.id ?? '')}
                    onChange={(e) => onSelectPeer(e.target.value)}
                    className="px-2 py-1 bg-slate-950 border border-slate-700 rounded-md text-slate-200 text-xs"
                  >
                    {peers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Big Send Button */}
            <button
              onClick={handleStartTransfer}
              disabled={peers.length === 0}
              className={`px-5 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                peers.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-[0.98]'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {t.startTransfer} (
                {sendToAll
                  ? `${peers.length} ${lang === 'bn' ? 'পিসিতে' : 'devices'}`
                  : peers.find((p) => p.id === (selectedPeerId || peers[0]?.id))?.name || (lang === 'bn' ? 'পিসিতে' : 'device')}
                )
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
