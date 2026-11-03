import React from 'react';
import { Wifi, Laptop, ArrowRightLeft, HardDrive, CheckCircle2 } from 'lucide-react';
import { Language, translations } from '../translations';

interface InstructionsSectionProps {
  lang: Language;
}

export const InstructionsSection: React.FC<InstructionsSectionProps> = ({ lang }) => {
  const t = translations[lang];

  return (
    <div id="help-guide" className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Wifi className="w-4 h-4 text-indigo-400" />
        <span>{t.instructionsTitle}</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Step 1 */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
            <span className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-mono text-xs">
              ১
            </span>
            <span>{lang === 'bn' ? 'একই ওয়াইফাই / ডঙ্গল সংযোগ' : 'Same Wi-Fi Network'}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {lang === 'bn'
              ? 'পিসির ইউএসবি ওয়াইফাই ডঙ্গল এবং ল্যাপটপ দুটিকে একই ওয়াইফাই বা মোবাইল হটস্পটে সংযুক্ত করুন।'
              : 'Connect both the PC (using the Wi-Fi dongle) and laptop to the same Wi-Fi or mobile hotspot.'}
          </p>
        </div>

        {/* Step 2 */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <span className="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center font-mono text-xs">
              ২
            </span>
            <span>{lang === 'bn' ? 'ব্রাউজারে পেজটি খুলুন' : 'Open in Browser'}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {lang === 'bn'
              ? 'অন্য পিসি বা ল্যাপটপে ক্রোম/এজ ব্রাউজার খুলে এই পেজের অ্যাড্রেস লিখুন বা কিউআর কোড স্ক্যান করুন।'
              : 'Open Chrome or Edge on the other PC/laptop, type this page URL or scan the QR code.'}
          </p>
        </div>

        {/* Step 3 */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
            <span className="w-6 h-6 rounded-full bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center font-mono text-xs">
              ৩
            </span>
            <span>{lang === 'bn' ? 'ড্র্যাগ & ড্রপ ও ড্রাইভ সিলেক্ট' : 'Drag, Drop & Select Drive'}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {lang === 'bn'
              ? 'উইন্ডোজের যে কোনো ড্রাইভ (C:, D:, E:) থেকে ফাইল টেনে আনুন এবং অপর পিসির কাঙ্ক্ষিত ড্রাইভে সেভ করুন!'
              : 'Drag files from any drive (C:, D:, E:, USB) and transfer directly to the destination drive!'}
          </p>
        </div>
      </div>
    </div>
  );
};
