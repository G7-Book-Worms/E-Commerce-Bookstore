'use client';

// Password box with a Show/Hide button, so people can check what they typed.
// Takes the same props as <input>; the type is managed here.
//
// Pass reveal={false} on a "confirm your password" field. The point of asking twice is that the
// person types the password again from memory and the two are compared; being able to read the
// first box and copy it defeats that, so those fields stay masked.
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Show the Show/Hide button. Default true; false for confirm-password fields. */
  reveal?: boolean;
};

export function PasswordInput({ className = '', reveal = true, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  if (!reveal) {
    return <input {...props} type="password" className={className} />;
  }
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} pr-16`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex items-center gap-1 px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
