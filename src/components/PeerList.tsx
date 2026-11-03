import React, { useState } from 'react';
import { Monitor, Laptop, Smartphone, Send, HardDrive, Wifi, Plus } from 'lucide-react';
import { Language, translations } from '../translations';
import { PeerInfo } from '../types';

interface PeerListProps {
  peers: PeerInfo[];
  selectedPeerId: string | null;
  onSelectPeer: (peerId: string | null) => void;
  onDropFilesToPeer: (peer: PeerInfo, files: FileList | File[]) => void;
  lang: Language;
  onOpenConnectModal: () => void;
}

export const PeerList: React.FC<PeerListProps> = ({
  peers,
  selectedPeerId,
  onSelectPeer,
  onDropFilesToPeer,
  lang,
  onOpenConnectModal,
}) => {
  const t = translations[lang];
  const [dragOverPeerId, setDragOverPeerId] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, peerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPeerId(peerId);
  };

  const handleDragLeave = (e: React.DragEvent, peerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverPeerId === peerId) {
      setDragOverPeerId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, peer: PeerInfo) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPeerId(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFilesToPeer(peer, e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span>{t.connectedDevices}</span>
          <span className="text-xs font-mono font-normal text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">
            {peers.length}
          </span>
        </h3>

        <button
          onClick={onOpenConnectModal}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'আরেকটি পিসি যুক্ত করুন' : 'Add Device'}</span>
        </button>
      </div>

      {peers.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
            <Wifi className="w-6 h-6 animate-pulse text-indigo-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-slate-300">
              {t.noDevicesFound}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {t.noDevicesHelp}
            </p>
          </div>
          <button
            onClick={onOpenConnectModal}
            className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>{t.openConnectModal}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {peers.map((peer) => {
            const isSelected = selectedPeerId === peer.id;
            const isDraggingOver = dragOverPeerId === peer.id;
            const DeviceIcon =
              peer.deviceType === 'laptop'
                ? Laptop
                : peer.deviceType === 'mobile'
                ? Smartphone
                : Monitor;

            return (
              <div
                key={peer.id}
                onDragOver={(e) => handleDragOver(e, peer.id)}
                onDragLeave={(e) => handleDragLeave(e, peer.id)}
                onDrop={(e) => handleDrop(e, peer)}
                onClick={() => onSelectPeer(isSelected ? null : peer.id)}
                className={`relative group rounded-xl p-4 transition-all cursor-pointer border ${
                  isDraggingOver
                    ? 'border-indigo-400 bg-indigo-950/40 scale-[1.02] shadow-lg shadow-indigo-500/20'
                    : isSelected
                    ? 'border-indigo-500/80 bg-slate-900 ring-1 ring-indigo-500/50'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        isDraggingOver
                          ? 'bg-indigo-600 text-white'
                          : isSelected
                          ? 'bg-indigo-600/30 text-indigo-300'
                          : 'bg-slate-800 text-slate-300 group-hover:text-white'
                      }`}
                    >
                      <DeviceIcon className="w-5 h-5" />
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {peer.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{peer.networkTag}</span>
                        {peer.ip && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-slate-500">{peer.ip}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
                    }`}
                  >
                    {isSelected
                      ? lang === 'bn' ? 'নির্বাচিত' : 'Selected'
                      : lang === 'bn' ? 'সিলেক্ট' : 'Select'}
                  </span>
                </div>

                {/* Target drives configured by this peer */}
                {peer.targetDrives && peer.targetDrives.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <HardDrive className="w-3 h-3 text-slate-500" />
                    <span>{lang === 'bn' ? 'ড্রাইভসমূহ:' : 'Drives:'}</span>
                    <span className="font-mono text-slate-300">
                      {peer.targetDrives.join(', ')}
                    </span>
                  </div>
                )}

                {/* Drop instruction overlay on drag */}
                {isDraggingOver && (
                  <div className="absolute inset-0 bg-indigo-600/90 rounded-xl flex items-center justify-center text-white text-xs font-semibold backdrop-blur-xs animate-in fade-in duration-100">
                    <Send className="w-4 h-4 mr-1.5 animate-bounce" />
                    <span>
                      {lang === 'bn'
                        ? `${peer.name}-এ ফাইল ছাড়ুন!`
                        : `Drop file to send to ${peer.name}!`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
