import React, { useState, useMemo } from 'react';
import {
  Wifi,
  Search,
  RotateCw,
  Monitor,
  Laptop,
  Smartphone,
  CheckCircle2,
  HardDrive,
  Link2,
  Unlink,
  Radio,
  Zap,
} from 'lucide-react';
import { Language, translations } from '../translations';
import { PeerInfo } from '../types';

interface WifiScannerHubProps {
  peers: PeerInfo[];
  pairedPeerId: string | null;
  connectingPeerId: string | null;
  onConnectToPeer: (peerId: string) => void;
  onDisconnectPeer: (peerId: string) => void;
  onRefreshScan: () => void;
  isScanning: boolean;
  lang: Language;
  onOpenConnectModal: () => void;
}

export const WifiScannerHub: React.FC<WifiScannerHubProps> = ({
  peers,
  pairedPeerId,
  connectingPeerId,
  onConnectToPeer,
  onDisconnectPeer,
  onRefreshScan,
  isScanning,
  lang,
  onOpenConnectModal,
}) => {
  const t = translations[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [wifiEnabled, setWifiEnabled] = useState(true);

  // Filter peers by search query
  const filteredPeers = useMemo(() => {
    if (!searchQuery.trim()) return peers;
    const q = searchQuery.toLowerCase().trim();
    return peers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.ip && p.ip.toLowerCase().includes(q)) ||
        (p.networkTag && p.networkTag.toLowerCase().includes(q)) ||
        (p.targetDrives && p.targetDrives.some((d) => d.toLowerCase().includes(q)))
    );
  }, [peers, searchQuery]);

  const activePairedPeer = peers.find((p) => p.id === pairedPeerId);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* Top Controller Header: Wi-Fi Mode Toggle & Scan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Radio className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span>{t.wifiScanTitle}</span>
              <span className="text-xs font-mono font-medium text-indigo-400 bg-indigo-950/60 border border-indigo-900/40 px-2 py-0.5 rounded-full">
                {peers.length} {lang === 'bn' ? 'টি পিসি পাওয়া গেছে' : 'detected'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">{t.wifiScanSubtitle}</p>
          </div>
        </div>

        {/* Section 3: Connected PC name, IP, and Disconnect Option */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {activePairedPeer ? (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 shadow-md shadow-emerald-950/40 animate-in fade-in duration-200">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-emerald-300 truncate max-w-[130px] sm:max-w-[190px]" title={activePairedPeer.name}>
                  {activePairedPeer.name}
                </span>
                <span className="text-slate-300 font-mono text-[11px] bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700/80">
                  IP: {activePairedPeer.ip || '192.168.1.x'}
                </span>
              </div>
              <button
                onClick={() => onDisconnectPeer(activePairedPeer.id)}
                className="ml-1 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:text-white bg-rose-950/80 hover:bg-rose-600 border border-rose-700/70 hover:border-rose-500 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                title={lang === 'bn' ? 'সংযোগ বিচ্ছিন্ন করুন' : 'Disconnect this PC'}
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'ডিসকানেক্ট' : 'Disconnect'}</span>
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/50 border border-slate-800 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-600"></span>
              <span>{lang === 'bn' ? 'কোনো পিসি কানেক্টেড নেই' : 'Not Connected'}</span>
            </div>
          )}

          <button
            onClick={() => setWifiEnabled(!wifiEnabled)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
              wifiEnabled
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>
              {wifiEnabled
                ? lang === 'bn' ? 'ওয়াইফাই অন (Wi-Fi ON)' : 'Wi-Fi ON'
                : lang === 'bn' ? 'ওয়াইফাই অফ (Wi-Fi OFF)' : 'Wi-Fi OFF'}
            </span>
          </button>

          <button
            onClick={onRefreshScan}
            disabled={isScanning || !wifiEnabled}
            className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? t.scanning : t.scanRefresh}</span>
          </button>
        </div>
      </div>


      {/* Search Input Bar */}
      {wifiEnabled && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPcPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Wi-Fi Networks / PC List */}
      {!wifiEnabled ? (
        <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-slate-500 text-xs">
          {lang === 'bn' ? 'ওয়াইফাই স্ক্যান বন্ধ রয়েছে। উপরে বাটনে চাপ দিয়ে অন করুন।' : 'Wi-Fi Scan is turned off. Turn it on above.'}
        </div>
      ) : filteredPeers.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-950/50 border border-dashed border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
            <Wifi className="w-6 h-6 animate-pulse text-indigo-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-slate-300">
              {searchQuery ? t.noSearchResult : t.noDevicesFound}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {searchQuery
                ? (lang === 'bn' ? 'ভিন্ন কোনো নাম বা আইপি দিয়ে সার্চ করে দেখুন।' : 'Try searching with a different name or IP.')
                : t.noDevicesHelp}
            </p>
          </div>
          <button
            onClick={onOpenConnectModal}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>{t.openConnectModal}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>{lang === 'bn' ? 'উপলব্ধ পিসি ও ল্যাপটপ তালিকা (মোবাইল ওয়াইফাই স্টাইল)' : 'Available PCs List'}</span>
            <span className="font-mono text-slate-500">{filteredPeers.length} Found</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {filteredPeers.map((peer) => {
              const isPaired = pairedPeerId === peer.id;
              const isConnecting = connectingPeerId === peer.id;
              const DeviceIcon =
                peer.deviceType === 'laptop'
                  ? Laptop
                  : peer.deviceType === 'mobile'
                  ? Smartphone
                  : Monitor;

              return (
                <div
                  key={peer.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                    isPaired
                      ? 'bg-emerald-950/30 border-emerald-500/80 ring-1 ring-emerald-500/30 shadow-md shadow-emerald-950/20'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950/90'
                  }`}
                >
                  {/* Left: Signal Bars + Icon + Details */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Wi-Fi Signal Bars */}
                    <div className="flex items-end gap-0.5 h-5 px-1 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0" title="Wi-Fi Signal 100%">
                      <span className={`w-1 rounded-xs ${isPaired ? 'bg-emerald-400' : 'bg-indigo-400'} h-2`} />
                      <span className={`w-1 rounded-xs ${isPaired ? 'bg-emerald-400' : 'bg-indigo-400'} h-3`} />
                      <span className={`w-1 rounded-xs ${isPaired ? 'bg-emerald-400' : 'bg-indigo-400'} h-4`} />
                      <span className={`w-1 rounded-xs ${isPaired ? 'bg-emerald-400' : 'bg-indigo-400'} h-5`} />
                    </div>

                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isPaired
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <DeviceIcon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-white truncate">
                          {peer.name}
                        </h4>
                        {isPaired && (
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-800/60 px-2 py-0.5 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>🟢 {lang === 'bn' ? 'কানেক্টেড' : 'CONNECTED'}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="text-slate-300">{peer.networkTag}</span>
                        {peer.ip && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="font-mono text-slate-400">{peer.ip}</span>
                          </>
                        )}
                        {peer.targetDrives && peer.targetDrives.length > 0 && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="flex items-center gap-1 text-slate-300 font-mono">
                              <HardDrive className="w-3 h-3 text-slate-500" />
                              <span>{peer.targetDrives.join(', ')}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Connect / Disconnect Action Button */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isPaired ? (
                      <button
                        onClick={() => onDisconnectPeer(peer.id)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>{t.disconnectBtn}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onConnectToPeer(peer.id)}
                        disabled={isConnecting}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg transition-all shadow-sm shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>{isConnecting ? t.connectingBtn : t.connectBtn}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
