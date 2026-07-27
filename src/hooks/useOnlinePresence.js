// src/hooks/useOnlinePresence.js
// Presence channel independiente (online-users). No reutiliza useIncomingCalls.

import { useEffect, useRef, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "") ||
  API_BASE_URL.replace(/\/api\/?$/, "") ||
  API_BASE_URL;

const rawDriver = import.meta.env.VITE_BROADCAST_DRIVER;
const BROADCAST_DRIVER =
  typeof rawDriver === "string" && rawDriver.trim() !== ""
    ? rawDriver.trim().toLowerCase()
    : import.meta.env.VITE_REVERB_APP_KEY
      ? "reverb"
      : "pusher";
const isPusherCloud = BROADCAST_DRIVER === "pusher";

const PUSHER_APP_KEY =
  import.meta.env.VITE_PUSHER_APP_KEY || import.meta.env.VITE_REVERB_APP_KEY || "";
const PUSHER_APP_CLUSTER = import.meta.env.VITE_PUSHER_APP_CLUSTER || "us2";
const PUSHER_APP_HOST =
  import.meta.env.VITE_PUSHER_APP_HOST ||
  import.meta.env.VITE_PUSHER_HOST ||
  import.meta.env.VITE_REVERB_HOST ||
  "";
const PUSHER_APP_PORT =
  import.meta.env.VITE_PUSHER_APP_PORT ||
  import.meta.env.VITE_PUSHER_PORT ||
  import.meta.env.VITE_REVERB_PORT ||
  "8080";
const PUSHER_APP_USE_TLS =
  import.meta.env.VITE_PUSHER_APP_USE_TLS === "true" ||
  (import.meta.env.VITE_PUSHER_SCHEME ||
    import.meta.env.VITE_REVERB_SCHEME ||
    "https") === "https";

const ECHO_DISABLE_SESSION_KEY = "echo_presence_disabled_for_session";

const loadEchoDependencies = async () => {
  try {
    const echoModule = await import("laravel-echo");
    const pusherModule = await import("pusher-js");
    return {
      Echo: echoModule.default || echoModule,
      Pusher: pusherModule.default || pusherModule,
    };
  } catch (error) {
    console.warn("⚠️ Presence Echo no disponible:", error?.message || error);
    return null;
  }
};

const buildWsProbeUrl = ({ useTls }) => {
  if (!PUSHER_APP_HOST || !PUSHER_APP_KEY) return null;
  const protocol = useTls ? "wss" : "ws";
  return `${protocol}://${PUSHER_APP_HOST}:${PUSHER_APP_PORT || "8080"}/app/${encodeURIComponent(PUSHER_APP_KEY)}?protocol=7&client=js&version=8.4.0&flash=false`;
};

const canOpenWebSocketQuick = async ({ timeoutMs = 1500 } = {}) => {
  if (isPusherCloud) return true;
  try {
    if (sessionStorage.getItem(ECHO_DISABLE_SESSION_KEY) === "true") return false;
  } catch {
    /* ignore */
  }
  if (!PUSHER_APP_HOST || !PUSHER_APP_KEY) return false;
  if (typeof WebSocket === "undefined") return false;

  const urlsToTry = [
    buildWsProbeUrl({ useTls: true }),
    buildWsProbeUrl({ useTls: false }),
  ].filter(Boolean);

  for (const url of urlsToTry) {
    const ok = await new Promise((resolve) => {
      let done = false;
      let ws = null;
      const finish = (val) => {
        if (done) return;
        done = true;
        try {
          if (ws) ws.close();
        } catch {
          /* ignore */
        }
        resolve(val);
      };
      const t = setTimeout(() => finish(false), timeoutMs);
      try {
        ws = new WebSocket(url);
        ws.onopen = () => {
          clearTimeout(t);
          finish(true);
        };
        ws.onerror = () => {
          clearTimeout(t);
          finish(false);
        };
      } catch {
        clearTimeout(t);
        finish(false);
      }
    });
    if (ok) return true;
  }
  return false;
};

const memberId = (member) => Number(member?.id);

/**
 * Presence channel `online-users`.
 * @param {boolean} isAuthenticated
 * @returns {{ onlineUserIds: Set<number>|null, isPresenceLive: boolean }}
 */
