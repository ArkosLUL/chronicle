import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface MagicLogoProps {
  src: string;
  alt: string;
  className?: string;
}

// Generate stable particle configurations outside render
function generateParticles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    delay: `${i * 0.4}s`,
    x: `${10 + Math.random() * 80}%`,
    y: `${20 + Math.random() * 60}%`,
    duration: `${4 + Math.random() * 3}s`,  // Slower
    size: `${2 + Math.random() * 2}px`,     // Smaller (2-4px)
  }));
}

export function MagicLogo({ src, alt, className }: MagicLogoProps) {
  // Memoize particle configs so they don't change on re-render
  const particles = useMemo(() => generateParticles(12), []);

  return (
    <div className="relative inline-block overflow-visible">
      {/* Particle container - extends beyond logo bounds */}
      <div className="magic-particles absolute -inset-8 pointer-events-none overflow-visible">
        {particles.map((particle, i) => (
          <span
            key={i}
            className="particle"
            style={{
              "--delay": particle.delay,
              "--x": particle.x,
              "--y": particle.y,
              "--duration": particle.duration,
              "--size": particle.size,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Glow effect behind logo - organic blobs spread across */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[5%] top-[10%] w-44 h-20 bg-blue-400/10 blur-3xl rounded-full animate-pulse [animation-delay:2s] [animation-duration:3s]" />
        {/* <div className="absolute right-[10%] top-[20%] w-40 h-18 bg-blue-500/15 rounded-full  animate-pulse [animation-delay:0.5s]" /> */}
        <div className="absolute left-[-6.5%] top-[19%] w-90 h-50 bg-blue-400/15 rounded-full blur-2xl animate-pulse [animation-delay:0s] [animation-duration:3s]" /> 
        <div className="absolute right-[5%] top-[57%] w-44 h-20 bg-blue-400/10 rounded-full blur-3xl animate-pulse [animation-delay:1s] [animation-duration:3s]" />
        {/* <div className="absolute left-[15%] top-[70%] w-40 h-16 bg-blue-400/15 rounded-full  animate-pulse [animation-delay:0.8s]" /> */}
      </div>

      {/* Logo */}
      <img src={src} alt={alt} className={cn("relative z-10", className)} />
    </div>
  );
}
