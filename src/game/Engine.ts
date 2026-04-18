import {
  BALL_RADIUS,
  BOUNCE_FACTOR,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GRAVITY,
  GROUND_Y,
  JUMP_FORCE,
  NET_HEIGHT,
  NET_WIDTH,
  NET_X,
  PLAYER_HEIGHT,
  PLAYER_SPEED,
  PLAYER_WIDTH,
  SPIKE_POWER_X,
  SPIKE_POWER_Y,
} from './constants';
import { Ball, GameState, Player, Vector } from './types';

// Using the correct constants
import * as Constants from './constants';

export class Engine {
  player: Player;
  ai: Player;
  ball: Ball;
  state: GameState = 'MENU';
  servingSide: 'PLAYER' | 'AI' = 'PLAYER';
  score: { player: number; ai: number } = { player: 0, ai: 0 };
  
  timeScale: number = 1.0;
  slowMoTimer: number = 0;
  
  keys: Set<string> = new Set();
  onScoreUpdate?: (score: { player: number; ai: number }) => void;
  onStateChange?: (state: GameState) => void;
  onImpact?: (x: number, y: number, power: number, type: 'SPIKE' | 'HIT' | 'GROUND') => void;

  constructor() {
    this.player = this.createPlayer('PLAYER', 150);
    this.ai = this.createPlayer('AI', 650);
    this.ball = this.createBall();
    this.resetBall();
  }

  private createPlayer(type: 'PLAYER' | 'AI', x: number): Player {
    return {
      id: type,
      type,
      pos: { x, y: GROUND_Y - PLAYER_HEIGHT },
      vel: { x: 0, y: 0 },
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      color: type === 'PLAYER' ? '#3B82F6' : '#EF4444',
      isJumping: false,
      isSpiking: false,
      isSliding: false,
      spikeCooldown: 0,
      slideCooldown: 0,
      score: 0,
      stamina: 100,
      maxStamina: 100,
      state: 'idle',
      hitPower: 0,
    };
  }

  private createBall(): Ball {
    return {
      id: 'BALL',
      type: 'BALL',
      pos: { x: CANVAS_WIDTH / 2, y: 100 },
      vel: { x: 0, y: 0 },
      width: BALL_RADIUS * 2,
      height: BALL_RADIUS * 2,
      radius: BALL_RADIUS,
      color: '#FACC15',
      lastHitter: null,
      bounces: 0,
    };
  }

  private resetBall() {
    this.ball.pos = {
      x: this.servingSide === 'PLAYER' ? 100 : CANVAS_WIDTH - 100,
      y: 100,
    };
    this.ball.vel = { x: 0, y: 0 };
    this.ball.lastHitter = null;
    this.ball.bounces = 0;
    this.timeScale = 1.0;
  }

  handleKeyDown(key: string) {
    this.keys.add(key.toLowerCase());
  }

  handleKeyUp(key: string) {
    this.keys.delete(key.toLowerCase());
  }

  setKeyState(key: string, isPressed: boolean) {
    if (isPressed) this.keys.add(key.toLowerCase());
    else this.keys.delete(key.toLowerCase());
  }

  update() {
    if (this.state === 'MENU' || this.state === 'GAME_OVER') return;

    if (this.slowMoTimer > 0) {
      this.slowMoTimer--;
      if (this.slowMoTimer <= 0) {
        this.timeScale = 1.0;
        if (this.state === 'SLOW_MO') this.state = 'PLAYING';
      }
    }

    const dt = this.timeScale;

    this.updatePlayer(this.player, true, dt);
    this.updatePlayer(this.ai, false, dt);
    this.updateBall(dt);
    this.checkCollisions();
    this.updateAI(dt);
  }

