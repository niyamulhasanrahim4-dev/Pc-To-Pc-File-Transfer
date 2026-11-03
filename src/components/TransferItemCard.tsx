import React from 'react';
import {
  FileText,
  FileCode,
  FileSpreadsheet,
  Image,
  Video,
  Music,
  Archive,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HardDrive,
  Zap,
  RotateCw,
  FolderOpen,
  Clock,
} from 'lucide-react';
import { Language, translations } from '../translations';
import { TransferItem } from '../types';
import { formatBytes, formatSpeed, formatEta, getFileCategory } from '../utils/format';

interface TransferItemCardProps {
  item: TransferItem;
  lang: Language;
  onCancel: (transferId: string) => void;
  onSaveToDisk: (item: TransferItem) => void;
  onClear: (id: string) => void;
  onOpenRemoteFolder?: (item: TransferItem) => void;
}

export const TransferItemCard: React.FC<TransferItemCardProps> = ({
  item,
  lang,
  onCancel,
  onSaveToDisk,
  onClear,
  onOpenRemoteFolder,
}) => {
  const [remoteOpened, setRemoteOpened] = React.useState(false);
  const t = translations[lang];
  const category = getFileCategory(item.fileName, item.fileType);

  const getCategoryIcon = () => {
    switch (category) {
      case 'image':
        return <Image className="w-5 h-5 text-indigo-400" />;
      case 'video':
        return <Video className="w-5 h-5 text-purple-400" />;
      case 'audio':
        return <Music className="w-5 h-5 text-amber-400" />;
      case 'archive':
        return <Archive className="w-5 h-5 text-emerald-400" />;
      case 'code':
        return <FileCode className="w-5 h-5 text-cyan-400" />;
      default:
        return <FileText className="w-5 h-5 text-slate-400" />;
    }
  };

  const isOngoing = item.status === 'transferring';
  const isQueued = item.status === 'queued';
  const isCompleted = item.status === 'completed';
  const isDeclined = item.status === 'declined';
  const isCancelled = item.status === 'cancelled';
  const isError = item.status === 'error';

  const remainingBytes = Math.max(0, item.fileSize - item.transferredBytes);
  const remainingSeconds =
    item.speedBytesPerSec > 0 ? remainingBytes / item.speedBytesPerSec : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3 transition-colors">
      <div className="flex items-start justify-between gap-3">
        {/* File icon and title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
            {getCategoryIcon()}
          </div>

          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-white truncate max-w-sm sm:max-w-md">
              {item.fileName}
            </h4>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span className="font-mono tabular-nums text-slate-300">
                {formatBytes(item.fileSize)}
              </span>
              <span className="text-slate-600">·</span>
              <span>
                {item.direction === 'send'
                  ? `${lang === 'bn' ? 'প্রেরক -> প্রাপক' : 'To'}: ${item.peerName}`
                  : `${lang === 'bn' ? 'প্রাপক <- প্রেরক' : 'From'}: ${item.peerName}`}
              </span>

              {item.targetDrive && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="flex items-center gap-1 text-emerald-400 font-mono">
                    <HardDrive className="w-3 h-3" />
                    <span>{item.targetDrive}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status / Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {(isOngoing || isQueued) && (
            <button
              onClick={() => onCancel(item.transferId)}
              className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 rounded-md transition-colors cursor-pointer"
            >
              {t.decline}
            </button>
          )}

          {isCompleted && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 bg-emerald-950/50 border border-emerald-800/50 px-2.5 py-1 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {item.direction === 'receive'
                    ? (lang === 'bn' ? 'স্বয়ংক্রিয়ভাবে সেভ হয়েছে' : 'Auto Saved')
                    : (lang === 'bn' ? 'সফলভাবে পাঠানো হয়েছে' : 'Sent Successfully')}
                </span>
              </span>
              <button
                onClick={() => {
                  if (item.direction === 'receive') {
                    fetch('/api/open-folder', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ path: item.targetDrive || 'Desktop' }),
                    }).catch(() => {});
                  } else {
                    onOpenRemoteFolder?.(item);
                    setRemoteOpened(true);
                    setTimeout(() => setRemoteOpened(false), 3000);
                  }
                }}
                className="px-2.5 py-1 text-xs font-medium text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/60 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                title={
                  item.direction === 'receive'
                    ? (lang === 'bn' ? 'Windows ফোল্ডারটি ওপেন করুন' : 'Open folder in File Explorer')
                    : (lang === 'bn' ? `${item.peerName}-এর ${item.targetDrive} ফোল্ডারটি ওপেন করার রিকোয়েস্ট পাঠান` : `Request ${item.peerName} to open ${item.targetDrive}`)
                }
              >
                <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {item.direction === 'receive'
                    ? (lang === 'bn' ? 'ফোল্ডার খুলুন' : 'Open Folder')
                    : remoteOpened
                    ? (lang === 'bn' ? '✓ রিকোয়েস্ট পাঠানো হয়েছে' : '✓ Request Sent')
                    : (lang === 'bn' ? `প্রাপকের ফোল্ডার (${item.peerName})` : `Open on ${item.peerName}`)}
                </span>
              </button>
            </div>
          )}

          {(isCompleted || isDeclined || isCancelled || isError) && (
            <button
              onClick={() => onClear(item.id)}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              title="Remove from list"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar & Speed Indicator */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            {isOngoing && (
              <>
                <span className="flex items-center gap-1 text-indigo-400 font-medium">
                  <Zap className="w-3 h-3 animate-pulse" />
                  <span>{item.mode === 'webrtc' ? t.modeDirectP2P : t.modeRelay}</span>
                </span>
                <span className="text-slate-600">·</span>
                <span className="font-mono tabular-nums text-slate-200 font-medium">
                  {formatSpeed(item.speedBytesPerSec)}
                </span>
                <span className="text-slate-600">·</span>
                <span>
                  {t.eta}: <strong className="font-mono text-slate-200">{formatEta(remainingSeconds)}</strong>
                </span>
              </>
            )}

            {isQueued && (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded text-[11px]">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'bn' ? 'অপেক্ষমাণ (সিরিয়ালে আসবে)' : 'Queued (Sequential)'}</span>
              </span>
            )}

            {isCompleted && (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t.downloadComplete}</span>
              </span>
            )}

            {isDeclined && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'প্রত্যাখ্যাত' : 'Declined'}</span>
              </span>
            )}

            {isCancelled && (
              <span className="flex items-center gap-1 text-slate-500">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{t.cancelled}</span>
              </span>
            )}

            {isError && (
              <span className="flex items-center gap-1 text-rose-400">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{item.errorMsg || t.failed}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono tabular-nums text-slate-300 font-medium">
            <span>
              {formatBytes(item.transferredBytes)} / {formatBytes(item.fileSize)}
            </span>
            <span className="text-indigo-400">
              ({Math.round(item.progress)}%)
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-150 rounded-full ${
              isCompleted
                ? 'bg-emerald-500'
                : isError || isCancelled
                ? 'bg-slate-700'
                : 'bg-indigo-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
          />
        </div>
      </div>
    </div>
  );
};
