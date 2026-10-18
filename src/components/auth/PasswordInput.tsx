"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

/**
 * Password field with a reveal/hide toggle. Behaves like a normal <input>
 * (all props pass through) but swaps between type="password" and "text" and
 * exposes an accessible eye button. Keeps the shared `.auth-input` styling.
 *
 * Pass `id` from a visible <label htmlFor> so screen-reader and click labels
 * target the real control. The toggle stays out of the Tab order (tabIndex=-1)
 * so Tab moves Email → Password → Submit without an extra stop.
 */
export function PasswordInput({
  className = "auth-input",
  id,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  const autoId = useId();
  const inputId = id ?? autoId;
  const toggleId = `${inputId}-toggle`;

  return (
    <div className="pw-field">
      <input
        {...props}
        id={inputId}
        type={show ? "text" : "password"}
        className={`${className} pw-input`}
      />
      <button
        id={toggleId}
        type="button"
        className="pw-toggle"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-controls={inputId}
        aria-pressed={show}
        title={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

function Eye() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M2.5 12S5.5 5.5 12 5.5 21.5 12 21.5 12 18.5 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10.6 6.3A8.7 8.7 0 0 1 12 6.2c6 0 9 5.8 9 5.8a16 16 0 0 1-3 3.6M6.3 7.7A15.9 15.9 0 0 0 3 12s3 5.8 9 5.8a8.6 8.6 0 0 0 3.7-.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.6 9.7a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
