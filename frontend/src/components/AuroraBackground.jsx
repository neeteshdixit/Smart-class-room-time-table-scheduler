import React from 'react';
import { motion } from 'framer-motion';

export default function AuroraBackground({ children }) {
  return (
    <div className="relative min-h-screen w-full bg-[#03050c] overflow-hidden text-white selection:bg-indigo-500/30">
      {/* Aurora Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            transform: [
              'translate(0%, 0%) scale(1)',
              'translate(-10%, 10%) scale(1.1)',
              'translate(10%, -10%) scale(0.9)',
              'translate(0%, 0%) scale(1)'
            ]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle_at_center,rgba(0,229,255,0.15),transparent_60%)] blur-[100px]"
        />
        <motion.div
          animate={{
            transform: [
              'translate(0%, 0%) scale(1)',
              'translate(10%, -10%) scale(1.1)',
              'translate(-10%, 10%) scale(0.9)',
              'translate(0%, 0%) scale(1)'
            ]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] right-[0%] w-[40%] h-[60%] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_60%)] blur-[120px]"
        />
        <motion.div
          animate={{
            transform: [
              'translate(0%, 0%) scale(1)',
              'translate(20%, 0%) scale(1.2)',
              'translate(-10%, 20%) scale(0.8)',
              'translate(0%, 0%) scale(1)'
            ]
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] left-[20%] w-[60%] h-[50%] rounded-full bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.1),transparent_60%)] blur-[120px]"
        />
      </div>

      {/* Grid overlay for texture */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] pointer-events-none opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

      {/* Content wrapper */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}
