export interface RigPartDef {
  image: string;
  parent: string | null;
  attach: [number, number];
  pivot: [number, number];
  z: number;
  size: [number, number];
  tint?: boolean;
}

export interface PoseProps {
  rot?: number;
  x?: number;
  y?: number;
  sx?: number;
  sy?: number;
}

export type Keyframe = [number, PoseProps];

export interface ClipDef {
  duration: number;
  loop: boolean;
  additive?: boolean;
  tracks: Record<string, Keyframe[]>;
}

export interface RigDef {
  height: number;
  groundOffset: number;
  headRadius: number;
  headCenter: [number, number];
  parts: Record<string, RigPartDef>;
  animalPose: Record<string, Record<string, PoseProps>>;
  clips: Record<string, ClipDef>;
}

export interface Pose {
  rot: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
}

export const identityPose = (): Pose => ({ rot: 0, x: 0, y: 0, sx: 1, sy: 1 });
