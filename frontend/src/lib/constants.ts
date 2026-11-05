export enum JARVIS_STATES {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
}

export const PALETTE = {
  cyan: '#00f0ff',
  blue: '#0088ff',
  white: '#e0f7fa',
  dark: '#020813',
  navy: '#050e1a',
  amber: '#ff9100',
  red: '#ff2a44',
  glass: 'rgba(0, 240, 255, 0.05)',
};

export const DEFAULT_SERVER_HOST = 'workflow.mmani.cloud:3000';
export const DEFAULT_TAILSCALE_HOST = '100.125.118.104';
export const DEFAULT_LAN_HOST = '192.168.0.111';

export const getEffectiveServerHost = (): string => {
  if (typeof window !== 'undefined') {
    let saved = localStorage.getItem('rocky_server_host');
    if (saved && saved.trim()) {
      let host = saved.trim();
      // Automatically sanitize legacy direct ports (8333, 7880, 3001) to unified port 3000
      if (host.includes(':8333') || host.includes(':7880') || host.includes(':3001')) {
        host = host.replace(/:(8333|7880|3001)$/, ':3000');
        localStorage.setItem('rocky_server_host', host);
      }
      return host;
    }

    const host = window.location.hostname;
    // If running in browser and already on a domain or IP (not localhost/127.0.0.1), use that host
    if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0') {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${host}${port}`;
    }

    // Default for mobile APK, localhost web, and fresh sessions:
    return DEFAULT_SERVER_HOST;
  }
  return process.env.NEXT_PUBLIC_SERVER_HOST || DEFAULT_SERVER_HOST;
};

export const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const targetHost = getEffectiveServerHost();
    if (targetHost.startsWith('http://') || targetHost.startsWith('https://')) {
      return targetHost.replace(/:(8333|7880|3001)$/, ':3000');
    }
    const cleanHost = targetHost.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    let port = '3000';
    if (targetHost.includes(':')) {
      const p = targetHost.split(':')[1];
      if (p !== '8333' && p !== '7880' && p !== '3001') {
        port = p;
      } else {
        port = '3000';
      }
    } else {
      const currentPort = window.location.port;
      port = currentPort || '3000';
    }
    const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${proto}//${cleanHost}:${port}`;
  }
  return process.env.NEXT_PUBLIC_API_URL || `http://${DEFAULT_SERVER_HOST}`;
};

export const getLiveKitUrl = (): string => {
  if (typeof window !== 'undefined') {
    const targetHost = getEffectiveServerHost();
    if (targetHost.startsWith('ws://') || targetHost.startsWith('wss://')) {
      return targetHost.replace(/:(8333|7880|3001)$/, ':3000');
    }
    const cleanHost = targetHost.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/:\d+$/, '');
    let port = '3000';
    if (targetHost.includes(':')) {
      const p = targetHost.split(':')[1];
      if (p !== '8333' && p !== '7880' && p !== '3001') {
        port = p;
      } else {
        port = '3000';
      }
    } else {
      const currentPort = window.location.port;
      port = currentPort || '3000';
    }
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${cleanHost}:${port}`;
  }
  return process.env.NEXT_PUBLIC_LIVEKIT_URL || `ws://${DEFAULT_SERVER_HOST}`;
};

export const API_URL = getApiUrl();
export const LIVEKIT_URL = getLiveKitUrl();

export const STATE_VISUAL_CONFIG = {
  [JARVIS_STATES.IDLE]: {
    ringSpeed: 1,
    glowIntensity: 0.5,
    particleRate: 1,
    colorOverride: PALETTE.cyan,
    label: 'SYSTEM IDLE',
  },
  [JARVIS_STATES.LISTENING]: {
    ringSpeed: 2,
    glowIntensity: 0.8,
    particleRate: 2,
    colorOverride: PALETTE.blue,
    label: 'AUDIO DETECTED',
  },
  [JARVIS_STATES.THINKING]: {
    ringSpeed: 3,
    glowIntensity: 1.0,
    particleRate: 3,
    colorOverride: PALETTE.amber,
    label: 'PROCESSING...',
  },
  [JARVIS_STATES.SPEAKING]: {
    ringSpeed: 1.5,
    glowIntensity: 0.9,
    particleRate: 2.5,
    colorOverride: PALETTE.cyan,
    label: 'TRANSMITTING',
  },
};
