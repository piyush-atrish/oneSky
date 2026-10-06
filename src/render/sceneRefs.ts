import type { RefObject } from 'react';
import * as THREE from 'three';

export const celestialGroupRef: RefObject<THREE.Group | null> = { current: null };