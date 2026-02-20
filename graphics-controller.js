// Graphics Controller - Handles 8-bit style immersive animations
class GraphicsController {
  constructor() {
    this.canvas = document.getElementById('immersive-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.timerOverlay = document.getElementById('immersive-timer-overlay');
    this.host = document.getElementById('immersive-host');
    this.animationFrameId = null;
    this.isRunning = false;
    this.isActive = false;
    
    // Animation state
    this.fillPercentage = 0;
    this.remaining = 0;
    this.totalDuration = 0;
    this.mode = 'pomodoro';
    this.previousMode = null;
    
    // Internal resolution for 8-bit look
    this.baseWidth = 320;
    this.baseHeight = 180;
    this.scale = 1;
    this.pixelSize = 1;
    
    // Soft pastel palette
    this.palette = {
      bg: '#0b1020',
      water: '#5dbdff',
      rain: '#e6eef6',
      accent: '#ff9aa2'
    };
    
    // Rain particles
    this.raindrops = [];
    this.maxRaindrops = 50;
    this.initRaindrops();
    
    // Floating particles
    this.particles = [];
    this.maxParticles = 30;
    this.initParticles();
    
    // Animation mode
    this.animationMode = 'rain'; // 'rain' or 'particles'
    
    // Time tracking
    this.lastTickTime = Date.now();
    
    // Event listeners
    this.onTimerTick = this.onTimerTick.bind(this);
    this.onTimerFinish = this.onTimerFinish.bind(this);
    document.addEventListener('timer-tick', this.onTimerTick);
    document.addEventListener('timer-finished', this.onTimerFinish);
    
    // Setup toggle
    this.setupToggle();
    
    // Resize handler
    this.onWindowResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.onWindowResize);
    
    this.calculateScale();
  }
  
