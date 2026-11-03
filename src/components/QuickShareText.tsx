import React, { useState } from 'react';
import { Send, Copy, Check, MessageSquare, Trash2 } from 'lucide-react';
import { Language, translations } from '../translations';
import { SharedTextItem, PeerInfo } from '../types';

interface QuickShareTextProps {
  items: SharedTextItem[];
  lang: Language;
  peers: PeerInfo[];
  onSendText: (text: string, targetPeerId?: string) => void;
  onClear: () => void;
}

export const QuickShareText: React.FC<QuickShareTextProps> = ({
  items,
  lang,
  peers,
  onSendText,
  onClear,
}) => {
  const t = translations[lang];
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendText(inputText.trim());
    setInputText('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div id="quick-text" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span>{t.quickShare}</span>
        </h3>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.clearHistory}</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t.quickSharePlaceholder}
          className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            inputText.trim()
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>{t.sendText}</span>
        </button>
      </form>

      {items.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start justify-between gap-3 p-3 rounded-lg text-xs border ${
                item.isSelf
                  ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-100'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-200'
              }`}
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-300">
                    {item.isSelf ? (lang === 'bn' ? 'আমি' : 'Me') : item.fromName}
                  </span>
                  <span>·</span>
                  <span className="font-mono text-slate-500">
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="break-all select-all font-mono text-xs">{item.text}</p>
              </div>

              <button
                onClick={() => handleCopy(item.id, item.text)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
              >
                {copiedId === item.id ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">{t.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{t.copy}</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
