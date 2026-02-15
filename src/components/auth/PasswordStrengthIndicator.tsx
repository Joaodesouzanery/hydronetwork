import { useMemo } from "react";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
  severity: "critical" | "important" | "recommended";
}

const requirements: PasswordRequirement[] = [
  {
    label: "Mínimo de 8 caracteres",
    test: (pwd) => pwd.length >= 8,
    severity: "critical"
  },
  {
    label: "Pelo menos uma letra maiúscula (A-Z)",
    test: (pwd) => /[A-Z]/.test(pwd),
    severity: "important"
  },
  {
    label: "Pelo menos uma letra minúscula (a-z)",
    test: (pwd) => /[a-z]/.test(pwd),
    severity: "important"
  },
  {
    label: "Pelo menos um número (0-9)",
    test: (pwd) => /\d/.test(pwd),
    severity: "important"
  },
  {
    label: "Pelo menos um caractere especial (!@#$%^&*)",
    test: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
    severity: "recommended"
  },
  {
    label: "Mínimo de 12 caracteres (recomendado)",
    test: (pwd) => pwd.length >= 12,
    severity: "recommended"
  }
];

export const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const analysis = useMemo(() => {
    if (!password) {
      return {
        score: 0,
        strength: "none" as const,
        metRequirements: [],
        unmetRequirements: requirements
      };
    }

    const metRequirements = requirements.filter(req => req.test(password));
    const unmetRequirements = requirements.filter(req => !req.test(password));
    
    // Calculate score: critical = 25%, important = 15%, recommended = 10%
    let score = 0;
    metRequirements.forEach(req => {
      if (req.severity === "critical") score += 25;
      else if (req.severity === "important") score += 15;
      else score += 10;
    });

    let strength: "weak" | "fair" | "good" | "strong" | "none" = "weak";
    if (score >= 85) strength = "strong";
    else if (score >= 70) strength = "good";
    else if (score >= 45) strength = "fair";

    return {
      score: Math.min(score, 100),
      strength,
      metRequirements,
      unmetRequirements
    };
  }, [password]);

  const strengthConfig = {
    none: { color: "bg-muted", text: "", textColor: "text-muted-foreground" },
    weak: { color: "bg-destructive", text: "Fraca", textColor: "text-destructive" },
    fair: { color: "bg-orange-500", text: "Razoável", textColor: "text-orange-500" },
    good: { color: "bg-yellow-500", text: "Boa", textColor: "text-yellow-600" },
    strong: { color: "bg-green-500", text: "Forte", textColor: "text-green-600" }
  };

  if (!password) return null;

  const config = strengthConfig[analysis.strength];

  return (
    <div className="space-y-3 mt-2">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Força da senha:</span>
          <span className={`font-medium ${config.textColor}`}>
            {config.text}
          </span>
        </div>
        <Progress value={analysis.score} className="h-1.5" />
      </div>

      <div className="space-y-1.5">
        {requirements.map((req, index) => {
          const isMet = req.test(password);
          const Icon = isMet ? CheckCircle2 : 
                      req.severity === "critical" ? XCircle : AlertCircle;
          const iconColor = isMet ? "text-green-600" : 
                          req.severity === "critical" ? "text-destructive" : "text-muted-foreground";
          
          return (
            <div key={index} className="flex items-start gap-2 text-xs">
              <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${iconColor}`} />
              <span className={isMet ? "text-muted-foreground line-through" : "text-foreground"}>
                {req.label}
                {req.severity === "recommended" && " ✨"}
              </span>
            </div>
          );
        })}
      </div>

      {analysis.strength === "weak" && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-xs text-destructive">
            Senha muito fraca. Use pelo menos 8 caracteres com letras e números.
          </p>
        </div>
      )}
    </div>
  );
};

export const calculatePasswordStrength = (password: string): {
  isValid: boolean;
  isStrong: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("Senha deve ter pelo menos 8 caracteres");
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push("Senha deve conter pelo menos uma letra maiúscula");
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push("Senha deve conter pelo menos uma letra minúscula");
  }
  
  if (!/\d/.test(password)) {
    errors.push("Senha deve conter pelo menos um número");
  }

  const isValid = errors.length === 0;
  const isStrong = isValid && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) && password.length >= 12;
  
  return { isValid, isStrong, errors };
};
