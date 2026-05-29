"use client";

import { useState } from "react";
import { db } from "@/lib/firebase/config";
import { collection, doc, setDoc, writeBatch, addDoc } from "firebase/firestore";
import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import { ADMIN_CODES } from "@/lib/data/kodlar";
import { Header } from "@/components/layout/header";

export default function SeedPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [progress, setProgress] = useState(0);

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  const handleSeed = async () => {
    setIsSeeding(true);
    setProgress(0);
    setLogs([]);
    addLog("Ma'lumotlarni to'ldirish boshlandi...");

    try {
      // 1. Seed Access Codes
      addLog("Kirish kodlarini yozish boshlandi...");
      const batch = writeBatch(db);
      let codeCount = 0;

      // Worker codes
      ZAPRAVKALAR.forEach((zap) => {
        zap.workerCodes.forEach((code) => {
          const codeDoc = doc(collection(db, "access_codes"), code);
          batch.set(codeDoc, {
            code,
            role: "worker",
            displayName: zap.name,
            nodeId: zap.uzelId,
            stationId: zap.id,
            codeType: "main",
            isActive: true,
            createdAt: Date.now(),
          });
          codeCount++;
        });
        zap.reserveCodes.forEach((code) => {
          const codeDoc = doc(collection(db, "access_codes"), code);
          batch.set(codeDoc, {
            code,
            role: "worker",
            displayName: `${zap.name} (Zaxira)`,
            nodeId: zap.uzelId,
            stationId: zap.id,
            codeType: "reserve",
            isActive: true,
            createdAt: Date.now(),
          });
          codeCount++;
        });
      });

      // Admin codes
      ADMIN_CODES.forEach((code) => {
        const codeDoc = doc(collection(db, "access_codes"), code);
        batch.set(codeDoc, {
          code,
          role: "admin",
          displayName: "Admin",
          nodeId: null,
          stationId: null,
          codeType: "admin",
          isActive: true,
          createdAt: Date.now(),
        });
        codeCount++;
      });

      await batch.commit();
      addLog(`${codeCount} ta kirish kodi yozildi ✅`);
      setProgress(33);

      // 2. Global Settings
      addLog("Global sozlamalarni yozish...");
      await setDoc(doc(db, "settings", "global"), {
        version: "1.0.0",
        isMaintenance: false,
        lockoutTime: 60,
        maxAttempts: 3,
        updatedAt: Date.now(),
        stansiyalar: { 
          default: [],
          toshkent: ['Toshkent-1', 'Chuqursoy', 'Sergeli', 'Nazarbek', 'Hamza']
        },
        tashkilotlar: { 
          default: [],
          toshkent: ['UTY', 'Avtotrans', 'O\'zbekiston temir yo\'llari', 'Yulqurilish']
        },
        ijarachilar: { 
          default: [],
          toshkent: ['Korxona1', 'Korxona2', 'MCHJ Trans']
        },
        manualFields: ['Ortildi', 'Tranzit', 'Almashuv', 'Teplovozlar', 'Karakalpakiya', 'Sariog\'och', 'Hojidavlat'],
        lastUpdated: Date.now()
      });

      // 3. Limits Settings
      addLog("Limit sozlamalarini yozish...");
      await setDoc(doc(db, "settings", "limits"), {
        korxonaLimits: { "Test Korxona": 5000 },
        qurulishLimits: { "Test Qurulish": 3000 },
        korxonaList: { 
          default: ['Test Korxona', 'Korxona 1', 'Korxona 2'],
          toshkent: ['Toshkent Korxona', 'Markaziy Ombor']
        },
        qurulishKorxonaList: { 
          default: ['Test Qurulish', 'Qurulish 1'],
          toshkent: ['Toshkent Yo\'l Qurulish']
        },
        buyruqEgalariList: { 
          default: ['Boshliq A.', 'Mudir B.'],
          toshkent: ['Toshkent Boshlig\'i']
        },
        mashinaRaqamlari: { 
          default: ['01A123AA', '01B456BB'],
          toshkent: ['01T789ZZ']
        },
        obyektList: { 
          default: ['Obyekt 1', 'Obyekt 2'],
          toshkent: ['Toshkent-Markaz Obyekti']
        },
        defaultLimit: 2000,
        lastUpdated: Date.now()
      });
      addLog("Limit sozlamalari yozildi ✅");
      setProgress(66);

      // 4. Welcome Messages
      addLog("Test xabarlarni yozish...");
      const messageId = "test-message-1";
      await setDoc(doc(db, "messages", messageId), {
        chatType: 'umumiy',
        chatScope: 'global',
        senderCode: 'SYSTEM',
        senderName: 'Tizim',
        senderRole: 'admin',
        type: 'text',
        text: 'Xush kelibsiz! Tizim ishga tushirildi.',
        createdAt: Date.now()
      });

      // Test Lokomotiv Request
      await setDoc(doc(db, "messages", "test-req-1"), {
        chatType: 'uzel',
        chatScope: 'uzel-toshkent',
        senderCode: '1111',
        senderName: 'Aliyev V.',
        senderRole: 'worker',
        senderStation: 'toshkent-1',
        senderNode: 'uzel-toshkent',
        type: 'lokomotiv_request',
        request: {
          requestType: 'lokomotiv',
          seriya: '2TE10M',
          lokomotivNumber: '1141',
          requestKind: 'tashqari',
          status: 'pending'
        },
        createdAt: Date.now() - 3600000
      });

      // Test Korxona Request (Approved)
      await setDoc(doc(db, "messages", "test-req-2"), {
        chatType: 'uzel',
        chatScope: 'uzel-toshkent',
        senderCode: '1111',
        senderName: 'Aliyev V.',
        senderRole: 'worker',
        senderStation: 'toshkent-1',
        senderNode: 'uzel-toshkent',
        type: 'korxona_request',
        request: {
          requestType: 'korxona',
          korxonaNomi: 'Test Korxona',
          qancha: 6000,
          sutka: 2,
          status: 'approved',
          approvedBy: '1222',
          approvedByName: 'Admin',
          approvedAt: Date.now() - 1800000,
          sutkalikLimit: 3
        },
        createdAt: Date.now() - 7200000
      });

      // Add corresponding approval record
      await setDoc(doc(db, "approvals", "test-app-1"), {
        messageId: "test-req-2",
        requestType: 'korxona',
        korxonaNomi: 'Test Korxona',
        stationId: 'toshkent-1',
        nodeId: 'uzel-toshkent',
        approvedBy: '1222',
        approvedByName: 'Admin',
        approvedAt: Date.now() - 1800000,
        sutkalikLimit: 3,
        validUntil: Date.now() + (3 * 24 * 60 * 60 * 1000),
        isActive: true
      });

      // 5. Default Questions for No-code
      addLog("Default so'rovnomalarni yozish...");
      const defaultQuestions = [
        { category: 'lokomotiv', label: '1. HARAKAT TURI', fieldKey: 'harakatTuri', fieldType: 'dropdown', options: ['yuk', 'yolovchi', 'manyovr', 'xojalik', 'ijara'], isRequired: true, isVisible: true, order: 0 },
        { category: 'lokomotiv', label: '2. SERIYA', fieldKey: 'rusumi', fieldType: 'dropdown', options: ['TEM2', 'ChME3', '2TE10M', 'TEP70BS'], isRequired: true, isVisible: true, order: 1 },
        { category: 'lokomotiv', label: '3. LOKOMOTIV №', fieldKey: 'lokomotivNumber', fieldType: 'text', isRequired: true, isVisible: true, order: 2 },
        { category: 'lokomotiv', label: '4. QOLDIQ (kg)', fieldKey: 'qoldiq', fieldType: 'number', isRequired: true, isVisible: true, order: 3 },
        { category: 'lokomotiv', label: '5. BERILDI (kg)', fieldKey: 'qanchaBerildi', fieldType: 'number', isRequired: true, isVisible: true, order: 4 },
        { category: 'lokomotiv', label: '6. DIZ MASLA (kg)', fieldKey: 'dizMasla', fieldType: 'number', isRequired: true, isVisible: true, order: 5 },
      ];

      for (const q of defaultQuestions) {
        await addDoc(collection(db, "questions"), { ...q, createdAt: Date.now(), updatedAt: Date.now() });
      }

      // 6. Global Settings for Manual Fields
      addLog("Global sozlamalarni yozish...");
      await setDoc(doc(db, "settings", "global"), {
        manualFieldsTemplate: [
          { key: 'ortildi', label: 'Ortildi', type: 'number', defaultValue: 0 },
          { key: 'tranzit', label: 'Tranzit', type: 'number', defaultValue: 0 },
          { key: 'almashuv', label: 'Almashuv', type: 'text', defaultValue: '' },
          { key: 'teplovozlar', label: 'Teplovozlar', type: 'text', defaultValue: '' },
        ]
      });

      addLog("Test ma'lumotlar to'liq yozildi ✅");
      
      setProgress(100);
      addLog("Database to'ldirildi ✅");
    } catch (error: any) {
      addLog(`Xato yuz berdi: ${error.message} ❌`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="bg-background rounded-3xl p-8 shadow-xl border border-primary/10">
          <h1 className="text-3xl font-black text-primary mb-6 text-center">
            DATABASE SEEDER
          </h1>
          
          <div className="space-y-6">
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="w-full py-5 bg-primary text-white rounded-2xl font-black text-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              {isSeeding ? "TO'LDIRILMOQDA..." : "DATABASENI TO'LDIRISH"}
            </button>

            <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="bg-slate-950 text-emerald-400 p-6 rounded-2xl font-mono text-sm h-64 overflow-y-auto shadow-inner border border-white/5">
              {logs.length === 0 && <span className="opacity-40">Kutish rejimida...</span>}
              {logs.map((log, i) => (
                <div key={i} className="mb-1">
                  <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
