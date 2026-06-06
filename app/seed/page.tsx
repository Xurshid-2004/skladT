"use client";

import { useState } from "react";
import { db } from "@/lib/firebase/config";
import { collection, doc, setDoc, addDoc } from "firebase/firestore";
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
      addLog("Global sozlamalarni yozish...");
      await setDoc(doc(db, "settings", "global"), {
        version: "1.0.0",
        isMaintenance: false,
        lockoutTime: 60,
        maxAttempts: 3,
        updatedAt: Date.now(),
        stansiyalar: {
          default: [],
          toshkent: ["Toshkent-1", "Chuqursoy", "Sergeli", "Nazarbek", "Hamza"],
        },
        tashkilotlar: {
          default: [],
          toshkent: ["UTY", "Avtotrans", "O'zbekiston temir yo'llari", "Yulqurilish"],
        },
        ijarachilar: {
          default: [],
          toshkent: ["Korxona1", "Korxona2", "MCHJ Trans"],
        },
        manualFields: ["Ortildi", "Tranzit", "Almashuv", "Teplovozlar", "Karakalpakiya", "Sariog'och", "Hojidavlat"],
        lastUpdated: Date.now(),
      });
      setProgress(50);

      addLog("Default so'rovnomalarni yozish...");
      const defaultQuestions = [
        { category: "lokomotiv", label: "1. HARAKAT TURI", fieldKey: "harakatTuri", fieldType: "dropdown", options: ["yuk", "yolovchi", "manyovr", "xojalik", "ijara"], isRequired: true, isVisible: true, order: 0 },
        { category: "lokomotiv", label: "2. SERIYA", fieldKey: "rusumi", fieldType: "dropdown", options: ["TEM2", "ChME3", "2TE10M", "TEP70BS"], isRequired: true, isVisible: true, order: 1 },
        { category: "lokomotiv", label: "3. LOKOMOTIV N", fieldKey: "lokomotivNumber", fieldType: "text", isRequired: true, isVisible: true, order: 2 },
        { category: "lokomotiv", label: "4. QOLDIQ (kg)", fieldKey: "qoldiq", fieldType: "number", isRequired: true, isVisible: true, order: 3 },
        { category: "lokomotiv", label: "5. BERILDI (kg)", fieldKey: "qanchaBerildi", fieldType: "number", isRequired: true, isVisible: true, order: 4 },
        { category: "lokomotiv", label: "6. DIZ MASLA (kg)", fieldKey: "dizMasla", fieldType: "number", isRequired: true, isVisible: true, order: 5 },
      ];

      for (const q of defaultQuestions) {
        await addDoc(collection(db, "questions"), { ...q, createdAt: Date.now(), updatedAt: Date.now() });
      }
      setProgress(80);

      addLog("Global sozlamalarni yozish...");
      await setDoc(doc(db, "settings", "global"), {
        manualFieldsTemplate: [
          { key: "ortildi", label: "Ortildi", type: "number", defaultValue: 0 },
          { key: "tranzit", label: "Tranzit", type: "number", defaultValue: 0 },
          { key: "almashuv", label: "Almashuv", type: "text", defaultValue: "" },
          { key: "teplovozlar", label: "Teplovozlar", type: "text", defaultValue: "" },
        ],
      }, { merge: true });

      setProgress(100);
      addLog("Database to'ldirildi.");
    } catch (error: any) {
      addLog(`Xato yuz berdi: ${error.message}`);
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
