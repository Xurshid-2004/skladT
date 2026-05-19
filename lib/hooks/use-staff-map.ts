"use client";

import { useEffect, useState } from "react";
import { subscribeStaff } from "@/lib/firebase/staff-service";
import type { StaffVaultRecord } from "@/lib/types";

/** tabelNumber → fullName xaritasi. Real-time Firestore snapshot. */
export function useStaffMap(): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    return subscribeStaff((list: StaffVaultRecord[]) => {
      const m = new Map<string, string>();
      for (const s of list) {
        if (s.tabelNumber?.trim() && s.fullName?.trim()) {
          m.set(s.tabelNumber.trim(), s.fullName.trim());
        }
      }
      setMap(m);
    });
  }, []);

  return map;
}
