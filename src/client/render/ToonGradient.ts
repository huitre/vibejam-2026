import * as THREE from "three";

// 3-step toon gradient: shadow → mid → highlight
const data = new Uint8Array([80, 160, 255]);
export const toonGradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
toonGradientMap.minFilter = THREE.NearestFilter;
toonGradientMap.magFilter = THREE.NearestFilter;
toonGradientMap.needsUpdate = true;
