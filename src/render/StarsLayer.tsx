import { useMemo } from 'react';
import { STAR_CATALOG } from '../data/starCatalog';
import { raDecToCartesian, bvToRGB } from '../math/Coordinates';

// gl_PointSize scaled by inverse view-space depth for perspective
// attenuation (mimics PointsMaterial's sizeAttenuation); 300 is a
// tunable constant calibrated for this scene's star radius (50) and fov.
const VERTEX_SHADER = `
attribute float size;
varying vec3 vColor;
void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

// Circular soft-edged point sprite via gl_PointCoord distance-from-center,
// instead of THREE.Points' default hard-edged square.
const FRAGMENT_SHADER = `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  gl_FragColor = vec4(vColor, smoothstep(0.5, 0.2, d));
}
`;

export function StarsLayer(){
  const { positions, colors, sizes } = useMemo(() => {
    const count = STAR_CATALOG.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    STAR_CATALOG.forEach(([,ra, dec, mag, bv], i) => {
      const p = raDecToCartesian(ra, dec, 50);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;

      const c = bvToRGB(bv);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = Math.max(0.5, 4.0 - mag);
    });

    return { positions, colors, sizes };
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        args={[
          {
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            depthTest: true,
          },
        ]}
      />
    </points>
  );
}