import React, { useState } from 'react';
import {
  Globe,
  Copy,
  Check,
  ClipboardPaste,
  Link2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Laptop,
} from 'lucide-react';
import { Language, translations } from '../translations';
import { LocalNetworkInfo, PeerInfo } from '../types';

interface DirectIpConnectBarProps {
  myIp: string;
  networkInfo: LocalNetworkInfo | null;
  pairedPeer: PeerInfo | null;
  onConnectByIp: (ip: string) => Promise<boolean | void>;
  lang: Language;
}

export const DirectIpConnectBar: React.FC<DirectIpConnectBarProps> = ({
  myIp,
  networkInfo,
  pairedPeer,
  onConnectByIp,
  lang,
}) => {
  const t = translations[lang];
  const [targetIpInput, setTargetIpInput] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({ type: null, text: '' });
  const [showHelp, setShowHelp] = useState(false);

  // Preferred displayed IP for this machine
  const firstLanIp = networkInfo?.localIps?.[0]?.address;
  const displayIp = myIp && myIp !== '127.0.0.1' && myIp !== '192.168.1.x' ? myIp : firstLanIp || myIp || '192.168.1.x';

  const handleCopyMyIp = () => {
    navigator.clipboard.writeText(displayIp);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTargetIpInput(text.trim());
      }
    } catch {
      // If clipboard read is blocked, focus the input
      const el = document.getElementById('direct-ip-input');
      el?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = targetIpInput.trim();
    if (!clean) return;

    setIsSubmitting(true);
    setStatusMessage({ type: null, text: '' });

    try {
      const result = await onConnectByIp(clean);
      if (result === false) {
        setStatusMessage({
          type: 'error',
          text: t.ipNotFound,
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: t.ipConnectedSuccess,
        });
        setTimeout(() => setStatusMessage({ type: null, text: '' }), 4000);
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: t.ipNotFound,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>{t.directIpTitle}</span>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                title="Help"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </h3>
            <p className="text-xs text-slate-400">{t.directIpSubtitle}</p>
          </div>
        </div>

        {/* My IP Display & Copy Button */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            {t.myPcIp}:
          </span>
          <code className="text-xs font-mono font-bold text-indigo-300 select-all">
            {displayIp}
          </code>
          <button
            onClick={handleCopyMyIp}
            className="p-1 text-slate-400 hover:text-indigo-300 rounded transition-colors cursor-pointer"
            title={t.copyMyIp}
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Help collapse */}
      {showHelp && (
        <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-900/40 text-xs text-indigo-200/90 space-y-1.5 leading-relaxed animate-in fade-in duration-150">
          <p className="font-semibold text-white">
            {lang === 'bn' ? 'কীভাবে ডাইরেক্ট আইপি দিয়ে কানেক্ট করবেন?' : 'How Direct IP Connect Works:'}
          </p>
          <p>
            {lang === 'bn'
              ? '১. আপনার একটি পিসির উপরে প্রদর্শিত আইপি (যেমন: 192.168.1.15) কপি করে অন্য পিসির এই বক্সে পেস্ট করুন।'
              : '1. Copy your PC’s IP address shown above and paste it into the box on the other PC.'}
          </p>
          <p>
            {lang === 'bn'
              ? '২. "সরাসরি কানেক্ট করুন" বাটনে চাপ দিন। সাথে সাথে দুটি পিসির মাঝে সরাসরি গ্রিন সিগনাল জ্বলে উঠবে।'
              : '2. Click "Direct Connect". The green connection signal will illuminate immediately!'}
          </p>
        </div>
      )}

      {/* Direct IP Connect Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <input
            id="direct-ip-input"
            type="text"
            value={targetIpInput}
            onChange={(e) => setTargetIpInput(e.target.value)}
            placeholder={t.pasteTargetIpPlaceholder}
            className="w-full pl-3 pr-20 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
            title="Paste IP from clipboard"
          >
            <ClipboardPaste className="w-3 h-3 text-indigo-400" />
            <span>{lang === 'bn' ? 'পেস্ট' : 'Paste'}</span>
          </button>
        </div>

        <button
          type="submit"
          disabled={!targetIpInput.trim() || isSubmitting}
          className="px-5 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-[0.98]"
        >
          <Link2 className="w-4 h-4" />
          <span>{isSubmitting ? t.ipConnecting : t.directConnectBtn}</span>
        </button>
      </form>

      {/* Status Messages */}
      {statusMessage.type === 'error' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 animate-in fade-in duration-100">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {statusMessage.type === 'success' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/60 text-xs text-emerald-300 animate-in fade-in duration-100">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage.text}</span>
        </div>
      )}

    </div>
  );
};
