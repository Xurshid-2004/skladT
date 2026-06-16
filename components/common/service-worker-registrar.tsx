"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const host = location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";

    if (isLocal) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        })
        .catch(() => {});
      return;
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker.register("/sw.js").then(
        () => {
          console.log("ServiceWorker registration successful");
        },
        (error) => {
          console.log("ServiceWorker registration failed: ", error);
        },
      );
    };

    window.addEventListener("load", registerServiceWorker);
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  return null;
}
