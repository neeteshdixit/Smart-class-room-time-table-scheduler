import React from 'react';
import { motion } from 'framer-motion';

export default function PageTransition({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: 'blur(15px)', scale: 0.96 }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
      exit={{ opacity: 0, y: -20, filter: 'blur(10px)', scale: 0.98 }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 24,
        mass: 0.8,
      }}
      className={`min-h-full ${className}`}
    >
      {children}
    </motion.div>
  );
}
