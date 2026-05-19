"use client";

import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { syncPendingSubmissions, getPendingSubmissions } from '@/lib/offline/offline-storage';
import { addLokomotivSubmission } from '@/lib/firebase/lokomotiv-service';
import { addSubmission } from '@/lib/firebase/submissions-service';

export default function OnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine);
    checkPending();

    const handleOnline = () => {
      setIsOnline(true);
      syncPending();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodically check for pending items if offline
    const interval = setInterval(checkPending, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const checkPending = async () => {
    try {
      const pending = await getPendingSubmissions();
      setPendingCount(pending.length);
    } catch (error) {
      console.error(error);
    }
  };

  const syncPending = async () => {
    try {
      const pending = await getPendingSubmissions();
      if (pending.length === 0) return;

      setIsSyncing(true);
      
      await syncPendingSubmissions(async (data) => {
        const { id, savedAt, ...uploadData } = data;
        if (uploadData.category === 'lokomotiv') {
          await addLokomotivSubmission(uploadData);
        } else {
          await addSubmission(uploadData.category, uploadData);
        }
      });
      
      setPendingCount(0);
      alert(`${pending.length} ta ma'lumot yuborildi!`);
    } catch (error) {
      console.error("Sync failed", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top-4 transition-colors ${
      isOnline ? 'bg-success text-white' : 'bg-danger text-white'
    }`}>
      {isOnline ? (
        <>
          {isSyncing ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Wifi className="w-4 h-4" />
          )}
          <span>Online {isSyncing && "Sinxronlanmoqda..."}</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Offline</span>
        </>
      )}
      
      {pendingCount > 0 && (
        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
          {pendingCount} ta kutmoqda
        </span>
      )}
    </div>
  );
}
