"use client";

import { useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { fieldClass, inputClass } from "@/components/ui";
import { COUNTRY_CODES, joinPhone, splitPhone } from "@/lib/patients/phone";

// Country code (Greece by default) + number; the form receives them joined as "phoneNumber".
export function PhoneInput({ defaultValue, label, codeLabel, className = "" }: { defaultValue: string; label: string; codeLabel: string; className?: string }) {
  const [parts, setParts] = useState(() => splitPhone(defaultValue));
  return (
    <div className={`flex min-w-0 gap-1.5 ${className}`}>
      <Dropdown
        value={parts.code}
        onChange={(v) => v && setParts({ ...parts, code: v })}
        label={codeLabel}
        placeholder={null}
        options={COUNTRY_CODES.map((c) => ({ value: c.code, label: `${c.iso} ${c.code}` }))}
        className="w-[7.5rem] shrink-0"
      />
      <input
        type="tel"
        value={parts.local}
        onChange={(e) => setParts({ ...parts, local: e.target.value })}
        placeholder="69X XXX XXXX"
        aria-label={label}
        className={`${fieldClass} min-w-0 flex-1`}
      />
      <input type="hidden" name="phoneNumber" value={joinPhone(parts.code, parts.local)} />
    </div>
  );
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Says "not a valid email" as soon as the field is left with a wrong address.
export function EmailInput({ defaultValue, label, error }: { defaultValue: string; label: string; error: string }) {
  const [bad, setBad] = useState(false);
  const check = (v: string) => setBad(v.trim() !== "" && !EMAIL_RE.test(v.trim()));
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <input
        name="email"
        type="email"
        defaultValue={defaultValue}
        aria-label={label}
        aria-invalid={bad}
        onBlur={(e) => check(e.target.value)}
        onChange={(e) => bad && check(e.target.value)}
        className={`${inputClass} mt-0 ${bad ? "border-2 border-danger" : ""}`}
      />
      {bad && <span role="alert" className="text-[13px] text-danger-ink">{error}</span>}
    </div>
  );
}
