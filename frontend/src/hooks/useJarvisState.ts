import { useState, useEffect, useMemo, useRef } from 'react';
import { JARVIS_STATES, STATE_VISUAL_CONFIG } from '../lib/constants';

export type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface VisualState {
  ringSpeed: number;
  glowIntensity: number;
  coreScale: number;
  particleSpeed: number;
  primaryColor: string;
  statusLabel: string;
}

export function useJarvisState(agentState: AgentState = 'idle') {
  const [visualState, setVisualState] = useState<VisualState>({
    ringSpeed: 1,
    glowIntensity: 0.5,
    coreScale: 1,
    particleSpeed: 1,
    primaryColor: '#00f0ff',
    statusLabel: 'SYSTEM IDLE',
  });

  const stateRef = useRef(visualState);

  const targetState = useMemo(() => {
    switch (agentState) {
      case 'listening':
        return STATE_VISUAL_CONFIG[JARVIS_STATES.LISTENING];
      case 'thinking':
        return STATE_VISUAL_CONFIG[JARVIS_STATES.THINKING];
      case 'speaking':
        return STATE_VISUAL_CONFIG[JARVIS_STATES.SPEAKING];
      case 'idle':
      default:
        return STATE_VISUAL_CONFIG[JARVIS_STATES.IDLE];
    }
  }, [agentState]);

  useEffect(() => {
    let animationFrameId: number;
    const targetScale = agentState === 'speaking' ? 1.2 : 
                       agentState === 'listening' ? 1.1 : 1.0;

    const animateTransition = () => {
      const current = stateRef.current;
      
      const newScale = current.coreScale + (targetScale - current.coreScale) * 0.1;
      const newRingSpeed = current.ringSpeed + (targetState.ringSpeed - current.ringSpeed) * 0.05;
      const newGlowIntensity = current.glowIntensity + (targetState.glowIntensity - current.glowIntensity) * 0.1;
      const newParticleSpeed = current.particleSpeed + (targetState.particleRate - current.particleSpeed) * 0.05;

      const newState = {
        ringSpeed: newRingSpeed,
        glowIntensity: newGlowIntensity,
        coreScale: newScale,
        particleSpeed: newParticleSpeed,
        primaryColor: targetState.colorOverride,
        statusLabel: targetState.label,
      };

      stateRef.current = newState;
      setVisualState(newState);

      if (
        Math.abs(targetScale - newScale) > 0.01 ||
        Math.abs(targetState.ringSpeed - newRingSpeed) > 0.01 ||
        Math.abs(targetState.glowIntensity - newGlowIntensity) > 0.01
      ) {
        animationFrameId = requestAnimationFrame(animateTransition);
      }
    };

    animationFrameId = requestAnimationFrame(animateTransition);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [agentState, targetState]);

  return visualState;
}