  private updatePlayer(p: Player, isUser: boolean, dt: number) {
    if (this.state === 'SCORED') {
        p.vel.x = 0;
        p.state = 'celebrating';
    }

    // Stamina Regeneration
    if (!p.isJumping && !p.isSliding && Math.abs(p.vel.x) < 1) {
        p.stamina = Math.min(p.maxStamina, p.stamina + 0.8 * dt);
    } else {
        p.stamina = Math.min(p.maxStamina, p.stamina + 0.2 * dt);
    }

    // Horizontal Movement
    if (isUser && this.state !== 'SCORED') {
      const moveSpeed = p.stamina < 20 ? PLAYER_SPEED * 0.7 : PLAYER_SPEED;
      
      if (this.keys.has('arrowleft') || this.keys.has('a')) {
        p.vel.x = -moveSpeed;
      } else if (this.keys.has('arrowright') || this.keys.has('d')) {
        p.vel.x = moveSpeed;
      } else {
        p.vel.x = 0;
      }

      // Jump
      if ((this.keys.has('arrowup') || this.keys.has('w')) && !p.isJumping) {
        const jumpCost = 15;
        if (p.stamina >= jumpCost) {
            p.vel.y = JUMP_FORCE;
            p.isJumping = true;
            p.stamina -= jumpCost;
        }
      }

      // Spike
      if (this.keys.has(' ') || this.keys.has('z') || this.keys.has('k')) {
        if (!p.isSpiking && p.spikeCooldown <= 0) {
          const spikeCost = 25;
          if (p.stamina >= spikeCost) {
            p.isSpiking = true;
            p.spikeCooldown = 40;
            p.stamina -= spikeCost;
          }
        }
      }

      // Slide
      if (this.keys.has('shift') || this.keys.has('x') || this.keys.has('l')) {
        if (!p.isSliding && p.slideCooldown <= 0 && !p.isJumping) {
          const slideCost = 30;
          if (p.stamina >= slideCost) {
            p.isSliding = true;
            p.slideCooldown = 60;
            p.stamina -= slideCost;
            p.vel.x = (p.vel.x >= 0 ? 1 : -1) * PLAYER_SPEED * 2.5;
          }
        }
      }
    }

    // Cooldowns
    if (p.spikeCooldown > 0) p.spikeCooldown -= dt;
    if (p.isSpiking && p.spikeCooldown < 25) p.isSpiking = false;
    
    if (p.slideCooldown > 0) p.slideCooldown -= dt;
    if (p.isSliding && p.slideCooldown < 40) p.isSliding = false;

    // Movement
    p.vel.y += GRAVITY * dt;
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;

    // Ground
    if (p.pos.y + p.height > GROUND_Y) {
      p.pos.y = GROUND_Y - p.height;
      p.vel.y = 0;
      p.isJumping = false;
    }

    // Limits
    const minX = isUser ? 0 : NET_X + NET_WIDTH / 2;
    const maxX = isUser ? NET_X - NET_WIDTH / 2 - p.width : CANVAS_WIDTH - p.width;

    if (p.pos.x < minX) p.pos.x = minX;
    if (p.pos.x > maxX) p.pos.x = maxX;

    // Animation State
    if (p.state !== 'celebrating') {
        if (p.isSpiking) p.state = 'spiking';
        else if (p.isSliding) p.state = 'sliding';
        else if (p.isJumping) p.state = p.vel.y < 0 ? 'jumping' : 'falling';
        else if (Math.abs(p.vel.x) > 0) p.state = 'running';
        else p.state = 'idle';
    }
  }

  private updateBall(dt: number) {
    this.ball.vel.y += GRAVITY * 0.4 * dt;
    this.ball.pos.x += this.ball.vel.x * dt;
    this.ball.pos.y += this.ball.vel.y * dt;

    this.ball.vel.x *= (1 - 0.005 * dt);

    // Wall
    if (this.ball.pos.x - this.ball.radius < 0) {
      this.ball.pos.x = this.ball.radius;
      this.ball.vel.x *= -BOUNCE_FACTOR;
      this.ball.vel.y += (Math.random() - 0.5) * 2; // Random variation
    }
    if (this.ball.pos.x + this.ball.radius > CANVAS_WIDTH) {
      this.ball.pos.x = CANVAS_WIDTH - this.ball.radius;
      this.ball.vel.x *= -BOUNCE_FACTOR;
      this.ball.vel.y += (Math.random() - 0.5) * 2; // Random variation
    }

    // Ground
    if (this.ball.pos.y + this.ball.radius > GROUND_Y) {
      this.ball.pos.y = GROUND_Y - this.ball.radius;
      if (this.onImpact) this.onImpact(this.ball.pos.x, this.ball.pos.y, 0.5, 'GROUND');
      this.handleScoring();
    }

    // Net
    const netTop = GROUND_Y - NET_HEIGHT;
    if (this.ball.pos.y > netTop) {
      if (Math.abs(this.ball.pos.x - NET_X) < this.ball.radius + NET_WIDTH / 2) {
        this.ball.vel.x *= -BOUNCE_FACTOR;
        this.ball.pos.x = this.ball.pos.x < NET_X ? NET_X - NET_WIDTH / 2 - this.ball.radius : NET_X + NET_WIDTH / 2 + this.ball.radius;
      }
    } else if (Math.abs(this.ball.pos.x - NET_X) < this.ball.radius + NET_WIDTH / 2 + 5 && Math.abs(this.ball.pos.y - netTop) < this.ball.radius + 5) {
        this.ball.vel.y *= -BOUNCE_FACTOR;
        this.ball.pos.y = netTop - this.ball.radius - 5;
    }
  }

  private checkCollisions() {
    this.checkPlayerBallCollision(this.player);
    this.checkPlayerBallCollision(this.ai);
  }

