import {
 createContext,
 useCallback,
 useContext,
 useEffect,
 useMemo,
 useRef,
 useState,
 useSyncExternalStore,
} from 'react';
import { useAuth } from '../components/auth/context/AuthContext';
import { IS_SAAS_MODE } from '../constants/config';
import { buildWebSocketUrl } from '../shared/buildWebSocketUrl';
import { handleNetworkDisconnect } from '../shared/networkDisconnect';

type WSSubscriber = (msg: any) => void;

type WebSocketContextType = {
 ws: WebSocket | null;
 sendMessage: (message: any) => void;
 latestMessage: any | null;
 isConnected: boolean;
 /**
 * Subscribe to every incoming WebSocket message synchronously, bypassing
 * React state batching. Returns an unsubscribe function. Use this for
 * high-frequency event streams (chat stream_delta, etc.) where dropping
 * intermediate values is not acceptable. For low-frequency one-shot events
 * the `latestMessage` state is still fine.
 */
 subscribe: (handler: WSSubscriber) => () => void;
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
 const context = useContext(WebSocketContext);
 if (!context) {
 throw new Error('useWebSocket must be used within a WebSocketProvider');
 }
 return context;
};

/** Survives React StrictMode remounts and Vite HMR — one socket per tab URL. */
const shared = {
 ws: null as WebSocket | null,
 url: '',
 refCount: 0,
 connectGen: 0,
 connected: false,
 hasConnected: false,
 latestMessage: null as any,
 subscribers: new Set<WSSubscriber>(),
 stateListeners: new Set<() => void>(),
 reconnectTimer: null as ReturnType<typeof setTimeout> | null,
 releaseTimer: null as ReturnType<typeof setTimeout> | null,
 pingInterval: null as ReturnType<typeof setInterval> | null,
 // PD-SAAS-FORK: exponential backoff for reconnect (800ms → 30s cap)
 reconnectAttempt: 0,
 reconnectBaseMs: 800,
 reconnectMaxMs: 30_000,
};

function clearPingInterval() {
 if (shared.pingInterval) {
 clearInterval(shared.pingInterval);
 shared.pingInterval = null;
 }
}

function emitState() {
 shared.stateListeners.forEach((listener) => {
 try {
 listener();
 } catch {
 // ignore listener errors
 }
 });
}

function setConnected(next: boolean) {
 if (shared.connected === next) return;
 shared.connected = next;
 emitState();
}

function dispatchMessage(data: any) {
 shared.latestMessage = data;
 shared.subscribers.forEach((sub) => {
 try {
 sub(data);
 } catch (err) {
 console.error('WebSocket subscriber error:', err);
 }
 });
 emitState();
}

function scheduleReconnect() {
 if (shared.reconnectTimer) return;
 const delay = Math.min(
 shared.reconnectBaseMs * 2 ** shared.reconnectAttempt,
 shared.reconnectMaxMs,
 );
 shared.reconnectAttempt += 1;
 shared.reconnectTimer = setTimeout(() => {
 shared.reconnectTimer = null;
 if (shared.refCount > 0 && shared.url) {
 openSharedSocket(shared.url);
 }
 }, delay);
}

function openSharedSocket(url: string) {
 if (
 shared.ws &&
 shared.url === url &&
 (shared.ws.readyState === WebSocket.OPEN || shared.ws.readyState === WebSocket.CONNECTING)
 ) {
 setConnected(shared.ws.readyState === WebSocket.OPEN);
 return;
 }

 if (shared.ws) {
 clearPingInterval();
 const stale = shared.ws;
 stale.onopen = null;
 stale.onmessage = null;
 stale.onclose = null;
 stale.onerror = null;
 stale.close();
 shared.ws = null;
 }

 shared.url = url;
 const gen = ++shared.connectGen;

 try {
 const websocket = new WebSocket(url);
 shared.ws = websocket;

 websocket.onopen = () => {
 if (gen !== shared.connectGen) {
 websocket.close();
 return;
 }
 shared.reconnectAttempt = 0;
 setConnected(true);
 clearPingInterval();
 shared.pingInterval = setInterval(() => {
 if (websocket.readyState === WebSocket.OPEN) {
 websocket.send(JSON.stringify({ type: 'ping' }));
 }
 }, 30_000);
 if (shared.hasConnected) {
 dispatchMessage({ type: 'websocket-reconnected', timestamp: Date.now() });
 }
 shared.hasConnected = true;
 };

 websocket.onmessage = (event) => {
 if (gen !== shared.connectGen) return;
 try {
 dispatchMessage(JSON.parse(event.data));
 } catch (error) {
 console.error('Error parsing WebSocket message:', error);
 }
 };

 websocket.onclose = () => {
 if (gen !== shared.connectGen) return;
 clearPingInterval();
 shared.ws = null;
 setConnected(false);
 if (shared.refCount > 0) {
 scheduleReconnect();
 }
 };

 websocket.onerror = (error) => {
 console.error('WebSocket error:', error);
 };
 } catch (error) {
 console.error('Error creating WebSocket connection:', error);
 scheduleReconnect();
 }
}

