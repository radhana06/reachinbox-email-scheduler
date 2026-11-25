import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const base = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${base} ${p.className ?? ''}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${base} ${p.className ?? ''}`} />;
