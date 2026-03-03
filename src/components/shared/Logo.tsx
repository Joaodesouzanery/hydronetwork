interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  variant?: "dark" | "light" | "auto";
  className?: string;
}

export function LogoText({ className = "", textColor = "text-foreground" }: { className?: string; textColor?: string }) {
  return (
    <span className={`font-bold font-mono ${textColor} ${className}`}>
      CONSTRUDATA
    </span>
  );
}

export function Logo({ size = "md", showText = true, variant = "auto", className = "" }: LogoProps) {
  const sizeClasses = {
    sm: "h-6",
    md: "h-8",
    lg: "h-10",
  };

  const textClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  const isDark = variant === "dark" || (variant === "auto" && typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

  const logoSrc = isDark ? "/logo-white.svg" : "/logo.svg";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={logoSrc}
        alt="ConstruData"
        className={`${sizeClasses[size]} object-contain`}
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
