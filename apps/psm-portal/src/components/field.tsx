"use client";

import React from "react";

/** Shared page header: eyebrow, big title, subtitle. */
export function PageHeader({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-up">
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {children && <p className="mt-3 text-sm sm:text-base text-gray-600 max-w-2xl">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
  autoComplete,
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="field-label">
        {label}
        {required && <span className="text-brand-red"> *</span>}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        type={type ?? "text"}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
      />
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function Spinner() {
  return <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />;
}