  setupToggle() {
    const toggleBtn = document.getElementById('fullscreenToggle');
    const exitBtn = document.getElementById('immersive-exit-btn');
    
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleAnimation());
    }
    
    if (exitBtn) {
      exitBtn.addEventListener('click', () => this.exitAnimation());
    }
    
    // ESC key to exit
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isActive) {
        this.exitAnimation();
      }
    });
  }
  
  toggleAnimation() {
    if (this.isActive) {
      this.exitAnimation();
    } else {
      this.enterAnimation();
    }
  }
  
  enterAnimation() {
    if (this.isActive) return;
    this.isActive = true;
    this.host.classList.remove('immersive-hidden');
    this.calculateScale();
    this.startAnimation();
  }
  
  exitAnimation() {
    if (!this.isActive) return;
    this.isActive = false;
    this.host.classList.add('immersive-hidden');
    this.stopAnimation();
  }
  
  calculateScale() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    // Set canvas to fill viewport
    this.canvas.width = w;
    this.canvas.height = h;
    
    // Apply pixelated rendering
    this.ctx.imageSmoothingEnabled = false;
    this.canvas.style.imageRendering = 'pixelated';
  }
  
  onWindowResize() {
    if (this.isActive) {
      this.calculateScale();
    }
  }
  
  onTimerTick(event) {
    const detail = event.detail;
    this.fillPercentage = detail.percentage;
    this.remaining = detail.remaining;
    this.totalDuration = detail.total;
    this.mode = detail.mode;
    
    // Update timer overlay
    this.updateTimerOverlay();
  }
  
  onTimerFinish() {
    // Auto-exit animation when timer finishes
    if (this.isActive) {
      this.exitAnimation();
    }
  }
  
  updateTimerOverlay() {
    const mins = Math.floor(this.remaining / 60);
    const secs = this.remaining % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    this.timerOverlay.textContent = timeStr;
  }
  
  initRaindrops() {
    this.raindrops = [];
    for (let i = 0; i < this.maxRaindrops; i++) {
      this.raindrops.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: Math.random() * 1 + 0.5,
        length: Math.random() * 3 + 2,
        width: 1,
        depth: Math.random(),
        opacity: 0.3 + Math.random() * 0.7
      });
    }
  }
  
  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 1.5 + 0.5,
        depth: Math.random(),
        opacity: 0.4 + Math.random() * 0.6,
        angle: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02
      });
    }
  }
  
  updateRaindrops(deltaTime) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    for (let drop of this.raindrops) {
      drop.y += drop.vy;
      drop.x += drop.vx;
      
      // Wrap around edges
      if (drop.y > h) {
        drop.y = -drop.length;
        drop.x = Math.random() * w;
      }
      
      if (drop.x < 0) drop.x = w;
      if (drop.x > w) drop.x = 0;
      
      // Slight drift
      drop.vx += (Math.random() - 0.5) * 0.01;
      drop.vx = Math.max(-0.5, Math.min(0.5, drop.vx));
    }
  }
  
  updateParticles(deltaTime) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    for (let p of this.particles) {
      // Gentle vortex-like movement
      const angle = Math.atan2(h / 2 - p.y, w / 2 - p.x);
      const vortexStrength = 0.1;
      p.vx += Math.cos(angle) * vortexStrength * 0.01;
      p.vy += Math.sin(angle) * vortexStrength * 0.01;
      
      // Damping
      p.vx *= 0.99;
      p.vy *= 0.99;
      
      // Position update
      p.x += p.vx;
      p.y += p.vy;
      
      // Wrap edges
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
      
      // Rotation
      p.angle += p.rotationSpeed;
    }
  }
  
  drawRainAnimation() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Clear canvas
    this.ctx.fillStyle = this.palette.bg;
    this.ctx.fillRect(0, 0, w, h);
    
    // Draw water level fill from bottom (fills browser viewport)
    const fillHeight = (this.fillPercentage * h);
    
    // Dithered gradient effect
    for (let y = h - fillHeight; y < h; y++) {
      const gradientFactor = (h - y) / fillHeight;
      
      // Soft dither pattern for 8-bit look
      if ((y + Math.floor(Date.now() / 100)) % 2 === 0) {
        this.ctx.fillStyle = this.palette.water;
      } else {
        this.ctx.fillStyle = '#4d9eff';
      }
      
      this.ctx.fillRect(0, y, w, 1);
    }
    
    // Draw raindrops (falling down)
    this.ctx.strokeStyle = this.palette.rain;
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = 1;
    
    for (let drop of this.raindrops) {
      // Opacity based on depth
      const opacity = drop.opacity * (0.3 + drop.depth * 0.7);
      this.ctx.globalAlpha = opacity;
      
      this.ctx.beginPath();
      this.ctx.moveTo(Math.floor(drop.x), Math.floor(drop.y));
      this.ctx.lineTo(Math.floor(drop.x), Math.floor(drop.y + drop.length));
      this.ctx.stroke();
    }
    
    this.ctx.globalAlpha = 1.0;
  }
  
  drawParticleAnimation() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Clear canvas
    this.ctx.fillStyle = this.palette.bg;
    this.ctx.fillRect(0, 0, w, h);
    
    // Draw water level fill from bottom
    const fillHeight = (this.fillPercentage * h);
    
    // Soft dither pattern
    for (let y = h - fillHeight; y < h; y++) {
      if ((y + Math.floor(Date.now() / 100)) % 2 === 0) {
        this.ctx.fillStyle = this.palette.water;
      } else {
        this.ctx.fillStyle = '#4d9eff';
      }
      
      this.ctx.fillRect(0, y, w, 1);
    }
    
    // Draw particles as small squares/motes
    for (let p of this.particles) {
      const opacity = p.opacity * (0.2 + p.depth * 0.8);
      this.ctx.globalAlpha = opacity;
      this.ctx.fillStyle = this.palette.rain;
      
      const halfSize = p.size / 2;
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);
      
      // Simple square particle
      this.ctx.fillRect(x - halfSize, y - halfSize, p.size, p.size);
    }
    
    this.ctx.globalAlpha = 1.0;
  }
  
  animate() {
    const now = Date.now();
    const deltaTime = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;
    
    // Update animations
    this.updateRaindrops(deltaTime);
    this.updateParticles(deltaTime);
    
    // Draw based on animation mode
    if (this.animationMode === 'rain') {
      this.drawRainAnimation();
    } else if (this.animationMode === 'particles') {
      this.drawParticleAnimation();
    }
    
    if (this.isRunning && this.isActive) {
      this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
  }
  
  startAnimation() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTickTime = Date.now();
    this.animate();
  }
  
  stopAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.isRunning = false;
    this.ctx.fillStyle = this.palette.bg;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  setAnimationMode(mode) {
    if (['rain', 'particles'].includes(mode)) {
      this.animationMode = mode;
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.graphicsController = new GraphicsController();
});
