'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

type Op = '+' | '−' | '×' | '÷';

/** Basic four-function calculator like the one on the JAMB CBT screen. No eval. */
export function Calculator() {
  const [display, setDisplay] = useState('0');
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(true);

  const apply = (a: number, b: number, o: Op) =>
    o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : b === 0 ? NaN : a / b;
  const fmt = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 1e10) / 1e10) : 'Error');

  function digit(d: string) {
    if (display === 'Error') return clear();
    if (fresh) {
      setDisplay(d === '.' ? '0.' : d);
      setFresh(false);
    } else if (!(d === '.' && display.includes('.')) && display.length < 14) {
      setDisplay(display === '0' && d !== '.' ? d : display + d);
    }
  }
  function operator(o: Op) {
    const v = Number(display);
    if (acc !== null && op && !fresh) {
      const r = apply(acc, v, op);
      setAcc(r);
      setDisplay(fmt(r));
    } else setAcc(v);
    setOp(o);
    setFresh(true);
  }
  function equals() {
    if (acc === null || !op) return;
    const r = apply(acc, Number(display), op);
    setDisplay(fmt(r));
    setAcc(null);
    setOp(null);
    setFresh(true);
  }
  function clear() {
    setDisplay('0');
    setAcc(null);
    setOp(null);
    setFresh(true);
  }

  const keys: { label: string; onClick: () => void; kind?: 'op' | 'eq' | 'fn'; aria?: string }[] = [
    { label: 'C', onClick: clear, kind: 'fn', aria: 'Clear' },
    {
      label: '±',
      onClick: () => setDisplay(fmt(-Number(display))),
      kind: 'fn',
      aria: 'Change sign',
    },
    {
      label: '√',
      onClick: () => {
        setDisplay(fmt(Math.sqrt(Number(display))));
        setFresh(true);
      },
      kind: 'fn',
      aria: 'Square root',
    },
    { label: '÷', onClick: () => operator('÷'), kind: 'op', aria: 'Divide' },
    ...['7', '8', '9'].map((d) => ({ label: d, onClick: () => digit(d) })),
    { label: '×', onClick: () => operator('×'), kind: 'op' as const, aria: 'Multiply' },
    ...['4', '5', '6'].map((d) => ({ label: d, onClick: () => digit(d) })),
    { label: '−', onClick: () => operator('−'), kind: 'op' as const, aria: 'Minus' },
    ...['1', '2', '3'].map((d) => ({ label: d, onClick: () => digit(d) })),
    { label: '+', onClick: () => operator('+'), kind: 'op' as const, aria: 'Plus' },
    { label: '0', onClick: () => digit('0') },
    { label: '.', onClick: () => digit('.'), aria: 'Decimal point' },
    { label: '=', onClick: equals, kind: 'eq' as const, aria: 'Equals' },
  ];

  return (
    <div className="space-y-3">
      <output
        aria-live="polite"
        className="block rounded-lg bg-slate-900 px-3 py-3 text-right text-2xl text-white tabular-nums"
      >
        {op && acc !== null ? (
          <span className="mr-2 text-sm text-slate-400">
            {fmt(acc)} {op}
          </span>
        ) : null}
        {display}
      </output>
      <div className="grid grid-cols-4 gap-2">
        {keys.map((k) => (
          <button
            key={k.label}
            type="button"
            aria-label={k.aria}
            onClick={k.onClick}
            className={cn(
              'min-h-12 rounded-lg text-lg font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-teal-700',
              k.kind === 'op'
                ? 'bg-teal-50 text-teal-800'
                : k.kind === 'eq'
                  ? 'col-span-2 bg-teal-700 text-white'
                  : k.kind === 'fn'
                    ? 'bg-slate-200'
                    : 'bg-slate-100',
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
