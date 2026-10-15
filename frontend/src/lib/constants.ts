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

export const DEFAULT_TAILSCALE_HOST = '100.125.118.104';
export const DEFAULT_LAN_HOST = '192.168.0.111';

export const getEffectiveServerHost = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('rocky_server_host');
    if (saved && saved.trim()) return saved.trim();

    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0') {
      return host;
    }
    // Inside Capacitor Android APK, window.location is localhost/file, so route to remote host
    const isCapacitor = typeof (window as any).Capacitor !== 'undefined' || window.location.protocol === 'capacitor:';
    if (isCapacitor) {
      return DEFAULT_LAN_HOST;
    }
    return 'localhost';
  }
  return process.env.NEXT_PUBLIC_SERVER_HOST || DEFAULT_LAN_HOST;
};

export const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const targetHost = getEffectiveServerHost();
    if (targetHost.startsWith('http://') || targetHost.startsWith('https://')) {
      return targetHost;
    }
    const cleanHost = targetHost.replace(/:\d+$/, '');
    const port = targetHost.includes(':') ? targetHost.split(':')[1] : '8333';
    return `http://${cleanHost}:${port}`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8333';
};

export const getLiveKitUrl = (): string => {
  if (typeof window !== 'undefined') {
    const targetHost = getEffectiveServerHost();
    if (targetHost.startsWith('ws://') || targetHost.startsWith('wss://')) {
      return targetHost;
    }
    const cleanHost = targetHost.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    return `ws://${cleanHost}:7880`;
  }
  return process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';
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
