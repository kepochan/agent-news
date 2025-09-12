import { useEffect, useRef, useState } from 'react';

interface SSEEvent {
  type: string;
  data: any;
  timestamp: string;
}

interface UseSSEOptions {
  enabled?: boolean;
  topicSlug?: string;
  reconnectDelay?: number;
}

export function useSSE(options: UseSSEOptions = {}) {
  const {
    enabled = true,
    topicSlug,
    reconnectDelay = 3000
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (!enabled) return;

    try {
      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Build URL with optional topic filter
      let url = 'http://localhost:8000/events/stream';
      if (topicSlug) {
        url += `?topic_slug=${encodeURIComponent(topicSlug)}`;
      }

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connected');
        setIsConnected(true);
        setConnectionError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({
            type: event.type || 'message',
            data,
            timestamp: data.timestamp || new Date().toISOString()
          });
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      // Handle specific event types
      eventSource.addEventListener('connected', (event) => {
        console.log('SSE connection established');
      });

      eventSource.addEventListener('run-update', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({
            type: 'run-update',
            data,
            timestamp: data.timestamp || new Date().toISOString()
          });
        } catch (error) {
          console.error('Error parsing run-update:', error);
        }
      });

      eventSource.addEventListener('new-run', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({
            type: 'new-run',
            data,
            timestamp: data.timestamp || new Date().toISOString()
          });
        } catch (error) {
          console.error('Error parsing new-run:', error);
        }
      });

      eventSource.addEventListener('topic-stats', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({
            type: 'topic-stats',
            data,
            timestamp: data.timestamp || new Date().toISOString()
          });
        } catch (error) {
          console.error('Error parsing topic-stats:', error);
        }
      });

      eventSource.addEventListener('runs-update', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({
            type: 'runs-update',
            data,
            timestamp: data.timestamp || new Date().toISOString()
          });
        } catch (error) {
          console.error('Error parsing runs-update:', error);
        }
      });

      eventSource.onerror = (event) => {
        console.error('SSE error:', event);
        setIsConnected(false);
        setConnectionError('Connection error');
        
        // Auto-reconnect after delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect SSE...');
          connect();
        }, reconnectDelay);
      };

    } catch (error) {
      console.error('Error establishing SSE connection:', error);
      setConnectionError('Failed to connect');
    }
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  };

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, topicSlug]);

  return {
    isConnected,
    lastEvent,
    connectionError,
    connect,
    disconnect
  };
}

// Specialized hook for topic detail pages
export function useTopicSSE(topicSlug: string) {
  return useSSE({ topicSlug, enabled: !!topicSlug });
}

// Specialized hook for general updates (topics list, runs list)
export function useGeneralSSE() {
  return useSSE({ enabled: true });
}