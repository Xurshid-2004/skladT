"use client";

import { useState } from "react";
import { ChatMessage } from "@/lib/types";
import { approveOrReject } from "@/lib/firebase/approval-service";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

interface RequestCardProps {
  message: ChatMessage;
  currentUserCode: string;
  currentUserName: string;
  isAdmin: boolean;
}

export default function RequestCard({ message, currentUserCode, currentUserName, isAdmin }: RequestCardProps) {
  const [loading, setLoading] = useState(false);
  const [showSutkaModal, setShowSutkaModal] = useState(false);
  const [sutka, setSutka] = useState(1);

  const { request } = message;
  if (!request) return null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      await approveOrReject(
        message.id, 
        true, 
        sutka, 
        currentUserCode, 
        currentUserName, 
        message.senderStation || 'unknown', 
        message.chatScope
      );
      setShowSutkaModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await approveOrReject(
        message.id, 
        false, 
        0, 
        currentUserCode, 
        currentUserName, 
        message.senderStation || 'unknown', 
        message.chatScope
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isPending = request.status === 'pending';
  const isApproved = request.status === 'approved';
  const isRejected = request.status === 'rejected';

  return (
    <div className={`p-2 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all shadow-2xl hover:shadow-3xl ${
      isApproved ? "bg-success/5 border-success/20" : 
      isRejected ? "bg-danger/5 border-danger/20" : 
      "bg-primary/5 border-primary/10"
    }`}>
      <div className="flex items-center gap-2 mb-3">
        {request.requestType === 'lokomotiv' ? "🚂" : "🏭"}
        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
          {request.requestType} So'rovi — {request.status}
        </span>
      </div>

      <div className="space-y-1 text-sm">
        {request.requestType === 'lokomotiv' ? (
          <>
            <p><b>Seriya:</b> {request.seriya}</p>
            <p><b>Raqam:</b> {request.lokomotivNumber}</p>
            <p><b>Tur:</b> <span className="uppercase font-black text-[10px]">{request.requestKind}</span></p>
          </>
        ) : (
          <>
            <p><b>Korxona:</b> {request.korxonaNomi}</p>
            <p><b>Miqdor:</b> {request.qancha} kg</p>
            <p><b>Sutka:</b> {request.sutka}</p>
          </>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-black/5">
        {isPending && isAdmin && (
          <div className="flex gap-2">
            <button
              disabled={loading}
              onClick={() => setShowSutkaModal(true)}
              className="flex-1 py-2 bg-success text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-success/20"
            >
              HA
            </button>
            <button
              disabled={loading}
              onClick={handleReject}
              className="flex-1 py-2 bg-danger text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-danger/20"
            >
              YO'Q
            </button>
          </div>
        )}

        {isApproved && (
          <div className="text-success space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-black uppercase">
              <CheckCircle2 className="w-3 h-3" /> Tasdiqladi: {request.approvedByName || request.approvedBy}
            </div>
            <p className="text-[10px] font-bold opacity-80">{request.sutkalikLimit} sutkalik limit berildi</p>
            <p className="text-[10px] opacity-60">{format(request.approvedAt || Date.now(), "HH:mm dd/MM/yyyy")}</p>
          </div>
        )}

        {isRejected && (
          <div className="text-danger flex items-center gap-1 text-[10px] font-black uppercase">
            <XCircle className="w-3 h-3" /> Rad etildi
          </div>
        )}

        {isPending && !isAdmin && (
          <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-black uppercase italic animate-pulse">
            <Clock className="w-3 h-3" /> Admin javobini kutmoqda...
          </div>
        )}
      </div>

      {/* Sutka Modal */}
      {showSutkaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-background p-6 rounded-3xl border-2 border-primary/20 shadow-2xl w-full max-w-xs animate-in zoom-in-95">
            <h4 className="text-center font-black text-primary mb-4">NECHA SUTKALIK LIMIT?</h4>
            <input
              type="number"
              value={sutka}
              onChange={(e) => setSutka(Number(e.target.value))}
              className="w-full h-14 text-center text-2xl font-black bg-muted rounded-2xl mb-6 focus:outline-none focus:ring-2 focus:ring-primary"
              min={1}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowSutkaModal(false)} className="flex-1 py-3 bg-muted rounded-xl font-bold uppercase">Bekor</button>
              <button
                onClick={handleApprove}
                disabled={loading}
                className="flex-[2] py-3 bg-success text-white rounded-xl font-black uppercase flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "TASDIQLASH"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
