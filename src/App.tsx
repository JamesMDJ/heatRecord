import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Utensils, 
  Plus, 
  History, 
  Settings, 
  Save, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  PieChart,
  Table as TableIcon,
  LogOut
} from 'lucide-react';
import { estimateNutrition, NutritionInfo } from './services/geminiService';
import { format } from 'date-fns';

interface LogEntry extends NutritionInfo {
  id: string;
  timestamp: string;
}

export default function App() {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [googleTokens, setGoogleTokens] = useState<any>(null);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', msg: string } | null>(null);

  // Load data from localStorage
  useEffect(() => {
    const savedLogs = localStorage.getItem('calorie_logs');
    if (savedLogs) setLogs(JSON.parse(savedLogs));

    const savedTokens = localStorage.getItem('google_tokens');
    if (savedTokens) setGoogleTokens(JSON.parse(savedTokens));

    const savedSheetId = localStorage.getItem('spreadsheet_id');
    if (savedSheetId) setSpreadsheetId(savedSheetId);
  }, []);

  // Save logs to localStorage
  useEffect(() => {
    localStorage.setItem('calorie_logs', JSON.stringify(logs));
  }, [logs]);

  // Handle Google Auth Message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        setGoogleTokens(tokens);
        localStorage.setItem('google_tokens', JSON.stringify(tokens));
        showStatus('success', '成功連結 Google 帳號！');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const showStatus = (type: 'success' | 'error' | 'info', msg: string) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 5000);
  };

  const handleAddFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    try {
      const nutrition = await estimateNutrition(input);
      const newEntry: LogEntry = {
        ...nutrition,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      setLogs([newEntry, ...logs]);
      setInput('');
      showStatus('success', `已新增：${nutrition.foodName}`);

      // 自動同步到 Google Sheets
      if (googleTokens && spreadsheetId) {
        await syncToSheets(newEntry);
      }
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.message || '估算失敗，請稍後再試。';
      showStatus('error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setLogs(logs.filter(log => log.id !== id));
  };

  const connectGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const { url } = await res.json();
      window.open(url, 'google_auth', 'width=600,height=700');
    } catch (error) {
      showStatus('error', '無法取得認證網址');
    }
  };

  const logoutGoogle = () => {
    setGoogleTokens(null);
    localStorage.removeItem('google_tokens');
    showStatus('info', '已登出 Google 帳號');
  };

  const syncToSheets = async (entry: LogEntry) => {
    if (!googleTokens) {
      showStatus('error', '請先連結 Google 帳號');
      return;
    }
    if (!spreadsheetId) {
      showStatus('error', '請先設定 Google Sheet ID');
      return;
    }

    try {
      const res = await fetch('/api/sheets/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: googleTokens,
          spreadsheetId,
          values: [
            format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm:ss'),
            entry.foodName,
            entry.calories,
            entry.protein,
            entry.fat,
            entry.carbs
          ]
        })
      });

      if (res.ok) {
        showStatus('success', '已同步至 Google Sheets');
      } else {
        const err = await res.json();
        showStatus('error', `同步失敗: ${err.error}`);
      }
    } catch (error) {
      showStatus('error', '同步時發生錯誤');
    }
  };

  const totalCalories = logs.reduce((sum, log) => sum + log.calories, 0);
  const totalProtein = logs.reduce((sum, log) => sum + log.protein, 0);
  const totalFat = logs.reduce((sum, log) => sum + log.fat, 0);
  const totalCarbs = logs.reduce((sum, log) => sum + log.carbs, 0);

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
              <Utensils size={18} />
            </div>
            <h1 className="font-bold text-lg tracking-tight">AI 營養助手</h1>
          </div>
          <div className="flex items-center gap-3">
            {googleTokens ? (
              <button 
                onClick={logoutGoogle}
                className="text-gray-500 hover:text-red-500 transition-colors"
                title="登出 Google"
              >
                <LogOut size={20} />
              </button>
            ) : (
              <button 
                onClick={connectGoogle}
                className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <TableIcon size={18} />
                <span>連結 Sheets</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Status Toast */}
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium ${
                status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 size={16} /> : 
               status.type === 'error' ? <AlertCircle size={16} /> : <History size={16} />}
              {status.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google Sheets Config */}
        {googleTokens && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-600">Google Sheet 設定</label>
              <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold">已連結</span>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="輸入 Google Sheet ID..."
                value={spreadsheetId}
                onChange={(e) => {
                  setSpreadsheetId(e.target.value);
                  localStorage.setItem('spreadsheet_id', e.target.value);
                }}
                className="flex-1 bg-white border border-emerald-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <p className="text-[10px] text-emerald-600/70">
              * 請確保您的試算表第一行包含：日期, 食物, 熱量, 蛋白質, 脂肪, 碳水。系統將在新增記錄時自動同步。
            </p>
          </motion.div>
        )}

        {/* Input Section */}
        <section className="space-y-4">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">今天吃了什麼？</h2>
            <form onSubmit={handleAddFood} className="space-y-4">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="例如：一個大麥克、一中份薯條和一杯可樂"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all min-h-[120px] resize-none"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute bottom-4 right-4 bg-emerald-500 text-white p-3 rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
                >
                  {loading ? <Loader2 className="animate-spin" size={24} /> : <Plus size={24} />}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Summary Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">總熱量</p>
            <p className="text-2xl font-bold text-emerald-600">{totalCalories}<span className="text-xs font-normal text-gray-400 ml-1">kcal</span></p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">蛋白質</p>
            <p className="text-2xl font-bold text-blue-600">{totalProtein.toFixed(1)}<span className="text-xs font-normal text-gray-400 ml-1">g</span></p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">脂肪</p>
            <p className="text-2xl font-bold text-orange-600">{totalFat.toFixed(1)}<span className="text-xs font-normal text-gray-400 ml-1">g</span></p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">碳水</p>
            <p className="text-2xl font-bold text-purple-600">{totalCarbs.toFixed(1)}<span className="text-xs font-normal text-gray-400 ml-1">g</span></p>
          </div>
        </section>

        {/* Logs List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">今日記錄</h2>
            <div className="flex items-center gap-3">
              {googleTokens && logs.length > 0 && (
                <button 
                  onClick={async () => {
                    setLoading(true);
                    for (const log of logs) {
                      await syncToSheets(log);
                    }
                    setLoading(false);
                    showStatus('success', '所有記錄已嘗試同步');
                  }}
                  className="text-xs text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
                >
                  <Save size={12} />
                  同步全部
                </button>
              )}
              <button 
                onClick={() => {
                  if (confirm('確定要清除所有記錄嗎？')) setLogs([]);
                }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <Trash2 size={12} />
                清除
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">尚無記錄，開始輸入您的第一餐吧！</p>
              </div>
            ) : (
              logs.map((log) => (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{log.foodName}</h3>
                      <p className="text-xs text-gray-400">{format(new Date(log.timestamp), 'HH:mm')} • 份量：{log.servingSize}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {googleTokens && (
                        <button 
                          onClick={() => syncToSheets(log)}
                          className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="同步至 Sheets"
                        >
                          <Save size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(log.id)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-50">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">熱量</p>
                      <p className="text-sm font-bold">{log.calories}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">蛋白</p>
                      <p className="text-sm font-bold">{log.protein}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">脂肪</p>
                      <p className="text-sm font-bold">{log.fat}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">碳水</p>
                      <p className="text-sm font-bold">{log.carbs}g</p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-xs text-gray-400">
          由 AI 自動估算，數值僅供參考。
        </p>
      </footer>
    </div>
  );
}