export function useOnlinePresence(isAuthenticated) {
  const [onlineUserIds, setOnlineUserIds] = useState(null);
  const [isPresenceLive, setIsPresenceLive] = useState(false);
  const echoRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const markUnavailable = (reason) => {
      if (cancelledRef.current) return;
      if (reason) console.warn("⚠️ Presence no disponible:", reason);
      setOnlineUserIds(null);
      setIsPresenceLive(false);
    };

    const cleanupEcho = () => {
      const echo = echoRef.current;
      echoRef.current = null;
      if (!echo) return;
      try {
        echo.leave("online-users");
      } catch {
        /* ignore */
      }
      try {
        echo.disconnect();
      } catch {
        /* ignore */
      }
    };

    if (!isAuthenticated) {
      cleanupEcho();
      markUnavailable(null);
      return () => {
        cancelledRef.current = true;
        cleanupEcho();
      };
    }

    if (!PUSHER_APP_KEY) {
      markUnavailable(null);
      return () => {
        cancelledRef.current = true;
      };
    }
    if (!isPusherCloud && !PUSHER_APP_HOST) {
      markUnavailable(null);
      return () => {
        cancelledRef.current = true;
      };
    }

    const connect = async () => {
      try {
        const wsOk = await canOpenWebSocketQuick({ timeoutMs: 1500 });
        if (cancelledRef.current) return;
        if (!wsOk) {
          try {
            sessionStorage.setItem(ECHO_DISABLE_SESSION_KEY, "true");
          } catch {
            /* ignore */
          }
          markUnavailable(null);
          return;
        }

        const deps = await loadEchoDependencies();
        if (cancelledRef.current) return;
        if (!deps) {
          markUnavailable("dependencias Echo/Pusher");
          return;
        }

        const token = localStorage.getItem("auth_token");
        if (!token) {
          markUnavailable(null);
          return;
        }

        const { Echo: EchoClass, Pusher: PusherClass } = deps;
        window.Pusher = PusherClass;

        const authBase =
          import.meta.env.VITE_BROADCASTING_AUTH_URL ||
          (BACKEND_URL
            ? `${BACKEND_URL}/broadcasting/auth`
            : `${API_BASE_URL}/broadcasting/auth`);
        const authEndpoint = authBase.startsWith("http")
          ? authBase
          : `${window.location.origin}${authBase.startsWith("/") ? "" : "/"}${authBase}`;

        const echoConfig = {
          broadcaster: BROADCAST_DRIVER,
          key: PUSHER_APP_KEY,
          cluster: PUSHER_APP_CLUSTER,
          encrypted: PUSHER_APP_USE_TLS,
          forceTLS: PUSHER_APP_USE_TLS,
          disableStats: true,
          enabledTransports: ["ws", "wss"],
          authEndpoint,
          auth: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        };

        if (!isPusherCloud && PUSHER_APP_HOST) {
          echoConfig.wsHost = PUSHER_APP_HOST;
          echoConfig.wsPort = PUSHER_APP_PORT || "8080";
          echoConfig.wssPort = PUSHER_APP_PORT || "8080";
        }

        const echo = new EchoClass(echoConfig);
        echoRef.current = echo;

        echo
          .join("online-users")
          .here((members) => {
            if (cancelledRef.current) return;
            const ids = new Set(
              (Array.isArray(members) ? members : [])
                .map(memberId)
                .filter((id) => Number.isFinite(id))
            );
            setOnlineUserIds(ids);
            setIsPresenceLive(true);
          })
          .joining((member) => {
            if (cancelledRef.current) return;
            const id = memberId(member);
            if (!Number.isFinite(id)) return;
            setOnlineUserIds((prev) => {
              const next = new Set(prev || []);
              next.add(id);
              return next;
            });
            setIsPresenceLive(true);
          })
          .leaving((member) => {
            if (cancelledRef.current) return;
            const id = memberId(member);
            if (!Number.isFinite(id)) return;
            setOnlineUserIds((prev) => {
              const next = new Set(prev || []);
              next.delete(id);
              return next;
            });
          })
          .error((err) => {
            console.warn("⚠️ Error en presence channel online-users:", err);
            markUnavailable(null);
          });
      } catch (error) {
        console.warn("⚠️ Fallo al conectar presence:", error?.message || error);
        cleanupEcho();
        markUnavailable(null);
      }
    };

    connect();

    return () => {
      cancelledRef.current = true;
      cleanupEcho();
      setOnlineUserIds(null);
      setIsPresenceLive(false);
    };
  }, [isAuthenticated]);

  return { onlineUserIds, isPresenceLive };
}

export default useOnlinePresence;
