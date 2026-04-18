import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLORS,
  GROUND_Y,
  NET_HEIGHT,
  NET_WIDTH,
  NET_X,
} from './constants';
import { Engine } from './Engine';
import { Player } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  type: 'DUST' | 'SPARK' | 'LINE';
}

export class Renderer {
  ctx: CanvasRenderingContext2D;
  engine: Engine;
  particles: Particle[] = [];
  shake: number = 0;
  shakePivot: {x: number, y: number} = {x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2};
  impacts: {x: number, y: number, r: number, life: number}[] = [];
  ballHistory: {x: number, y: number}[] = [];

  constructor(ctx: CanvasRenderingContext2D, engine: Engine) {
    this.ctx = ctx;
    this.engine = engine;
    
    // Register impact event
    this.engine.onImpact = (x, y, power, type) => {
        this.shakePivot = { x, y };
        if (type === 'SPIKE') {
            this.addImpactLines(x, y, power);
            this.impacts.push({x, y, r: 0, life: 1.0});
            this.shake = 20;
        } else if (type === 'GROUND') {
            this.addGroundDust(x, y);
            this.shake = 8;
        } else {
            this.addHitParticles(x, y, '#FFFFFF');
            this.shake = 4;
        }
    };
  }

  draw() {
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Smooth trail data
    const b = this.engine.ball;
    this.ballHistory.push({x: b.pos.x, y: b.pos.y});
    if (this.ballHistory.length > 10) this.ballHistory.shift();

    if (this.shake > 0) {
      this.ctx.save();
      
      // Calculate shake offset originated from pivot
      const intensity = this.shake;
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * intensity;
      
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist;
      
      this.ctx.translate(sx, sy);
      
      // Slight rotation originating from impact point
      const rotIntensity = (this.shake / 20) * 0.02;
      this.ctx.translate(this.shakePivot.x, this.shakePivot.y);
      this.ctx.rotate((Math.random() - 0.5) * rotIntensity);
      this.ctx.translate(-this.shakePivot.x, -this.shakePivot.y);
      
      this.shake *= 0.85;
      if (this.shake < 0.1) this.shake = 0;
    }

    this.drawBackground();
    this.drawCourt();
    this.drawNet();
    this.drawParticles();
    this.drawImpacts();
    this.drawPlayer(this.engine.player);
    this.drawPlayer(this.engine.ai);
    this.drawBall();
    this.drawUI();

    if (this.shake > 0) {
      this.ctx.restore();
    }
  }