  private checkPlayerBallCollision(p: Player) {
    const dx = this.ball.pos.x - (p.pos.x + p.width / 2);
    const dy = this.ball.pos.y - (p.pos.y + p.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);

    const hitBox = p.isSliding ? 70 : 60;

    if (dist < this.ball.radius + hitBox / 2) {
      const isPlayerSide = p.type === 'PLAYER';
      
      // Transition from SERVING to PLAYING on first hit
      if (this.state === 'SERVING') {
          this.state = 'PLAYING';
          if (this.onStateChange) this.onStateChange(this.state);
      }

      if (p.isSpiking) {
        // Impact
        this.timeScale = 0.1;
        this.slowMoTimer = 20;
        this.state = 'SLOW_MO';
        
        this.ball.vel.x = (isPlayerSide ? 1 : -1) * (Constants.SPIKE_POWER_X + 8 + Math.random() * 4);
        this.ball.vel.y = Constants.SPIKE_POWER_Y + 5;
        
        if (this.onImpact) this.onImpact(this.ball.pos.x, this.ball.pos.y, 2.5, 'SPIKE');
      } else if (p.isSliding) {
        this.ball.vel.y = -13;
        this.ball.vel.x = (isPlayerSide ? 4 : -4);
        if (this.onImpact) this.onImpact(this.ball.pos.x, this.ball.pos.y, 1.5, 'HIT');
      } else {
        this.ball.vel.y = -11 - Math.random() * 3;
        this.ball.vel.x = dx * 0.5 + (isPlayerSide ? 4 : -4);
        if (this.onImpact) this.onImpact(this.ball.pos.x, this.ball.pos.y, 1.0, 'HIT');
      }
      
      this.ball.lastHitter = p.id;
      
      // Push out
      const angle = Math.atan2(dy, dx);
      this.ball.pos.x = (p.pos.x + p.width / 2) + Math.cos(angle) * (this.ball.radius + hitBox / 2);
      this.ball.pos.y = (p.pos.y + p.height / 2) + Math.sin(angle) * (this.ball.radius + hitBox / 2);
    }
  }

  private handleScoring() {
    if (this.state !== 'PLAYING' && this.state !== 'SLOW_MO' && this.state !== 'SERVING') return;

    if (this.ball.pos.x < NET_X) {
      this.score.ai++;
      this.servingSide = 'AI'; // Winner serves
      this.ai.state = 'celebrating';
    } else {
      this.score.player++;
      this.servingSide = 'PLAYER'; // Winner serves
      this.player.state = 'celebrating';
    }

    this.state = 'SCORED';
    if (this.onScoreUpdate) this.onScoreUpdate(this.score);
    if (this.onStateChange) this.onStateChange(this.state);

    setTimeout(() => {
        if (this.score.player >= 15 || this.score.ai >= 15) {
            this.state = 'GAME_OVER';
        } else {
            this.state = 'SERVING';
            this.resetBall();
            this.player.state = 'idle';
            this.ai.state = 'idle';
        }
        if (this.onStateChange) this.onStateChange(this.state);
    }, 2500);
  }

  private updateAI(dt: number) {
    const p = this.ai;
    const b = this.ball;

    if (this.state === 'SCORED') return;

    const targetX = b.pos.x + b.vel.x * (b.pos.y < GROUND_Y - 100 ? 5 : 2);
    if (targetX > NET_X + 20) {
      if (p.pos.x + p.width / 2 < targetX - 15) p.vel.x = PLAYER_SPEED * 0.85;
      else if (p.pos.x + p.width / 2 > targetX + 15) p.vel.x = -PLAYER_SPEED * 0.85;
      else p.vel.x = 0;
    } else {
        const restX = 680;
        if (p.pos.x < restX - 10) p.vel.x = PLAYER_SPEED * 0.6;
        else if (p.pos.x > restX + 10) p.vel.x = -PLAYER_SPEED * 0.6;
        else p.vel.x = 0;
    }

    const distToBall = Math.sqrt(Math.pow(p.pos.x + p.width / 2 - b.pos.x, 2) + Math.pow(p.pos.y + p.height / 2 - b.pos.y, 2));

    if (distToBall < 150 && b.pos.y < GROUND_Y - 120 && !p.isJumping) {
      if (Math.random() > 0.94) {
          p.vel.y = JUMP_FORCE;
          p.isJumping = true;
      }
    }

    if (p.isJumping && b.pos.y < p.pos.y + 30 && b.pos.y > p.pos.y - 50 && distToBall < 80 && !p.isSpiking) {
        if (Math.random() > 0.75) {
            p.isSpiking = true;
            p.spikeCooldown = 40;
        }
    }
    
    // AI Slide to save ball
    if (!p.isJumping && b.pos.x > NET_X && b.pos.y > GROUND_Y - 60 && distToBall < 120 && !p.isSliding) {
        if (Math.random() > 0.8) {
            p.isSliding = true;
            p.slideCooldown = 60;
            p.vel.x = (b.pos.x > p.pos.x ? 1 : -1) * PLAYER_SPEED * 2.2;
        }
    }
  }

  start() {
    this.state = 'PLAYING';
    this.resetBall();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  reset() {
    this.score = { player: 0, ai: 0 };
    this.state = 'MENU';
    this.servingSide = 'PLAYER';
    this.resetBall();
    if (this.onScoreUpdate) this.onScoreUpdate(this.score);
    if (this.onStateChange) this.onStateChange(this.state);
  }
}
