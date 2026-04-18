export type Vector = {
  x: number;
  y: number;
};

export type EntityType = 'PLAYER' | 'AI' | 'BALL';

export type GameState = 'MENU' | 'PLAYING' | 'SERVING' | 'SCORED' | 'GAME_OVER' | 'SLOW_MO';

export interface Entity {
  id: string;
  type: EntityType;
  pos: Vector;
  vel: Vector;
  width: number;
  height: number;
  color: string;
  rotation?: number;
}

export interface Player extends Entity {
  isJumping: boolean;
  isSpiking: boolean;
  isSliding: boolean;
  spikeCooldown: number;
  slideCooldown: number;
  score: number;
  stamina: number;
  maxStamina: number;
  state: 'idle' | 'running' | 'jumping' | 'spiking' | 'falling' | 'sliding' | 'receiving' | 'celebrating';
  hitPower: number;
}

export interface Ball extends Entity {
  radius: number;
  lastHitter: string | null;
  bounces: number;
}
