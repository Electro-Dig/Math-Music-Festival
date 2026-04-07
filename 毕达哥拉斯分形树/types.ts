
export type TreeType = 'classic' | 'wireframe' | 'triangle' | 'bubble';

export interface TreeConfig {
  maxDepth: number;
  leftAngle: number; // in degrees
  rightAngle: number; // in degrees
  sizeRatio: number; // base size relative to canvas
  asymmetry: number; // 0 = symmetric, -0.5 to 0.5 modifies left/right balance
  colorScheme: 'classic' | 'neon' | 'nature' | 'mono';
  treeType: TreeType;
  animationSpeed: number;
  hueOffset: number; // New: For dynamic color shifting based on body position
}

export interface FractalStats {
  nodeCount: number;
  currentDepth: number;
}

export const DEFAULT_CONFIG: TreeConfig = {
  maxDepth: 10,
  leftAngle: 45,
  rightAngle: 45,
  sizeRatio: 0.15,
  asymmetry: 0,
  colorScheme: 'neon',
  treeType: 'classic',
  animationSpeed: 0.5,
  hueOffset: 0,
};
