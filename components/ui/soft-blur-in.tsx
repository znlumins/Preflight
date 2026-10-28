'use client';

import React, { useMemo } from 'react';

export interface SoftBlurInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number; // ms
  duration?: number; // ms
  stagger?: number; // ms per unit
  splitBy?: 'word' | 'character';
  isExiting?: boolean;
  as?: React.ElementType;
}

export function SoftBlurIn({
  children,
  className = '',
  delay = 0,
  duration = 400,
  stagger = 40,
  splitBy = 'word',
  isExiting = false,
  as: Component = 'div',
}: SoftBlurInProps) {
  const isString = typeof children === 'string';

  const renderedContent = useMemo(() => {
    if (!isString) return children;

    const words = (children as string).split(' ');
    let globalIndex = 0;

    return words.map((word, wIdx) => {
      if (splitBy === 'character') {
        const chars = Array.from(word);
        return (
          <span key={wIdx} className="inline-block whitespace-nowrap">
            {chars.map((char, cIdx) => {
              const currentIdx = globalIndex++;
              const charDelay = isExiting
                ? currentIdx * 8
                : delay + currentIdx * stagger;

              return (
                <span
                  key={cIdx}
                  className="inline-block"
                  style={{
                    animationName: isExiting ? 'softBlurOut' : 'softBlurIn',
                    animationDuration: `${isExiting ? 250 : duration}ms`,
                    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    animationDelay: `${charDelay}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  {char}
                </span>
              );
            })}
            {wIdx < words.length - 1 && (
              <span className="inline-block">&nbsp;</span>
            )}
          </span>
        );
      }

      // Default: word-by-word (vastly superior 60fps performance)
      const currentIdx = globalIndex++;
      const wordDelay = isExiting
        ? currentIdx * 15
        : delay + currentIdx * stagger;

      return (
        <span key={wIdx} className="inline-block">
          <span
            className="inline-block"
            style={{
              animationName: isExiting ? 'softBlurOut' : 'softBlurIn',
              animationDuration: `${isExiting ? 250 : duration}ms`,
              animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
              animationDelay: `${wordDelay}ms`,
              animationFillMode: 'both',
            }}
          >
            {word}
          </span>
          {wIdx < words.length - 1 && (
            <span className="inline-block">&nbsp;</span>
          )}
        </span>
      );
    });
  }, [children, isString, delay, duration, stagger, splitBy, isExiting]);

  return (
    <>
      {/* Keyframe styles */}
      <style>{`
        @keyframes softBlurIn {
          0% {
            opacity: 0;
            filter: blur(4px);
            transform: translateY(4px);
          }
          100% {
            opacity: 1;
            filter: blur(0px);
            transform: translateY(0);
          }
        }
        @keyframes softBlurOut {
          0% {
            opacity: 1;
            filter: blur(0px);
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            filter: blur(6px);
            transform: translateY(-6px);
          }
        }
      `}</style>

      <Component className={className}>
        {renderedContent}
      </Component>
    </>
  );
}

export default SoftBlurIn;
