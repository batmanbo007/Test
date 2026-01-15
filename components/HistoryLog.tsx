import React from 'react';
import { LogEntry } from '../types';
import { ScrollText, Swords, Skull, Info } from 'lucide-react';

interface Props {
  history: LogEntry[];
}

const HistoryLog: React.FC<Props> = ({ history }) => {
  return (
    <div className="bg-slate-900 h-full p-4 overflow-y-auto">
      <h3 className="text-sm font-bold text-slate-300 uppercase mb-4 sticky top-0 bg-slate-900 py-2 border-b border-slate-800 z-10 flex items-center gap-2">
        <ScrollText size={16} /> Nhật Ký Hành Trình
      </h3>
      
      <div className="space-y-4">
        {[...history].reverse().map((entry) => (
          <div key={entry.id} className="relative pl-6 border-l-2 border-slate-700">
            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-slate-900 
              ${entry.type === 'combat' ? 'bg-red-500' : 
                entry.type === 'milestone' ? 'bg-yellow-500' : 
                entry.type === 'event' ? 'bg-purple-500' : 'bg-blue-500'}`} 
            />
            <div className="text-xs text-slate-500 mb-1 font-mono">Lượt {entry.turn}</div>
            <div className="text-sm text-slate-300 font-bold mb-1">{entry.action}</div>
            <div className="text-sm text-slate-400 italic bg-slate-800/50 p-2 rounded">
              "{entry.result}"
            </div>
            {entry.type === 'combat' && <Swords className="absolute top-2 right-2 text-red-500/20 w-8 h-8" />}
          </div>
        ))}

        {history.length === 0 && (
          <p className="text-center text-slate-600 text-sm mt-10">Chưa có dữ liệu lịch sử.</p>
        )}
      </div>
    </div>
  );
};

export default HistoryLog;
