// Graphics Controller - Handles 8-bit style immersive animations
class GraphicsController {
  constructor() {
    this.canvas = document.getElementById('immersive-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.timerOverlay = document.getElementById('immersive-timer-overlay');
    this.host = document.getElementById('immersive-host');
    this.animationFrameId = null;
    this.isRunning = false;
    
    // Animation state
    this.fillPercentage = 0;
    this.remaining = 0;
    this.totalDuration = 0;
    this.mode = 'pomodoro';
    
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
    
    // Event listener
    this.onTimerTick = this.onTimerTick.bind(this);
    document.addEventListener('timer-tick', this.onTimerTick);
    
    // Setup fullscreen toggle
    this.setupFullscreenToggle();
    
    // Resize handler
    this.onWindowResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.onWindowResize);
    
    this.calculateScale();
  }
  
  setupFullscreenToggle() {
    const toggleBtn = document.getElementById('fullscreenToggle');
    const exitBtn = document.getElementById('immersive-exit-btn');
    
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleFullscreen());
    }
    
    if (exitBtn) {
      exitBtn.addEventListener('click', () => this.exitFullscreen());
    }
    
    // ESC key to exit
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.fullscreenElement === this.host) {
        this.exitFullscreen();
      }
    });
  }
  
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.enterFullscreen();
    } else {
      this.exitFullscreen();
    }
  }
  
  enterFullscreen() {
    if (this.host.requestFullscreen) {
      this.host.requestFullscreen().catch(err => {
        console.error(`Failed to enter fullscreen: ${err.message}`);
      });
    }
    this.host.classList.remove('immersive-hidden');
    this.calculateScale();
    this.startAnimation();
    document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
  }
  
  exitFullscreen() {
    if (document.fullscreenElement === this.host) {
      document.exitFullscreen();
    }
    this.host.classList.add('immersive-hidden');
    this.stopAnimation();
  }
  
  onFullscreenChange() {
    if (!document.fullscreenElement) {
      this.stopAnimation();
    }
  }
  
  calculateScale() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    // Integer scaling to maintain 8-bit look
    const scaleX = Math.floor(w / this.baseWidth);
    const scaleY = Math.floor(h / this.baseHeight);
    this.scale = Math.max(1, Math.min(scaleX, scaleY));
    
    // Set canvas size
    const canvasW = this.baseWidth * this.scale;
    const canvasH = this.baseHeight * this.scale;
    
    this.canvas.width = canvasW;
    this.canvas.height = canvasH;
    
    // Apply pixelated rendering
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.pixelated = true;
    this.canvas.style.imageRendering = 'pixelated';
  }
  
  onWindowResize() {
    if (document.fullscreenElement === this.host) {
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
        x: Math.random() * this.baseWidth,
        y: Math.random() * this.baseHeight,
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
        x: Math.random() * this.baseWidth,
        y: Math.random() * this.baseHeight,
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
    for (let drop of this.raindrops) {
      drop.y += drop.vy;
      drop.x += drop.vx;
      
      // Wrap around edges
      if (drop.y > this.baseHeight) {
        drop.y = -drop.length;
        drop.x = Math.random() * this.baseWidth;
      }
      
      if (drop.x < 0) drop.x = this.baseWidth;
      if (drop.x > this.baseWidth) drop.x = 0;
      
      // Slight drift
      drop.vx += (Math.random() - 0.5) * 0.01;
      drop.vx = Math.max(-0.5, Math.min(0.5, drop.vx));
    }
  }
  
  updateParticles(deltaTime) {
    for (let p of this.particles) {
      // Gentle vortex-like movement
      const angle = Math.atan2(this.baseHeight / 2 - p.y, this.baseWidth / 2 - p.x);
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
      if (p.x < 0) p.x = this.baseWidth;
      if (p.x > this.baseWidth) p.x = 0;
      if (p.y < 0) p.y = this.baseHeight;
      if (p.y > this.baseHeight) p.y = 0;
      
      // Rotation
      p.angle += p.rotationSpeed;
    }
  }
  
  drawRainAnimation() {
    // Clear canvas
    this.ctx.fillStyle = this.palette.bg;
    this.ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);
    
    // Draw water level fill (soft gradient)
    const fillHeight = (this.fillPercentage * this.baseHeight);
    
    // Dithered gradient effect
    for (let y = this.baseHeight - fillHeight; y < this.baseHeight; y++) {
      const gradientFactor = (this.baseHeight - y) / fillHeight;
      
      // Soft dither pattern for 8-bit look
      if ((y + Math.floor(Date.now() / 100)) % 2 === 0) {
        this.ctx.fillStyle = this.palette.water;
      } else {
        this.ctx.fillStyle = '#4d9eff';
      }
      
      this.ctx.fillRect(0, y, this.baseWidth, 1);
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
    // Clear canvas
    this.ctx.fillStyle = this.palette.bg;
    this.ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);
    
    // Draw water level fill
    const fillHeight = (this.fillPercentage * this.baseHeight);
    
    // Soft dither pattern
    for (let y = this.baseHeight - fillHeight; y < this.baseHeight; y++) {
      if ((y + Math.floor(Date.now() / 100)) % 2 === 0) {
        this.ctx.fillStyle = this.palette.water;
      } else {
        this.ctx.fillStyle = '#4d9eff';
      }
      
      this.ctx.fillRect(0, y, this.baseWidth, 1);
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
    
    if (this.isRunning && document.fullscreenElement === this.host) {
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
    this.ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);
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
