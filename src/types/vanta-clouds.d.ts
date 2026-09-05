declare module "vanta/dist/vanta.clouds.min" {
  import type * as THREE from "three";

  export type VantaCloudsOptions = {
    el: HTMLElement;
    THREE: typeof THREE;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    backgroundColor?: number;
    skyColor?: number;
    cloudColor?: number;
    cloudShadowColor?: number;
    sunColor?: number;
    sunGlareColor?: number;
    sunlightColor?: number;
    speed?: number;
    scale?: number;
    scaleMobile?: number;
    mouseEase?: boolean;
  };

  export type VantaCloudsEffect = {
    options: VantaCloudsOptions & { speed: number };
    afterRender?: () => void;
    onUpdate?: () => void;
    onResize?: () => void;
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    uniforms: Record<string, THREE.IUniform> & {
      iTime: { value: number };
      iMouse: { value: THREE.Vector2 };
      iResolution: { value: THREE.Vector2 };
    };
    destroy(): void;
    setOptions(options: Partial<VantaCloudsOptions>): void;
    /** Vanta base API: feeds the pointer position the sky reacts to. */
    onMouseMove(x: number, y: number): void;
  };

  export default function CLOUDS(options: VantaCloudsOptions): VantaCloudsEffect;
}
