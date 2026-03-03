interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  variant?: "dark" | "light" | "auto";
  className?: string;
}

const CodeSymbol = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 28 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M2 12L9 5M2 12L9 19" stroke="#FF6B2C" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 20L17 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M27 12L20 5M27 12L20 19" stroke="#FF6B2C" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function LogoText({ className = "", textColor = "text-foreground" }: { className?: string; textColor?: string }) {
  return (
    <span className={`font-bold font-mono ${textColor} ${className} inline-flex items-baseline`}>
      C<CodeSymbol className="h-[0.65em] w-[0.65em] inline-block mx-[-0.05em] translate-y-[-0.05em]" />NSTRUDATA
    </span>
  );
}

export function Logo({ size = "md", showText = true, variant = "auto", className = "" }: LogoProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const textClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  const isDark = variant === "dark" || (variant === "auto" && typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/favicon.svg"
        alt="ConstruData"
        className={sizeClasses[size]}
      />
      {showText && (
        <LogoText
          className={textClasses[size]}
          textColor={isDark ? "text-white" : "text-foreground"}
        />
      )}
    </div>
  );
}
