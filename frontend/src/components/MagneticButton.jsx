import React, { useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

export default function MagneticButton({ children, className = '', onClick, type = 'button', variant = 'primary' }) {
  const ref = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  const springConfig = { stiffness: 150, damping: 15, mass: 0.1 };
  const x = useSpring(0, springConfig);
  const y = useSpring(0, springConfig);

  const handleMouseMove = (e) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    x.set(middleX * 0.2); // Pull strength
    y.set(middleY * 0.2);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  const baseClasses = "relative inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#03050c] overflow-hidden";
  
  const variants = {
    primary: "bg-[#00e5ff] text-slate-950 hover:bg-[#33ebff] focus:ring-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.3)]",
    secondary: "bg-white/10 text-white hover:bg-white/15 focus:ring-white/20 border border-white/10",
    danger: "bg-red-500/90 text-white hover:bg-red-400 focus:ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]",
    ghost: "bg-transparent text-slate-300 hover:text-white hover:bg-white/5",
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      whileTap={{ scale: 0.95 }}
      style={{ x, y }}
      className={`${baseClasses} ${variants[variant] || variants.primary} ${className}`}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      {/* Button subtle inner glow on hover */}
      {isHovered && variant !== 'ghost' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-0 bg-gradient-to-t from-white/20 to-transparent mix-blend-overlay"
        />
      )}
    </motion.button>
  );
}
