import { useState } from 'react';
import { useFrame } from '@react-three/fiber/native';
import { useAppReadyStore } from '../store/useAppReadyStore';

const WARMUP_FRAMES = 3; // first render compiles the shaders; later frames prove the scene is drawing

function Probe() {
  const [frames, setFrames] = useState(0);
  useFrame(() => {
    if (frames >= WARMUP_FRAMES) return;
    if (frames + 1 === WARMUP_FRAMES) useAppReadyStore.getState().completeGate('scene');
    setFrames((n) => n + 1);
  });
  return null;
}

/** Render inside <Canvas>. Reports the 'scene' gate after a few frames, then unmounts its per-frame probe. */
export function SceneReadySignal() {
  const done = useAppReadyStore((s) => s.gates.scene);
  return done ? null : <Probe />;
}