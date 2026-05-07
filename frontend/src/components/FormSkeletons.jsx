import React from "react";
import { motion } from "framer-motion";

export function InputSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-24 animate-pulse rounded bg-white/5" />
      <div className="h-12 w-full animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}

export function FormSkeleton({ fields = 4 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <InputSkeleton key={i} />
      ))}
      <div className="pt-4">
        <div className="h-12 w-full animate-pulse rounded-xl bg-white/10" />
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
        <div className="h-8 w-64 animate-pulse rounded bg-white/10" />
      </div>
      <FormSkeleton fields={3} />
    </div>
  );
}

export function GridSkeleton({ cards = 3 }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="h-32 w-full animate-pulse rounded-[22px] bg-white/5 border border-white/10" />
      ))}
    </div>
  );
}
