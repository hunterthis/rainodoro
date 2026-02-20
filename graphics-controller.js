// Graphics Controller - Handles viewport-fill animations with ripple/bubble effects
class GraphicsController {
  constructor() {
    this.host = document.getElementById('immersive-host');
    this.canvas = document.getElementById('immersive-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.timerOverlay = document.getElementById('immersive-timer-overlay');
    this.animationFrameId = null;
    this.isRunning = false;
    this.isActive = false;
    this.timerIsRunning = false;
    
    // Animation state
    this.fillPercentage = 0;
    this.remaining = 0;
    this.totalDuration = 0;
    this.mode = 'pomodoro';
    this.previousWaterHeight = 0;
    
    // Soft pastel palette
    this.palette = {
      bg: '#0b1020',
      water: '#5dbdff',
      waterDark: '#4d9eff',
      rainColor: '#e6eef6'
    };
    
    // Rain particles for fullscreen
    this.raindrops = [];
    this.maxRaindrops = 120;
    this.initRaindrops();
    
    // Time tracking
    this.lastTickTime = Date.now();
    
    // Event listeners
    this.onTimerTick = this.onTimerTick.bind(this);
    this.onTimerFinish = this.onTimerFinish.bind(this);
    this.onTimerStart = this.onTimerStart.bind(this);
    this.onTimerStop = this.onTimerStop.bind(this);
    this.onTimerPause = this.onTimerPause.bind(this);
    
    document.addEventListener('timer-tick', this.onTimerTick);
    document.addEventListener('timer-finished', this.onTimerFinish);
    document.addEventListener('timer-started', this.onTimerStart);
    document.addEventListener('timer-stopped', this.onTimerStop);
    document.addEventListener('timer-paused', this.onTimerPause);
    
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
    
    // Sync current timer state from window.timerState
    if (window.timerState) {
      this.remaining = window.timerState.remaining;
      this.totalDuration = window.timerState.duration;
      this.fillPercentage = (this.totalDuration - this.remaining) / this.totalDuration;
      this.mode = window.timerState.currentMode;
      this.timerIsRunning = window.timerState.isRunning;
    }
    
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
    this.ctx.imageSmoothingEnabled = true;
  }
  
  onWindowResize() {
    if (this.isActive) {
      this.calculateScale();
      this.initRaindrops();
    }
  }
  
  onTimerTick(event) {
    const detail = event.detail;
    this.fillPercentage = detail.percentage;
    this.remaining = detail.remaining;
    this.totalDuration = detail.total;
    this.mode = detail.mode;

    const pct = this.fillPercentage * 100;
    if (this.isActive && this.timerIsRunning) {
      if (Math.abs(pct - this.previousWaterHeight) > 0.2) {
        this.createRipple();
      }
      if (pct > 10 && Math.random() > 0.3) {
        this.createBubble();
      }
    }
    this.previousWaterHeight = pct;
  }
  
  onTimerFinish() {
    // Auto-exit animation when timer finishes
    this.timerIsRunning = false;
    if (this.isActive) {
      this.exitAnimation();
    }
  }
  
  onTimerStart() {
    this.timerIsRunning = true;
    // Animation already running from enterAnimation, just enable rain movement
  }
  
  onTimerPause() {
    this.timerIsRunning = false;
    // Keep animation running to show fill level, just stop rain movement
  }
  
  onTimerStop() {
    this.timerIsRunning = false;
    if (this.isActive) {
      this.exitAnimation();
    }
  }

  initRaindrops() {
    this.raindrops = [];
    for (let i = 0; i < this.maxRaindrops; i++) {
      this.raindrops.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: Math.random() * 4 + 5,
        length: Math.random() * 8 + 8,
        width: 1,
        depth: Math.random(),
        opacity: 0.3 + Math.random() * 0.7
      });
    }
  }
  
  initParticles() {
    // No particles needed - only ripples and bubbles via DOM
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
    // No particles - ripples and bubbles are DOM elements
  }
  
  createRipple() {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    const size = Math.random() * 24 + 12;
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = Math.random() * 100 + '%';
    ripple.style.top = (Math.random() * 60 + 20) + '%';
    ripple.style.pointerEvents = 'none';
    ripple.style.animation = 'ripple 0.8s ease-out forwards';
    this.host.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 800);
  }
  
  createBubble() {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const size = Math.random() * 4 + 2.5;
    bubble.style.width = size + 'px';
    bubble.style.height = size + 'px';
    bubble.style.left = (Math.random() * 90 + 5) + '%';
    bubble.style.bottom = '8%';
    bubble.style.pointerEvents = 'none';
    const duration = Math.random() * 1 + 1;
    bubble.style.animation = `bubble-rise ${duration}s ease-in forwards`;
    this.host.appendChild(bubble);
    
    setTimeout(() => bubble.remove(), 2000);
  }
  
  drawRainAnimation() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Clear canvas
    this.ctx.fillStyle = this.palette.bg;
    this.ctx.fillRect(0, 0, w, h);
    
    // Draw water level fill from bottom (fills browser viewport)
    const fillHeight = (this.fillPercentage * h);
    
    this.ctx.fillStyle = this.palette.water;
    this.ctx.fillRect(0, h - fillHeight, w, fillHeight);
    
    // Draw water wave effect
    this.ctx.strokeStyle = this.palette.waterDark;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for (let x = 0; x < w; x += 10) {
      const y = (h - fillHeight) + Math.sin(x * 0.01 + Date.now() * 0.001) * 2;
      if (x === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();
    
    // Draw raindrops (falling down)
    this.ctx.strokeStyle = this.palette.rainColor;
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
    // Draw just the water level and rain
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Clear canvas
    this.ctx.fillStyle = this.palette.bg;
    this.ctx.fillRect(0, 0, w, h);
    
    // Draw water level fill from bottom
    const fillHeight = (this.fillPercentage * h);
    
    this.ctx.fillStyle = this.palette.water;
    this.ctx.fillRect(0, h - fillHeight, w, fillHeight);
    
    // Draw water wave effect
    this.ctx.strokeStyle = this.palette.waterDark;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for (let x = 0; x < w; x += 10) {
      const y = (h - fillHeight) + Math.sin(x * 0.01 + Date.now() * 0.001) * 2;
      if (x === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();
    
    // Draw raindrops
    this.ctx.strokeStyle = this.palette.rainColor;
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = 1;
    
    for (let drop of this.raindrops) {
      const opacity = drop.opacity * (0.3 + drop.depth * 0.7);
      this.ctx.globalAlpha = opacity;
      
      this.ctx.beginPath();
      this.ctx.moveTo(Math.floor(drop.x), Math.floor(drop.y));
      this.ctx.lineTo(Math.floor(drop.x), Math.floor(drop.y + drop.length));
      this.ctx.stroke();
    }
    
    this.ctx.globalAlpha = 1.0;
  }
  
  animate() {
    const now = Date.now();
    const deltaTime = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;
    
    // Sync with current timer state from window every frame for animation
    if (window.timerState) {
      this.remaining = window.timerState.remaining;
      this.totalDuration = window.timerState.duration;
      this.fillPercentage = (this.totalDuration - this.remaining) / this.totalDuration;
      this.mode = window.timerState.currentMode;
      this.timerIsRunning = window.timerState.isRunning;
    }
    
    // Update animations only when timer is running
    if (this.timerIsRunning) {
      this.updateRaindrops(deltaTime);
      
      // Create ripples and bubbles based on fill changes
      const pct = this.fillPercentage * 100;
      if (this.isActive && Math.abs(pct - this.previousWaterHeight) > 0.2) {
        this.createRipple();
      }
      if (this.isActive && pct > 10 && Math.random() > 0.3) {
        this.createBubble();
      }
      this.previousWaterHeight = pct;
    }
    
    // Always draw the fill level when active (even if paused)
    this.drawRainAnimation();
    
    if (this.isRunning && this.isActive) {
      this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
  }
  
  startAnimation() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTickTime = Date.now();
    // Always render the fill, rain runs only when timer is running
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
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.graphicsController = new GraphicsController();
});
