import * as THREE from 'three';
import { getLocalSiderealTime } from '../astro/TimeMath';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const HORIZON_CORRECTION = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -Math.PI / 2);

export function getTiltCorrection(latitude: number): THREE.Quaternion {
  const latRad = (latitude * Math.PI) / 180;
  const tilt = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, -(Math.PI / 2 - latRad));
  return new THREE.Quaternion().copy(HORIZON_CORRECTION).multiply(tilt);
}

export function getMeridianRotation(date: Date, longitude: number): THREE.Quaternion {
  const lstHours = getLocalSiderealTime(date, longitude);
  const lstRad = (lstHours * 15 * Math.PI) / 180;
  return new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -lstRad);
}

export function getHorizonRotation(date: Date, latitude: number, longitude: number): THREE.Quaternion {
  const tiltCorrection = getTiltCorrection(latitude);
  const meridian = getMeridianRotation(date, longitude);
  return tiltCorrection.multiply(meridian);
}