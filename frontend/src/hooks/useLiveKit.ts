import { useState, useCallback } from 'react';
import { ConnectionState } from 'livekit-client';
import { getLiveKitUrl } from '../lib/constants';
import { getToken } from '../lib/api';

export function useLiveKit() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(async (customRoomName?: string, userName?: string) => {
    try {
      setConnectionState(ConnectionState.Connecting);
      setError(null);
      
      const targetRoom = typeof customRoomName === 'string' && customRoomName ? customRoomName : `jarvis-session-${Date.now()}`;
      const targetUser = typeof userName === 'string' && userName ? userName : `user-${Math.floor(Math.random() * 10000)}`;
      
      const tk = await getToken(targetRoom, targetUser);
      setToken(tk);
      setRoomName(targetRoom);
      // Room state stays Connecting until LiveKitRoom onConnected fires
      return { token: tk, roomName: targetRoom };
    } catch (err: any) {
      setError(err);
      setConnectionState(ConnectionState.Disconnected);
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    setToken(null);
    setRoomName(null);
    setConnectionState(ConnectionState.Disconnected);
  }, []);

  return {
    connectionState,
    setConnectionState,
    token,
    roomName,
    serverUrl: getLiveKitUrl(),
    connect,
    disconnect,
    error,
  };
}