function acquireSharedConnection(url: string) {
 if (shared.releaseTimer) {
 clearTimeout(shared.releaseTimer);
 shared.releaseTimer = null;
 }
 shared.refCount += 1;
 openSharedSocket(url);
}

function releaseSharedConnection() {
 shared.refCount = Math.max(0, shared.refCount - 1);
 if (shared.releaseTimer) clearTimeout(shared.releaseTimer);
 shared.releaseTimer = setTimeout(() => {
 shared.releaseTimer = null;
 if (shared.refCount > 0) return;
 if (shared.reconnectTimer) {
 clearTimeout(shared.reconnectTimer);
 shared.reconnectTimer = null;
 }
 clearPingInterval();
 if (shared.ws) {
 const ws = shared.ws;
 ws.onopen = null;
 ws.onmessage = null;
 ws.onclose = null;
 ws.onerror = null;
 ws.close();
 shared.ws = null;
 }
 shared.url = '';
 setConnected(false);
 }, 120);
}

function subscribeSharedState(listener: () => void) {
 shared.stateListeners.add(listener);
 return () => {
 shared.stateListeners.delete(listener);
 };
}

// PD-SAAS-FORK: mobile browsers freeze JS timers in background tabs, so the
// 800ms reconnect loop may never fire while hidden. Re-validate the socket
// the moment the page returns to the foreground and reconnect silently.
if (typeof document !== 'undefined') {
 document.addEventListener('visibilitychange', () => {
 if (document.visibilityState !== 'visible') return;
 if (shared.refCount <= 0 || !shared.url) return;
 const socket = shared.ws;
 const alive =
 socket &&
 (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING);
 if (!alive) {
 openSharedSocket(shared.url);
 }
 });
}

if (typeof window !== 'undefined') {
 window.addEventListener('offline', () => {
 handleNetworkDisconnect('browser-offline');
 });
}

type SharedSnapshot = {
 connected: boolean;
 latestMessage: any;
 ws: WebSocket | null;
};

let sharedSnapshot: SharedSnapshot = {
 connected: false,
 latestMessage: null,
 ws: null,
};

function getSharedSnapshot(): SharedSnapshot {
 if (
 sharedSnapshot.connected !== shared.connected ||
 sharedSnapshot.latestMessage !== shared.latestMessage ||
 sharedSnapshot.ws !== shared.ws
 ) {
 sharedSnapshot = {
 connected: shared.connected,
 latestMessage: shared.latestMessage,
 ws: shared.ws,
 };
 }
 return sharedSnapshot;
}

const useWebSocketProviderState = (): WebSocketContextType => {
 const subscribersRef = useRef<Set<WSSubscriber>>(new Set());
 const { token } = useAuth();
 const snapshot = useSyncExternalStore(subscribeSharedState, getSharedSnapshot, getSharedSnapshot);

 useEffect(() => {
 // PD-SAAS-FORK: SaaS mode always uses shared buildWebSocketUrl with JWT.
 const wsUrl = buildWebSocketUrl(token, { isSaasMode: IS_SAAS_MODE });
 if (IS_SAAS_MODE && !token) {
 return undefined;
 }
 if (!wsUrl) {
 console.warn('No authentication token found for WebSocket connection');
 return undefined;
 }
 acquireSharedConnection(wsUrl);
 return () => {
 releaseSharedConnection();
 };
 }, [token]);

 const sendMessage = useCallback((message: any) => {
 const socket = shared.ws;
 if (socket && socket.readyState === WebSocket.OPEN) {
 socket.send(JSON.stringify(message));
 } else {
 console.warn('WebSocket not connected');
 }
 }, []);

 const subscribe = useCallback<WebSocketContextType['subscribe']>((handler) => {
 subscribersRef.current.add(handler);
 shared.subscribers.add(handler);
 return () => {
 subscribersRef.current.delete(handler);
 shared.subscribers.delete(handler);
 };
 }, []);

 const value: WebSocketContextType = useMemo(
 () => ({
 ws: snapshot.ws,
 sendMessage,
 latestMessage: snapshot.latestMessage,
 isConnected: snapshot.connected,
 subscribe,
 }),
 [sendMessage, snapshot.connected, snapshot.latestMessage, snapshot.ws, subscribe],
 );

 return value;
};

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
 const webSocketData = useWebSocketProviderState();

 return (
 <WebSocketContext.Provider value={webSocketData}>
 {children}
 </WebSocketContext.Provider>
 );
};

export default WebSocketContext;
