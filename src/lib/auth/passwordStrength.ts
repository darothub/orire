/** Client-safe, advisory password feedback. The server (`validatePassword`) stays authoritative. */

export interface PasswordRule {
  key: "length" | "mix" | "case";
  label: string;
  met: boolean;
}

export interface PasswordStrength {
  /** 0 (empty) – 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4;
  label: "" | "Weak" | "Fair" | "Good" | "Strong";
  rules: PasswordRule[];
}

const LABELS = ["", "Weak", "Fair", "Good", "Strong"] as const;

export function passwordStrength(pw: string, minLength = 8): PasswordStrength {
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const rules: PasswordRule[] = [
    { key: "length", label: `${minLength}+ characters`, met: pw.length >= minLength },
    { key: "mix", label: "Letters and a number or symbol", met: /[A-Za-z]/.test(pw) && (hasDigit || hasSymbol) },
    { key: "case", label: "Upper and lower case", met: hasLower && hasUpper },
  ];
  if (!pw) return { score: 0, label: "", rules };

  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  let score = 1;
  if (pw.length >= minLength) score += 1;
  if (classes >= 3 || pw.length >= 12) score += 1;
  if (classes >= 3 && pw.length >= 12) score += 1;
  if (pw.length < minLength) score = 1;
  const s = Math.min(score, 4) as 1 | 2 | 3 | 4;
  return { score: s, label: LABELS[s], rules };
}
