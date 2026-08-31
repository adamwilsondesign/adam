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
  };

  export type VantaCloudsEffect = {
    destroy(): void;
    setOptions(options: Partial<VantaCloudsOptions>): void;
  };

  export default function CLOUDS(options: VantaCloudsOptions): VantaCloudsEffect;
}
