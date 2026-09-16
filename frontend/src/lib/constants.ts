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

export const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return `http://${host}:8333`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8333';
};

export const getLiveKitUrl = (): string => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return `ws://${host}:7880`;
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
