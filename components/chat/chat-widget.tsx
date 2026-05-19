"use client"; 
  
import { useState, useEffect, useRef } from 'react'; 
import { MessageCircle, X, Send, Truck, Building2, Trash2, Loader2 } from 'lucide-react'; 
import { subscribeToChatMessages, sendMessage, deleteMessage } from '@/lib/firebase/chat-service'; 
import { getSession } from '@/lib/utils/session'; 
import { ChatMessage, ChatType, Session } from '@/lib/types';
import { format } from 'date-fns';
import LokomotivRequestForm from './lokomotiv-request-form'; 
import KorxonaRequestForm from './korxona-request-form'; 
import RequestCard from './request-card'; 
import { notifyLimitRequest } from '@/lib/telegram/bot-service';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatType>('umumiy');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLokomotivForm, setShowLokomotivForm] = useState(false);
  const [showKorxonaForm, setShowKorxonaForm] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  useEffect(() => {
    if (!session) return;

    const chatScope = activeTab === 'umumiy' ? 'global' : 
                      activeTab === 'uzel' ? (session.nodeId || 'global') : 'admin';

    const unsubscribe = subscribeToChatMessages(activeTab, chatScope, (newMessages) => {
      setMessages(newMessages);
      if (!isOpen) setUnreadCount(prev => prev + 1);
    });

    return () => unsubscribe();
  }, [activeTab, session, isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!session) return null;

  const handleSendMessage = async () => {
    if (!inputText.trim() || loading) return;

    setLoading(true);
    try {
      await sendMessage({
        chatType: activeTab,
        chatScope: activeTab === 'umumiy' ? 'global' : 
                   activeTab === 'uzel' ? (session.nodeId || 'global') : 'admin',
        senderCode: session.code,
        senderName: session.displayName,
        senderRole: session.role,
        senderStation: session.stationId || undefined,
        senderNode: session.nodeId || undefined,
        type: 'text',
        text: inputText,
      });
      setInputText("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSubmit = async (requestData: any, type: 'lokomotiv' | 'korxona') => {
    setLoading(true);
    const scope = activeTab === 'uzel' ? (session.nodeId || 'global') : 'global';
    try {
      await sendMessage({
        chatType: activeTab,
        chatScope: scope,
        senderCode: session.code,
        senderName: session.displayName,
        senderRole: session.role,
        senderStation: session.stationId || undefined,
        senderNode: session.nodeId || undefined,
        type: type === 'lokomotiv' ? 'lokomotiv_request' : 'korxona_request',
        request: {
          ...requestData,
          requestType: type,
          status: 'pending',
        },
      });

      // Notify Telegram
      const details = type === 'lokomotiv' 
        ? `Seriya: ${requestData.seriya}, №: ${requestData.lokomotivNumber}, Tur: ${requestData.requestKind}`
        : `Korxona: ${requestData.korxonaNomi}, Miqdor: ${requestData.qancha}kg, Sutka: ${requestData.sutka}`;
      
      notifyLimitRequest(type, details, session.displayName, session.stationId || 'Noma\'lum');

      setShowLokomotivForm(false);
      setShowKorxonaForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = session.role === 'admin' || session.role === 'developer';

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[95vw] md:w-[450px] h-[90vh] md:h-[80vh] bg-background/80 backdrop-blur-xl border-2 border-primary/20 rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-500">
          {/* Header */}
          <div className="p-6 bg-primary text-white flex items-center justify-between">
            <div>
              <h2 className="font-black tracking-tighter text-xl uppercase">LOYIHA CHATI</h2>
              <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{activeTab} chat faol</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex p-2 bg-muted/30 border-b border-primary/5">
            <button onClick={() => setActiveTab('umumiy')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'umumiy' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:bg-primary/5'}`}>Umumiy</button>
            <button onClick={() => setActiveTab('uzel')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'uzel' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:bg-primary/5'}`}>Uzel</button>
            {isAdmin && (
              <button onClick={() => setActiveTab('admin')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'admin' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:bg-primary/5'}`}>Admin</button>
            )}
          </div>

          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/10">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.senderCode === session.code ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[10px] font-black uppercase opacity-40">{msg.senderName}</span>
                  <span className="text-[8px] font-bold opacity-30">{format(msg.createdAt, "HH:mm")}</span>
                </div>
                
                <div className={`max-w-[85%] rounded-3xl p-4 shadow-sm relative group ${
                  msg.senderCode === session.code 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-background border border-primary/5 rounded-tl-none'
                }`}>
                  {msg.type === 'text' && <p className="text-sm font-medium leading-relaxed">{msg.text}</p>}
                  {(msg.type === 'lokomotiv_request' || msg.type === 'korxona_request') && (
                    <RequestCard 
                      message={msg} 
                      currentUserCode={session.code} 
                      currentUserName={session.displayName}
                      isAdmin={isAdmin}
                    />
                  )}

                  {/* Delete Button */}
                  {(msg.senderCode === session.code || isAdmin) && (
                    <button 
                      onClick={() => deleteMessage(msg.id)}
                      className={`absolute top-0 ${msg.senderCode === session.code ? '-left-8' : '-right-8'} p-2 text-danger opacity-0 group-hover:opacity-100 transition-opacity`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Request Forms */}
          {showLokomotivForm && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <LokomotivRequestForm onSubmit={(d) => handleRequestSubmit(d, 'lokomotiv')} onCancel={() => setShowLokomotivForm(false)} />
            </div>
          )}
          {showKorxonaForm && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <KorxonaRequestForm stationId={session.stationId || ""} onSubmit={(d) => handleRequestSubmit(d, 'korxona')} onCancel={() => setShowKorxonaForm(false)} />
            </div>
          )}

          {/* Footer Input */}
          <div className="p-6 bg-background border-t-2 border-primary/5 space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setShowLokomotivForm(true)} className="p-3 bg-muted hover:bg-primary/10 text-primary rounded-2xl transition-colors"><Truck className="w-5 h-5" /></button>
              <button onClick={() => setShowKorxonaForm(true)} className="p-3 bg-muted hover:bg-primary/10 text-primary rounded-2xl transition-colors"><Building2 className="w-5 h-5" /></button>
            </div>
            
            <div className="flex gap-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Xabar yozing..."
                className="flex-1 h-14 px-6 bg-muted/50 border-2 border-primary/5 rounded-2xl focus:outline-none focus:border-primary font-bold transition-all"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || loading}
                className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setUnreadCount(0);
        }}
        className={`w-16 h-16 bg-[#f59e0b] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all relative ${!isOpen && unreadCount > 0 ? 'animate-pulse' : ''}`}
      >
        {isOpen ? <X className="w-8 h-8" /> : <MessageCircle className="w-8 h-8" />}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-danger text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-background">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
