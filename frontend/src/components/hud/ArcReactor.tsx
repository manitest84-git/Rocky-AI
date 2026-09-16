'use client';
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

export interface ArcReactorProps {
  volume?: number;
  state?: 'idle' | 'listening' | 'thinking' | 'speaking';
}

const CoreMesh = ({ volume = 0, state = 'idle' }: ArcReactorProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const wireframeRef = useRef<THREE.Mesh>(null);
  const solidRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Initial geometries and materials
  const geometries = useMemo(() => {
    return {
      wireframe: new THREE.IcosahedronGeometry(1.2, 1),
      solid: new THREE.SphereGeometry(1.1, 32, 32)
    };
  }, []);

  const materials = useMemo(() => {
    return {
      wireframe: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#00f0ff'),
        wireframe: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      }),
      solid: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e0f7fa'),
        transparent: true,
        opacity: 0.2,
        emissive: new THREE.Color('#00f0ff'),
        emissiveIntensity: 0.5
      })
    };
  }, []);

  useFrame((stateCtx) => {
    const time = stateCtx.clock.elapsedTime;
    
    if (groupRef.current && wireframeRef.current && lightRef.current) {
      // Rotation logic based on state
      const rotationSpeed = state === 'thinking' ? 2.0 : 0.5;
      groupRef.current.rotation.y += 0.01 * rotationSpeed;
      groupRef.current.rotation.x += 0.005 * rotationSpeed;
      wireframeRef.current.rotation.z -= 0.01 * rotationSpeed;

      // Scale/Pulsing logic
      let targetScale = 1.0;
      if (state === 'idle' || state === 'thinking') {
        // Slow breathing
        targetScale = 1.0 + Math.sin(time * 0.5 * Math.PI) * 0.05;
      } else if (state === 'speaking' || state === 'listening') {
        // Reactive to volume
        targetScale = 1.0 + volume * 0.35;
      }

      // Smooth scale interpolation
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

      // Light intensity pulsing
      lightRef.current.intensity = 2 + (targetScale - 1) * 5;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={wireframeRef} geometry={geometries.wireframe} material={materials.wireframe} />
      <mesh ref={solidRef} geometry={geometries.solid} material={materials.solid} />
      <pointLight ref={lightRef} color="#00f0ff" distance={10} intensity={2} />
    </group>
  );
};

const OrbitingRings = ({ state = 'idle' }: { state?: ArcReactorProps['state'] }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  const rings = useMemo(() => {
    return [
      { radius: 1.8, tube: 0.02, speed: 0.5, axis: new THREE.Vector3(1, 0, 0) },
      { radius: 2.2, tube: 0.015, speed: -0.3, axis: new THREE.Vector3(0, 1, 0) },
      { radius: 2.6, tube: 0.01, speed: 0.7, axis: new THREE.Vector3(0, 0, 1) }
    ];
  }, []);

  useFrame((stateCtx) => {
    if (groupRef.current) {
      const multiplier = state === 'thinking' ? 3 : 1;
      groupRef.current.children.forEach((child, i) => {
        const ring = rings[i];
        child.rotateOnAxis(ring.axis, 0.01 * ring.speed * multiplier);
      });
    }
  });

  return (
    <group ref={groupRef}>
      {rings.map((ring, i) => (
        <mesh key={i} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, 0]}>
          <torusGeometry args={[ring.radius, ring.tube, 16, 100]} />
          <meshBasicMaterial 
            color="#0088ff" 
            transparent 
            opacity={0.4} 
            blending={THREE.AdditiveBlending}
            wireframe
          />
        </mesh>
      ))}
    </group>
  );
};

export const ArcReactor = ({ volume = 0, state = 'idle' }: ArcReactorProps) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ toneMapping: THREE.NoToneMapping, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <CoreMesh volume={volume} state={state} />
        <OrbitingRings state={state} />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.1}
            intensity={1.5}
            mipmapBlur={true}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default ArcReactor;
