"use client";

import { useState } from "react";
import { 
  sendTelegramMessage, 
  notifyDeviceLocked, 
  notifyLimitRequest, 
  notifyOverLimitEntry,
  sendDailyReport 
} from "@/lib/telegram/bot-service";
import { Loader2, Send, Lock, Bell, AlertTriangle, BarChart } from "lucide-react";

export default function BotTestPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; message: string; ok: boolean } | null>(null);

  const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
  const ADMIN_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_ADMIN_CHAT_ID;

  const handleTest = async (type: string, fn: () => Promise<any>) => {
    setLoading(type);
    setResult(null);
    try {
      const res = await fn();
      if (res && res.ok) {
        setResult({ type, message: "✅ Muvaffaqiyatli yuborildi!", ok: true });
      } else {
        setResult({ type, message: `❌ Xato: ${res?.error || "Noma'lum xato"}`, ok: false });
      }
    } catch (error) {
      setResult({ type, message: `❌ Xato: ${String(error)}`, ok: false });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-black text-primary mb-2 uppercase tracking-tight">Telegram Bot Test</h1>
        <p className="text-muted-foreground">Bot integratsiyasini tekshirish uchun vositalar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Simple Message Test */}
        <div className="bg-card border-2 border-primary/10 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Send className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold text-lg">Oddiy xabar</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Telegramga oddiy test xabari yuborish.</p>
          <button
            onClick={() => handleTest("oddiy", () => sendTelegramMessage("🤖 <b>TEST:</b> Bu tizimdan avtomatik yuborilgan xabar!"))}
            disabled={!!loading}
            className="w-full py-3 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2"
          >
            {loading === "oddiy" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Test xabar yuborish"}
          </button>
        </div>

        {/* Lock Test */}
        <div className="bg-card border-2 border-primary/10 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-danger/10 rounded-2xl">
              <Lock className="w-6 h-6 text-danger" />
            </div>
            <h3 className="font-bold text-lg">Bloklash xabari</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Qurilma bloklanganda yuboriladigan xabar formati.</p>
          <button
            onClick={() => handleTest("lock", () => notifyDeviceLocked("test-device-id-123", "9999", "192.168.1.1"))}
            disabled={!!loading}
            className="w-full py-3 bg-danger/10 text-danger hover:bg-danger hover:text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2"
          >
            {loading === "lock" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Bloklash test"}
          </button>
        </div>

        {/* Limit Request Test */}
        <div className="bg-card border-2 border-primary/10 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-warning/10 rounded-2xl">
              <Bell className="w-6 h-6 text-warning" />
            </div>
            <h3 className="font-bold text-lg">Limit so'rovi</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Chat orqali so'ralgan limit xabari formati.</p>
          <button
            onClick={() => handleTest("request", () => notifyLimitRequest("lokomotiv", "Seriya: YUK, №: 1234, Tur: Poezd bilan", "Ali Valiyev", "Toshkent Uzel"))}
            disabled={!!loading}
            className="w-full py-3 bg-warning/10 text-warning hover:bg-warning hover:text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2"
          >
            {loading === "request" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Limit so'rovi test"}
          </button>
        </div>

        {/* Over Limit Test */}
        <div className="bg-card border-2 border-primary/10 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-500/10 rounded-2xl">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
            </div>
            <h3 className="font-bold text-lg">Limitdan oshish</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Limitdan ortiqcha yoqilg'i berilganda yuboriladigan ogohlantirish.</p>
          <button
            onClick={() => handleTest("overlimit", () => notifyOverLimitEntry("qurulish", "Vali Aliyev", "Samarqand Uzel", 5000, 4000))}
            disabled={!!loading}
            className="w-full py-3 bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2"
          >
            {loading === "overlimit" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Limit oshish test"}
          </button>
        </div>

        {/* Report Test */}
        <div className="bg-card border-2 border-primary/10 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-success/10 rounded-2xl">
              <BarChart className="w-6 h-6 text-success" />
            </div>
            <h3 className="font-bold text-lg">Kunlik hisobot</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Kunlik avtomatik hisobot yuborish formati.</p>
          <button
            onClick={() => handleTest("report", () => sendDailyReport({
              republicTotals: { sutkaTotal: 150000, teplovozTotal: 100000, korxonaTotal: 30000, qurulishTotal: 20000, dizMasla: 5000 }
            }))}
            disabled={!!loading}
            className="w-full py-3 bg-success/10 text-success hover:bg-success hover:text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2"
          >
            {loading === "report" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Hisobot test"}
          </button>
        </div>
      </div>

      {result && (
        <div className={`p-4 rounded-xl border-2 ${result.ok ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'} animate-in fade-in zoom-in duration-300 font-bold`}>
          {result.message}
        </div>
      )}

      {/* Bot Info */}
      <div className="mt-12 p-6 bg-muted/50 rounded-[2rem] border border-primary/5">
        <h3 className="font-bold text-lg mb-4">Bot Sozlamalari (Environment)</h3>
        <div className="space-y-2 text-sm font-mono">
          <div className="flex justify-between items-center bg-background p-3 rounded-xl">
            <span className="text-muted-foreground">BOT_TOKEN:</span>
            <span className={BOT_TOKEN ? 'text-success' : 'text-danger'}>
              {BOT_TOKEN ? `${BOT_TOKEN.substring(0, 8)}...` : 'O\'rnatilmagan'}
            </span>
          </div>
          <div className="flex justify-between items-center bg-background p-3 rounded-xl">
            <span className="text-muted-foreground">ADMIN_CHAT_ID:</span>
            <span className={ADMIN_CHAT_ID ? 'text-success' : 'text-danger'}>
              {ADMIN_CHAT_ID || 'O\'rnatilmagan'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
