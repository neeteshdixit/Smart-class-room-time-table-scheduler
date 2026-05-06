import React, { useEffect, useState, useRef } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';
import { useCursor } from '../context/CursorContext';

const PARTICLE_EMOJIS = ['⭐', '❤️', '✨'];

export default function CustomCursor() {
  const { cursorType } = useCursor(); // For manual overrides if needed
  const canvasRef = useRef(null);
  
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  
  // Spring physics for the trailing ring
  const springConfig = { damping: 25, stiffness: 400, mass: 0.5 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  const [isClicking, setIsClicking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hoverState, setHoverState] = useState('default');

  // Vanilla JS Particle System (for 60FPS high performance without React re-renders)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let particles = [];
    let animationFrameId;
    let lastMousePosition = { x: -100, y: -100 };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 15 + 10;
        this.speedX = (Math.random() - 0.5) * 1.5;
        this.speedY = (Math.random() - 0.5) * 1.5 - 0.5; // slight upward drift
        this.life = 1;
        this.decay = Math.random() * 0.015 + 0.01;
        
        this.text = PARTICLE_EMOJIS[Math.floor(Math.random() * PARTICLE_EMOJIS.length)];
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
      }

      draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life * 0.6); // Made lighter (max 0.6 opacity)
        ctx.font = `${this.size}px sans-serif`;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
      }
    }

    const animateParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        
        if (particles[i].life <= 0) {
          particles.splice(i, 1);
          i--;
        }
      }
      
      animationFrameId = requestAnimationFrame(animateParticles);
    };

    const handleMouseMove = (e) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      
      if (!isVisible) setIsVisible(true);
      
      // Calculate distance from last position to spawn particles
      const dx = e.clientX - lastMousePosition.x;
      const dy = e.clientY - lastMousePosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 20) { // Spawn particle every 20px of movement
        // Limit max particles on screen to avoid lag
        if (particles.length < 25) { 
          particles.push(new Particle(e.clientX, e.clientY));
        }
        lastMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    animateParticles();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [cursorX, cursorY, isVisible]);

  // Global hover detection without modifying all components
  useEffect(() => {
    const handleMouseOver = (e) => {
      const target = e.target;
      
      // Detect specific interactive elements
      if (
        target.tagName === 'BUTTON' || 
        target.closest('button') || 
        target.tagName === 'A' || 
        target.closest('a')
      ) {
        setHoverState('pointer');
      } else if (
        target.classList?.contains('card') || 
        target.closest('.card') ||
        target.closest('.glass')
      ) {
        setHoverState('card');
      } else if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.closest('input') || 
        target.closest('textarea')
      ) {
        setHoverState('text');
      } else {
        setHoverState('default');
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    return () => document.removeEventListener('mouseover', handleMouseOver);
  }, []);

  // Ensure cursor hides when mouse leaves window
  useEffect(() => {
    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);
    
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, []);

  if (!isVisible) return null;

  // Use manual override if provided via context, otherwise use auto-detected state
  const activeState = cursorType !== 'default' ? cursorType : hoverState;

  // Framer motion variants for smooth transitioning between states
  const variants = {
    default: {
      height: 32,
      width: 32,
      x: "-50%",
      y: "-50%",
      backgroundColor: "transparent",
      border: "1.5px solid rgba(229, 238, 251, 0.4)", // text-main
      scale: isClicking ? 0.8 : 1,
    },
    pointer: {
      height: 60,
      width: 60,
      x: "-50%",
      y: "-50%",
      backgroundColor: "rgba(229, 238, 251, 0.1)", // soft glow
      border: "1.5px solid rgba(229, 238, 251, 0.8)",
      scale: isClicking ? 0.9 : 1,
      mixBlendMode: "difference"
    },
    card: {
      height: 80,
      width: 80,
      x: "-50%",
      y: "-50%",
      backgroundColor: "rgba(37, 99, 235, 0.1)", // admin theme color
      border: "1.5px solid rgba(37, 99, 235, 0.4)",
      scale: isClicking ? 0.95 : 1,
      backdropFilter: "blur(2px)",
    },
    text: {
      height: 28,
      width: 4,
      x: "-50%",
      y: "-50%",
      backgroundColor: "rgba(229, 238, 251, 0.9)",
      border: "none",
      borderRadius: "2px",
      scale: isClicking ? 0.9 : 1,
      mixBlendMode: "difference"
    }
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[9998]"
      />
      {/* Trailing Ring */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9999] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
        }}
        variants={variants}
        animate={activeState}
        transition={{ type: 'spring', stiffness: 300, damping: 20, mass: 0.5 }}
      >
      </motion.div>
    </>
  );
}
