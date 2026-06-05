import { useEffect, useRef, useCallback, useState } from 'react';

export interface VotePayload {
  memberId: string;
  memberName: string;
  activityId: string;
  vote: 'like' | 'dislike' | 'abstain';
  timestamp: number;
}

export interface JoinPayload {
  memberId: string;
  memberName: string;
  avatar?: string;
  timestamp: number;
}

export interface LeavePayload {
  memberId: string;
  timestamp: number;
}

export interface CollaborationMessage {
  type: 'vote' | 'join' | 'leave' | 'refresh';
  payload: VotePayload | JoinPayload | LeavePayload | null;
}

export interface UseCollaborationSocketOptions {
  shareSlug: string;
  onMessage?: (msg: CollaborationMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useCollaborationSocket(options: UseCollaborationSocketOptions) {
  const {
    shareSlug,
    onMessage,
    onConnect,
    onDisconnect,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<CollaborationMessage | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = `/ws/collab/${shareSlug}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[CollaborationSocket] Connected to', wsUrl);
        setIsConnected(true);
        reconnectCountRef.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as CollaborationMessage;
          setLastMessage(msg);
          onMessage?.(msg);
        } catch (err) {
          console.error('[CollaborationSocket] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        console.log('[CollaborationSocket] Disconnected');
        setIsConnected(false);
        onDisconnect?.();

        if (reconnectCountRef.current < maxReconnectAttempts) {
          reconnectCountRef.current += 1;
          console.log(
            `[CollaborationSocket] Reconnecting in ${reconnectInterval}ms (attempt ${reconnectCountRef.current})`
          );

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          console.warn('[CollaborationSocket] Max reconnection attempts reached');
        }
      };

      ws.onerror = (error) => {
        console.error('[CollaborationSocket] Error:', error);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[CollaborationSocket] Connection failed:', err);
    }
  }, [shareSlug, onMessage, onConnect, onDisconnect, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    reconnectCountRef.current = maxReconnectAttempts;
  }, [maxReconnectAttempts]);

  const sendVote = useCallback((vote: Omit<VotePayload, 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'vote',
          payload: {
            ...vote,
            timestamp: Date.now(),
          },
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendJoin = useCallback((member: Omit<JoinPayload, 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'join',
          payload: {
            ...member,
            timestamp: Date.now(),
          },
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendLeave = useCallback((memberId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'leave',
          payload: {
            memberId,
            timestamp: Date.now(),
          },
        })
      );
      return true;
    }
    return false;
  }, []);

  const requestRefresh = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'refresh',
          payload: null,
        })
      );
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    sendVote,
    sendJoin,
    sendLeave,
    requestRefresh,
    connect,
    disconnect,
  };
}
