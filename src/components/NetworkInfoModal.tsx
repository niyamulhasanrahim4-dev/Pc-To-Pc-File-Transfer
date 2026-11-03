import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Wifi, Laptop, KeyRound, ExternalLink, ShieldCheck } from 'lucide-react';
import { Language, translations } from '../translations';
import { LocalNetworkInfo } from '../types';

interface NetworkInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  networkInfo: LocalNetworkInfo | null;
  currentRoomId: string;
  onSwitchRoom: (newRoomId: string) => void;
}

export const NetworkInfoModal: React.FC<NetworkInfoModalProps> = ({
  isOpen,
  onClose,
  lang,
  networkInfo,
  currentRoomId,
  onSwitchRoom,
}) => {
  const t = translations[lang];
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [customRoomInput, setCustomRoomInput] = useState<string>(currentRoomId);

  // Determine URLs to connect
  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const localIps = networkInfo?.localIps || [];
  
  // Best target URL to open on other PC
  const primaryUrl = originUrl || (localIps.length > 0 ? `http://${localIps[0].address}:${networkInfo?.port || 3000}` : '');

  useEffect(() => {
    if (primaryUrl && isOpen) {
      QRCode.toDataURL(primaryUrl, {
        margin: 2,
        width: 200,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.warn('QR code generation error:', err));
    }
  }, [primaryUrl, isOpen]);

  if (!isOpen) return null;

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleApplyRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customRoomInput.trim()) {
      onSwitchRoom(customRoomInput.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl text-slate-100 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {t.connectOtherDevice}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'bn'
                  ? 'অন্য পিসি বা ল্যাপটপে এই অ্যাড্রেসটি ওপেন করুন'
                  : 'Open this address on your other PC or laptop'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 pt-5">
          {/* QR code and direct URL */}
          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
            {qrDataUrl ? (
              <div className="bg-white p-2 rounded-xl shrink-0 shadow-md">
                <img
                  src={qrDataUrl}
                  alt="Connection QR Code"
                  className="w-36 h-36 rounded-lg"
                />
              </div>
            ) : (
              <div className="w-36 h-36 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 text-xs shrink-0">
                Generating QR...
              </div>
            )}

            <div className="flex-1 space-y-3 w-full">
              <span className="text-xs font-medium text-slate-400 block">
                {lang === 'bn'
                  ? 'অন্য কম্পিউটারে ব্রাউজারে লিখুন:'
                  : 'Type this in the other browser:'}
              </span>
              <div className="flex items-center gap-2 p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                <span className="font-mono text-xs text-indigo-300 break-all select-all flex-1">
                  {primaryUrl}
                </span>
                <button
                  onClick={() => handleCopy(primaryUrl)}
                  className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedUrl === primaryUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">
                        {t.copied}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t.copy}</span>
                    </>
                  )}
                </button>
              </div>

              {localIps.length > 0 && (
                <div className="text-[11px] text-slate-400 space-y-1">
                  <span className="text-slate-500 block">
                    {lang === 'bn' ? 'অথবা লোকাল আইপি দিয়ে ওপেন করুন:' : 'Or access via local LAN IP:'}
                  </span>
                  {localIps.map((ip) => {
                    const lanUrl = `http://${ip.address}:${networkInfo?.port || 3000}`;
                    return (
                      <div key={ip.address} className="flex items-center justify-between font-mono text-slate-300">
                        <span>{lanUrl}</span>
                        <button
                          onClick={() => handleCopy(lanUrl)}
                          className="hover:text-indigo-400 p-1 text-slate-500 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Wi-Fi Dongle / Local Network Advice */}
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/30 text-xs text-indigo-200/90 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-indigo-300">
              <Wifi className="w-4 h-4 text-indigo-400" />
              <span>{lang === 'bn' ? 'ওয়াইফাই ডঙ্গল টিপস (Wi-Fi Dongle Guide)' : 'Wi-Fi Dongle & LAN Guide'}</span>
            </div>
            <p className="leading-relaxed text-slate-300">
              {lang === 'bn'
                ? 'আপনার পিসির USB Wi-Fi Dongle এবং ল্যাপটপ দুটিই একই ওয়াইফাই রাউটার বা মোবাইলের হটস্পটের সাথে কানেক্টেড থাকতে হবে। একই ওয়াইফাইয়ে থাকলে ট্রান্সফার পুরোপুরি লোকাল নেটওয়ার্কে ১০০% সর্বোচ্চ দ্রুত গতিতে চলবে (কোনো ইন্টারনেট ব্যান্ডউইথ খরচ হবে না)।'
                : 'Ensure both your PC (with Wi-Fi Dongle) and laptop are connected to the exact same Wi-Fi network or mobile hotspot. Transfer occurs locally over LAN at gigabit/dongle speed with zero cloud bandwidth limits.'}
            </p>
          </div>

          {/* Room PIN Code Switcher */}
          <form onSubmit={handleApplyRoom} className="space-y-2 pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                <span>{t.roomCode}</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {currentRoomId === 'local-mesh' ? t.defaultRoom : `PIN: ${currentRoomId}`}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customRoomInput}
                onChange={(e) => setCustomRoomInput(e.target.value)}
                placeholder="local-mesh or PIN (e.g. 123-456)"
                className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'রুম সেট করুন' : 'Set Room'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-6 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer"
          >
            {lang === 'bn' ? 'ঠিক আছে' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