  private drawBackground() {
    const grad = this.ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, '#020617');
    grad.addColorStop(1, '#1e1b4b');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y);

    // Floor texture
    this.ctx.fillStyle = '#312e81';
    this.ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    
    // Perspective lines for court
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 50) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, GROUND_Y);
        this.ctx.lineTo(x + (x - CANVAS_WIDTH / 2) * 0.5, CANVAS_HEIGHT);
        this.ctx.stroke();
    }
  }

  private drawCourt() {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(50, GROUND_Y, CANVAS_WIDTH - 100, 5);
  }

  private drawNet() {
    const netX = NET_X;
    const netTop = GROUND_Y - NET_HEIGHT;
    
    // Pole
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillRect(netX - 2, netTop, 4, NET_HEIGHT);
    
    // Net
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 1;
    for (let y = netTop + 10; y < GROUND_Y; y += 12) {
        this.ctx.beginPath();
        this.ctx.moveTo(netX - 5, y);
        this.ctx.lineTo(netX + 5, y);
        this.ctx.stroke();
    }
  }

  private drawPlayer(p: Player) {
    this.ctx.save();
    this.ctx.translate(p.pos.x, p.pos.y);

    let yOffset = 0;
    if (p.state === 'running') yOffset = Math.sin(Date.now() / 60) * 4;
    else if (p.state === 'celebrating') yOffset = Math.sin(Date.now() / 100) * 10;

    // Shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.beginPath();
    this.ctx.ellipse(p.width / 2, GROUND_Y - p.pos.y, p.width / 2 * (1 - (GROUND_Y - p.pos.y - p.height) / 400), 5, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Body parts
    this.ctx.fillStyle = p.color;
    const bodyHeight = p.height * 0.7;
    const headSize = p.width * 0.6;

    if (p.isSliding) {
        this.ctx.fillRect(0, p.height - 20, p.width * 1.5, 20);
        this.ctx.beginPath();
        this.ctx.arc(p.width * 1.5, p.height - 10, 10, 0, Math.PI * 2);
        this.ctx.fill();
    } else {
        // Dynamic pose based on state
        let rotation = 0;
        if (p.state === 'spiking') rotation = p.type === 'PLAYER' ? 0.3 : -0.3;
        if (p.state === 'falling') rotation = p.type === 'PLAYER' ? -0.1 : 0.1;

        this.ctx.translate(p.width / 2, p.height / 2);
        this.ctx.rotate(rotation);
        this.ctx.translate(-p.width / 2, -p.height / 2);

        // Torso
        this.ctx.fillRect(0, yOffset + p.height - bodyHeight, p.width, bodyHeight);
        
        // Head
        this.ctx.beginPath();
        this.ctx.arc(p.width / 2, yOffset + p.height - bodyHeight - headSize / 2, headSize / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Arm during spike
        if (p.state === 'spiking') {
            this.ctx.strokeStyle = p.color;
            this.ctx.lineWidth = 10;
            this.ctx.beginPath();
            this.ctx.moveTo(p.width / 2, yOffset + 20);
            this.ctx.lineTo(p.type === 'PLAYER' ? p.width + 10 : -10, yOffset - 10);
            this.ctx.stroke();
        }
    }

    this.ctx.restore();
  }

  private drawBall() {
    const b = this.engine.ball;
    
    // Stylized Trail
    this.ctx.save();
    for (let i = 0; i < this.ballHistory.length; i++) {
        const alpha = i / this.ballHistory.length * 0.4;
        const size = b.radius * (0.5 + i / this.ballHistory.length * 0.5);
        this.ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(this.ballHistory[i].x, this.ballHistory[i].y, size, 0, Math.PI * 2);
        this.ctx.fill();
    }
    this.ctx.restore();

    // Speed lines if fast
    const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
    if (speed > 10) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(b.pos.x, b.pos.y);
        this.ctx.lineTo(b.pos.x - b.vel.x * 2, b.pos.y - b.vel.y * 2);
        this.ctx.stroke();
    }

    // Ball
    this.ctx.fillStyle = COLORS.BALL;
    this.ctx.beginPath();
    this.ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Glow
    const glow = this.ctx.createRadialGradient(b.pos.x, b.pos.y, 0, b.pos.x, b.pos.y, b.radius * 2);
    glow.addColorStop(0, 'rgba(250, 204, 21, 0.4)');
    glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(b.pos.x, b.pos.y, b.radius * 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * this.engine.timeScale;
      p.y += p.vy * this.engine.timeScale;
      p.life -= 0.02 * this.engine.timeScale;
      
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      
      if (p.type === 'LINE') {
          this.ctx.strokeStyle = p.color;
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
          this.ctx.stroke();
      } else {
          this.ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    }
    this.ctx.globalAlpha = 1.0;
  }

  private drawImpacts() {
    for (let i = this.impacts.length - 1; i >= 0; i--) {
        const imp = this.impacts[i];
        imp.r += 10 * this.engine.timeScale;
        imp.life -= 0.05 * this.engine.timeScale;
        
        if (imp.life <= 0) {
            this.impacts.splice(i, 1);
            continue;
        }
        
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${imp.life})`;
        this.ctx.lineWidth = 5;
        this.ctx.beginPath();
        this.ctx.arc(imp.x, imp.y, imp.r, 0, Math.PI * 2);
        this.ctx.stroke();
    }
  }

  private drawUI() {
    // Cinematic bars for scored state
    if (this.engine.state === 'SCORED' || this.engine.state === 'SLOW_MO') {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, 40);
        this.ctx.fillRect(0, CANVAS_HEIGHT - 40, CANVAS_WIDTH, 40);
    }

    this.ctx.fillStyle = 'white';
    this.ctx.font = '900 32px Inter';
    this.ctx.textAlign = 'center';
    
    // Score
    this.ctx.fillText(`${this.engine.score.player} - ${this.engine.score.ai}`, CANVAS_WIDTH / 2, 80);

    if (this.engine.state === 'SCORED') {
        this.ctx.font = 'italic 900 60px Inter';
        this.ctx.fillStyle = '#facc15';
        this.ctx.fillText('POINT!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.strokeText('POINT!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    } else if (this.engine.state === 'GAME_OVER') {
        const win = this.engine.score.player >= 15 ? 'VICTORY' : 'DEFEAT';
        this.ctx.font = 'italic 900 80px Inter';
        this.ctx.fillStyle = win === 'VICTORY' ? '#3b82f6' : '#ef4444';
        this.ctx.fillText(win, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        this.ctx.font = '700 20px Inter';
        this.ctx.fillStyle = 'white';
        this.ctx.fillText('PRESS R TO RESTART', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    }
  }

  private addHitParticles(x: number, y: number, color: string) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color,
        size: Math.random() * 4 + 2,
        type: 'SPARK'
      });
    }
  }

  private addImpactLines(x: number, y: number, power: number) {
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 10 + 5) * power;
        this.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: '#FFFFFF',
            size: 2,
            type: 'LINE'
        });
    }
  }

  private addGroundDust(x: number, y: number) {
    for (let i = 0; i < 15; i++) {
        this.particles.push({
            x: x + (Math.random() - 0.5) * 20,
            y,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 4,
            life: 1.0,
            color: 'rgba(255, 255, 255, 0.3)',
            size: Math.random() * 10 + 5,
            type: 'DUST'
        });
    }
  }
}
