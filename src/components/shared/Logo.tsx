interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  variant?: "dark" | "light" | "auto";
  className?: string;
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

  // Auto: dark bg = white logo, light bg = colored logo
  const isDark = variant === "dark" || (variant === "auto" && typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  const logoSrc = isDark ? "/logo-white.svg" : "/logo.svg";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/favicon.svg"
        alt="ConstruData"
        className={sizeClasses[size]}
      />
      {showText && (
        <span className={`${textClasses[size]} font-bold ${isDark ? "text-white" : "text-[#10367D]"}`}>
          ConstruData
        </span>
      )}
    </div>
  );
}
