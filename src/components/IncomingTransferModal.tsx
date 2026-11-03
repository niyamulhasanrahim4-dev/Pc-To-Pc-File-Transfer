import React, { useState } from 'react';
import { DownloadCloud, HardDrive, X, Check, ShieldAlert } from 'lucide-react';
import { Language, translations } from '../translations';
import { IncomingOffer } from '../types';
import { formatBytes } from '../utils/format';
import { isFileSystemAccessSupported, requestDirectoryPicker } from '../utils/fileSystem';

interface IncomingTransferModalProps {
  offer: IncomingOffer | null;
  lang: Language;
  onAccept: (transferId: string, chosenDrive: string) => void;
  onDecline: (transferId: string) => void;
}

export const IncomingTransferModal: React.FC<IncomingTransferModalProps> = ({
  offer,
  lang,
  onAccept,
  onDecline,
}) => {
  if (!offer) return null;
  const t = translations[lang];

  const defaultDrive = offer.file.suggestedDrive || 'D:\\';
  const [chosenDrive, setChosenDrive] = useState<string>(defaultDrive);
  const [customFolderName, setCustomFolderName] = useState<string | null>(null);

  const driveOptions = [
    { id: 'D:\\', label: 'D:\\ (Data / Files)' },
    { id: 'C:\\', label: 'C:\\ (System / Desktop)' },
    { id: 'E:\\', label: 'E:\\ (Storage / Media)' },
    { id: 'F:\\', label: 'F:\\ (External / USB)' },
    { id: 'Downloads', label: 'Downloads' },
  ];

  const handlePickDirectory = async () => {
    const res = await requestDirectoryPicker();
    if (res) {
      setCustomFolderName(res.name);
      setChosenDrive(res.name);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl text-slate-100 relative space-y-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <DownloadCloud className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {t.incomingOfferTitle}
              </h3>
              <p className="text-xs text-slate-400">
                <strong className="text-indigo-300 font-medium">{offer.fromName}</strong>{' '}
                {t.incomingOfferDesc}
              </p>
            </div>
          </div>
          <button
            onClick={() => onDecline(offer.transferId)}
            className="text-slate-500 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File detail card */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white truncate max-w-[240px]">
              {offer.file.name}
            </span>
            <span className="font-mono text-indigo-300 tabular-nums">
              {formatBytes(offer.file.size)}
            </span>
          </div>

          {offer.file.sourceDrive && (
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <span>{lang === 'bn' ? 'উৎস পিসির ড্রাইভ:' : 'Source PC Drive:'}</span>
              <span className="text-slate-300 font-mono">{offer.file.sourceDrive}</span>
            </div>
          )}
        </div>

        {/* Target drive selector for recipient */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.chooseTargetDrive}</span>
            </span>
            {isFileSystemAccessSupported() && (
              <button
                type="button"
                onClick={handlePickDirectory}
                className="text-indigo-400 hover:text-indigo-300 text-[11px] underline cursor-pointer"
              >
                {lang === 'bn' ? 'ফোল্ডার সিলেক্ট করুন...' : 'Select custom folder...'}
              </button>
            )}
          </label>

          <select
            value={chosenDrive}
            onChange={(e) => setChosenDrive(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {customFolderName && (
              <option value={customFolderName}>
                {customFolderName} ({lang === 'bn' ? 'নির্বাচিত ফোল্ডার' : 'Selected folder'})
              </option>
            )}
            {driveOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={() => onDecline(offer.transferId)}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            {t.decline}
          </button>

          <button
            onClick={() => onAccept(offer.transferId, chosenDrive)}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
          >
            <Check className="w-4 h-4" />
            <span>{t.acceptAndSave}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
