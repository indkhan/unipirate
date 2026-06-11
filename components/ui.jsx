'use client';

import React from 'react';

export const cx = (...xs) => xs.filter(Boolean).join(' ');

export function Compass({ size = 24, stroke = 1.4 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="12" />
      <circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none" />
      <path d="M16 4 L17.6 14.4 L16 16 L14.4 14.4 Z" fill="currentColor" stroke="none" opacity="0.9" />
      <path d="M16 28 L14.4 17.6 L16 16 L17.6 17.6 Z" opacity="0.45" />
      <path d="M4 16 L14.4 14.4" opacity="0.25" />
      <path d="M28 16 L17.6 17.6" opacity="0.25" />
    </svg>
  );
}

export function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="text-navy">
        <Compass size={26} />
      </div>
      {!compact && (
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-[22px] leading-none text-navy"
            style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}
          >
            UniPirate
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-50 mt-1">DE</span>
        </div>
      )}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  className,
  type = 'button',
  disabled,
  icon,
}) {
  const sizes = {
    sm: 'h-9 px-3.5 text-[13px]',
    md: 'h-11 px-5 text-[14px]',
    lg: 'h-12 px-6 text-[15px]',
  };
  const variants = {
    primary:
      'bg-navy text-paper hover:bg-navy-dark active:bg-navy-dark border border-navy shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_1px_2px_rgba(17,24,39,0.12)]',
    secondary: 'bg-paper text-navy border border-line hover:border-navy/40 hover:bg-white',
    ghost: 'bg-transparent text-navy hover:bg-navy/5 border border-transparent',
    link: 'bg-transparent text-navy underline-offset-4 hover:underline border border-transparent px-0',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
        sizes[size],
        variants[variant],
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ children, onClick, className, 'aria-label': label }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center h-9 w-9 rounded-md border border-line bg-paper hover:border-navy/40 hover:bg-white text-ink-70 transition-colors',
        className
      )}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'neutral', className }) {
  const tones = {
    neutral: 'bg-ink-5 text-ink-70 border-line',
    navy: 'bg-navy/8 text-navy border-navy/15',
    emerald: 'bg-[oklch(0.96_0.04_150)] text-[oklch(0.38_0.1_150)] border-[oklch(0.85_0.06_150)]',
    amber: 'bg-[oklch(0.96_0.05_80)] text-[oklch(0.42_0.12_70)] border-[oklch(0.86_0.08_75)]',
    coral: 'bg-[oklch(0.96_0.04_25)] text-[oklch(0.45_0.14_25)] border-[oklch(0.86_0.07_25)]',
    slate: 'bg-[oklch(0.96_0.01_255)] text-[oklch(0.38_0.03_255)] border-[oklch(0.88_0.01_255)]',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[11px] font-medium tracking-[0.01em]',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Chip({ children, active, onClick, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors',
        active
          ? 'bg-navy text-paper border-navy'
          : 'bg-paper text-ink-70 border-line hover:border-navy/40 hover:text-navy'
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function StatusBadge({ status, size = 'md' }) {
  const map = {
    'H+': { tone: 'emerald', label: 'H+', title: 'Direct access' },
    H: { tone: 'amber', label: 'H', title: 'Conditional' },
    'H-': { tone: 'coral', label: 'H−', title: 'Not sufficient on its own' },
    UNCLEAR: { tone: 'slate', label: '?', title: 'Unclear' },
  };
  const m = map[status] || map.UNCLEAR;
  const tones = {
    emerald: 'bg-[oklch(0.58_0.14_150)] text-white ring-[oklch(0.58_0.14_150)]/20',
    amber: 'bg-[oklch(0.72_0.14_75)] text-[oklch(0.22_0.05_75)] ring-[oklch(0.72_0.14_75)]/25',
    coral: 'bg-[oklch(0.62_0.17_25)] text-white ring-[oklch(0.62_0.17_25)]/20',
    slate: 'bg-[oklch(0.5_0.02_255)] text-white ring-[oklch(0.5_0.02_255)]/20',
  };
  const sizes = {
    sm: 'h-7 px-2.5 text-[12px]',
    md: 'h-9 px-4 text-[14px]',
    lg: 'h-12 px-5 text-[17px]',
  };
  return (
    <span
      title={m.title}
      className={cx(
        'inline-flex items-center justify-center font-semibold rounded-md ring-4',
        tones[m.tone],
        sizes[size]
      )}
      style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}
    >
      {m.label}
    </span>
  );
}

export function Field({ label, hint, error, children, required, optional, className }) {
  return (
    <label className={cx('block', className)}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12.5px] font-medium text-ink-80 tracking-[0.005em]">
          {label}
          {required && <span className="text-[oklch(0.55_0.17_25)] ml-0.5">*</span>}
        </span>
        {optional && <span className="text-[11px] text-ink-40">Optional</span>}
      </div>
      {children}
      {hint && !error && <div className="text-[11.5px] text-ink-50 mt-1.5 leading-snug">{hint}</div>}
      {error && <div className="text-[11.5px] text-[oklch(0.55_0.17_25)] mt-1.5 leading-snug">{error}</div>}
    </label>
  );
}

