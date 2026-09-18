/**
 * Vector3.ts
 *
 * An immutable 3D vector, in `number` (double) precision, with zero
 * dependencies on React Native, Three.js, or any math package.
 *
 * This is oneSky's own value type, distinct from `THREE.Vector3` — the
 * render layer (`StarsLayer.tsx`, `SkyCanvas.tsx`, etc.) is responsible
 * for converting `Vector3` instances into whatever Three.js actually
 * wants (a flat `Float32Array` for a `BufferAttribute`, or a
 * `THREE.Vector3` for a camera target). Keeping this class Three.js-free
 * is what lets it double as the celestial-sphere math type used by the
 * (not-yet-ported) astronomy layer, which has no business knowing a
 * renderer exists.
 */

import { VECTOR_NORMALIZE_EPSILON } from './MathConstants';

/**
 * An immutable 3-component vector.
 *
 * Every operation below returns a *new* `Vector3` rather than mutating
 * `this`. TypeScript has no operator overloading, so linear-algebra
 * operations are plain methods (`a.add(b)`, not `a + b`) — chainable,
 * e.g. `a.add(b).scale(0.5)`.
 */
export class Vector3 {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly z: number,
  ) {}

  /**
   * The squared length (magnitude) of this vector.
   *
   * Prefer this over {@link length} when only *comparing* magnitudes
   * (e.g. "is this star closer than that one?") — it skips the
   * `Math.sqrt` call entirely.
   */
  get lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /** The length (magnitude) of this vector. */
  get length(): number {
    return Math.sqrt(this.lengthSquared);
  }

  /** Component-wise addition: `this + other`. */
  add(other: Vector3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  /** Component-wise subtraction: `this - other`. */
  subtract(other: Vector3): Vector3 {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  /** Scalar multiplication: `this * scalar`. */
  scale(scalar: number): Vector3 {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  /**
   * Scalar division: `this / scalar`.
   *
   * No zero-division guard — dividing by `0` yields `Infinity`/`NaN`
   * components, same as raw floating-point division would. That is a
   * deliberate choice, not an oversight: unlike {@link normalized},
   * which special-cases near-zero *lengths* because a direction is
   * meaningless for a near-zero vector, an arbitrary caller-supplied
   * divisor has no such special case to make. If you want a guarded
   * unit vector, call {@link normalized} instead of `scale(1 / length)`.
   */
  divide(scalar: number): Vector3 {
    return this.scale(1 / scalar);
  }

  /** The negation of this vector: `-this`. */
  negate(): Vector3 {
    return new Vector3(-this.x, -this.y, -this.z);
  }

  /** Vector dot product. */
  dot(other: Vector3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  /** Vector cross product: `this × other`. */
  cross(other: Vector3): Vector3 {
    return new Vector3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
    );
  }

  /** Euclidean distance between the point this vector represents and `other`. */
  distanceTo(other: Vector3): number {
    return this.subtract(other).length;
  }

  /**
   * The corresponding unit vector, or {@link Vector3.ZERO} if this
   * vector is too short to normalize reliably (length below
   * {@link VECTOR_NORMALIZE_EPSILON}).
   *
   * Returning `ZERO` instead of throwing or returning `NaN`s means a
   * caller that forgets to check for the degenerate case fails
   * *quietly* (a star that renders at the origin) rather than crashing
   * the frame loop — arguably worth revisiting once there's a logging
   * story, but it matches the porting source's behavior for now.
   */
  normalized(): Vector3 {
    const len = this.length;
    if (len < VECTOR_NORMALIZE_EPSILON) {
      return Vector3.ZERO;
    }
    return this.scale(1 / len);
  }

  /**
   * The projection of this vector onto `unitVector`.
   *
   * @param unitVector Must already be a unit vector — this method does
   *   not normalize it for you, to avoid silently paying for a
   *   normalization the caller may have already done.
   */
  projectOnto(unitVector: Vector3): Vector3 {
    return unitVector.scale(this.dot(unitVector));
  }

  /**
   * The cosine of the angle between this vector and `other`.
   *
   * Not clamped to `[-1, 1]` — accumulated floating-point error can push
   * a mathematically-valid `1.0` a hair past it, which is harmless on
   * its own but fatal if you feed the result straight into `Math.acos`
   * (which returns `NaN` outside that range). Callers that need an
   * actual angle should clamp first: `Math.acos(Math.min(1, Math.max(-1, cosineSimilarity)))`.
   */
  cosineSimilarity(other: Vector3): number {
    return this.dot(other) / Math.sqrt(this.lengthSquared * other.lengthSquared);
  }

  /**
   * This vector as a plain `[x, y, z]` tuple.
   *
   * The natural bridge to Three.js: spread into a `Float32Array` for a
   * batched `BufferGeometry` (`positions.set(v.toArray(), offset)`),
   * or spread into `object3D.position.set(...v.toArray())`.
   */
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  /** Builds a `Vector3` from an `[x, y, z]` tuple — the inverse of {@link toArray}. */
  static fromArray(a: readonly [number, number, number]): Vector3 {
    return new Vector3(a[0], a[1], a[2]);
  }

  /**
   * Exact (non-fuzzy) component-wise equality. Floating-point results
   * from different code paths that are mathematically equal will often
   * differ in their last bit or two — prefer comparing
   * `a.subtract(b).length < epsilon` when that matters, e.g. in tests.
   */
  equals(other: Vector3): boolean {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }

  toString(): string {
    return `Vector3(${this.x}, ${this.y}, ${this.z})`;
  }

  static readonly ZERO = new Vector3(0, 0, 0);
  static readonly UNIT_X = new Vector3(1, 0, 0);
  static readonly UNIT_Y = new Vector3(0, 1, 0);
  static readonly UNIT_Z = new Vector3(0, 0, 1);
}