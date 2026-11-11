import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Campo de palavra-passe com botão para mostrar/esconder. */
export default function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className={`pr-10 ${props.className ?? ""}`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Esconder palavra-passe" : "Mostrar palavra-passe"}
      >
        {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

/** Força indicativa: comprimento + variedade de caracteres. */
export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!password) return { score: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const s = Math.min(3, score) as 0 | 1 | 2 | 3;
  return { score: s, label: ["Fraca", "Razoável", "Boa", "Forte"][s] };
}

export function PasswordStrength({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  if (!password) return null;
  const colors = ["bg-destructive", "bg-amber-500", "bg-primary", "bg-emerald-500"];
  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded ${i <= score ? colors[score] : "bg-muted"}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Força da palavra-passe: {label}. Use pelo menos 8 caracteres, com letras, números e símbolos.</p>
    </div>
  );
}