export function Select({ value, onChange, options, placeholder }) {
  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 pl-3.5 pr-9 rounded-md border border-line bg-paper text-[14px] text-ink-90 hover:border-ink-30 focus:border-navy focus:ring-2 focus:ring-navy/15 outline-none appearance-none transition-colors"
      >
        <option value="" disabled>
          {placeholder || 'Select…'}
        </option>
        {options.map((o) => (
          <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
            {typeof o === 'string' ? o : o.label}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-50 pointer-events-none"
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 8l5 5 5-5" />
      </svg>
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, type = 'text', suffix, prefix }) {
  return (
    <div className="relative flex items-center">
      {prefix && <span className="absolute left-3.5 text-ink-50 text-[13px]">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(
          'w-full h-11 rounded-md border border-line bg-paper text-[14px] text-ink-90 outline-none transition-colors',
          'hover:border-ink-30 focus:border-navy focus:ring-2 focus:ring-navy/15',
          prefix ? 'pl-8' : 'pl-3.5',
          suffix ? 'pr-12' : 'pr-3.5'
        )}
      />
      {suffix && <span className="absolute right-3.5 text-ink-50 text-[12px]">{suffix}</span>}
    </div>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex p-1 rounded-md border border-line bg-ink-5/50 gap-0.5">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cx(
              'px-3 h-8 rounded-[4px] text-[12.5px] font-medium transition-colors',
              active ? 'bg-paper text-navy shadow-sm border border-line' : 'text-ink-60 hover:text-ink-90'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ value, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="inline-flex items-center gap-2.5 group">
      <span
        className={cx(
          'relative inline-flex h-5 w-9 rounded-full transition-colors',
          value ? 'bg-navy' : 'bg-ink-20'
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-paper shadow-sm transition-transform',
            value && 'translate-x-4'
          )}
        />
      </span>
      <span className="text-[13px] text-ink-80 group-hover:text-ink-90">{label}</span>
    </button>
  );
}

export function Stepper({ steps, current }) {
  return (
    <div className="flex items-center gap-3">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  'inline-flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-medium border',
                  done && 'bg-navy text-paper border-navy',
                  active && 'bg-paper text-navy border-navy',
                  !done && !active && 'bg-paper text-ink-40 border-line'
                )}
              >
                {done ? (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.5 6L5 8.5L9.5 3.5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className={cx('text-[12px] font-medium', active ? 'text-ink-90' : 'text-ink-50')}>{s}</span>
            </div>
            {i < steps.length - 1 && <span className="h-px w-6 bg-line" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function Icon({ name, size = 16, stroke = 1.75, className }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
  };
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </>
    ),
    arrowRight: <path d="M5 12h14M13 5l7 7-7 7" />,
    arrowLeft: <path d="M19 12H5M11 5l-7 7 7 7" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    external: (
      <>
        <path d="M15 3h6v6" />
        <path d="M10 14L21 3" />
        <path d="M20 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h6" />
      </>
    ),
    check: <path d="M4 12l5 5L20 6" />,
    pin: (
      <>
        <path d="M12 22s-7-7.5-7-13a7 7 0 1114 0c0 5.5-7 13-7 13z" />
        <circle cx="12" cy="9" r="2.5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
      </>
    ),
    layers: (
      <>
        <path d="M12 3l9 5-9 5-9-5 9-5z" />
        <path d="M3 13l9 5 9-5" />
        <path d="M3 18l9 5 9-5" />
      </>
    ),
    filter: <path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" />,
    book: (
      <>
        <path d="M4 4h11a4 4 0 014 4v13H8a4 4 0 01-4-4V4z" />
        <path d="M4 17a4 4 0 014-4h11" />
      </>
    ),
    tag: (
      <>
        <path d="M3 12V3h9l9 9-9 9-9-9z" />
        <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    sparkle: (
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
    ),
    gauge: (
      <>
        <path d="M4 15a8 8 0 1116 0" />
        <path d="M12 15l4-4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h10M20 7h0M4 17h4M14 17h6" />
        <circle cx="17" cy="7" r="2" />
        <circle cx="11" cy="17" r="2" />
      </>
    ),
    chevronRight: <path d="M9 6l6 6-6 6" />,
    bookmark: <path d="M6 4h12v17l-6-4-6 4V4z" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8.5v.01M11.25 11.5h.75v5h1" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}
