import React, { useState } from 'react';
import { Monitor, Laptop, Smartphone, Edit2, Check, FolderCheck, HardDrive, Wifi } from 'lucide-react';
import { Language, translations } from '../translations';
import { PeerInfo } from '../types';
import { isFileSystemAccessSupported, requestDirectoryPicker, clearSelectedDirectory } from '../utils/fileSystem';

interface MyDeviceCardProps {
  selfInfo: PeerInfo;
  lang: Language;
  onUpdateName: (newName: string) => void;
  onUpdateDeviceType: (newType: 'desktop' | 'laptop' | 'mobile') => void;
  onUpdateNetworkTag: (newTag: string) => void;
}

export const MyDeviceCard: React.FC<MyDeviceCardProps> = ({
  selfInfo,
  lang,
  onUpdateName,
  onUpdateDeviceType,
  onUpdateNetworkTag,
}) => {
  const t = translations[lang];
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(selfInfo.name);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const hasFsAccess = isFileSystemAccessSupported();

  const handleSaveName = () => {
    if (nameInput.trim()) {
      onUpdateName(nameInput.trim());
      setIsEditing(false);
    }
  };

  const handlePickFolder = async () => {
    const result = await requestDirectoryPicker();
    if (result) {
      setSelectedFolder(result.name);
    }
  };

  const handleClearFolder = () => {
    clearSelectedDirectory();
    setSelectedFolder(null);
  };

  const DeviceIcon = selfInfo.deviceType === 'laptop' ? Laptop : selfInfo.deviceType === 'mobile' ? Smartphone : Monitor;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Device Avatar & Info */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <DeviceIcon className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-400">
                {t.myDevice}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>{selfInfo.networkTag}</span>
              </span>
              {selfInfo.ip && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-xs text-indigo-300 font-mono">
                    IP: {selfInfo.ip}
                  </span>
                </>
              )}
            </div>

            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="px-2.5 py-1 text-sm bg-slate-950 border border-indigo-500 rounded-md text-white focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  {selfInfo.name}
                </h2>
                <button
                  onClick={() => {
                    setNameInput(selfInfo.name);
                    setIsEditing(true);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  title={t.editDeviceName}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Settings & Drive selection */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Device Type Select */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => onUpdateDeviceType('desktop')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                selfInfo.deviceType === 'desktop'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.desktop}
            </button>
            <button
              onClick={() => onUpdateDeviceType('laptop')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                selfInfo.deviceType === 'laptop'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.laptop}
            </button>
          </div>

          {/* Network tag toggle (Wi-Fi Dongle vs Ethernet vs Wi-Fi) */}
          <button
            onClick={() => {
              const next =
                selfInfo.networkTag === 'Wi-Fi Dongle'
                  ? 'Wi-Fi'
                  : selfInfo.networkTag === 'Wi-Fi'
                  ? 'Ethernet LAN'
                  : 'Wi-Fi Dongle';
              onUpdateNetworkTag(next);
            }}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-300 flex items-center gap-1.5 cursor-pointer"
            title="Click to toggle network type"
          >
            <Wifi className="w-3.5 h-3.5 text-indigo-400" />
            <span>{selfInfo.networkTag}</span>
          </button>
        </div>
      </div>

      {/* Destination Drive / Folder Configuration (Crucial for the user request) */}
      <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <HardDrive className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            {t.targetFolderConfigured}{' '}
            <strong className="text-white font-mono font-medium">
              {selectedFolder ? `${selectedFolder}` : t.notConfigured}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasFsAccess ? (
            <button
              onClick={handlePickFolder}
              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FolderCheck className="w-3.5 h-3.5" />
              <span>{t.selectTargetFolderBtn}</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-500 italic">
              {lang === 'bn' ? 'ফাইল ডিফল্ট ডাউনলোড ড্রাইভে যাবে' : 'Files save to default downloads folder'}
            </span>
          )}

          {selectedFolder && (
            <button
              onClick={handleClearFolder}
              className="text-slate-500 hover:text-slate-300 transition-colors text-[11px] underline cursor-pointer"
            >
              {lang === 'bn' ? 'রিসেট' : 'Reset'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
