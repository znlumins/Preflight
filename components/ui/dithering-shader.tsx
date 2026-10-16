'use client';

import React from 'react';
import { Dithering, type DitheringProps } from '@paper-design/shaders-react';

export interface DitheringShaderProps extends DitheringProps {
  className?: string;
  style?: React.CSSProperties;
}

export function DitheringShader({
  className = '',
  style,
  shape = 'swirl',
  type = '4x4',
  colorBack = '#ffffff',
  colorFront = '#e2e8f0',
  pxSize = 4,
  speed = 0.9,
  ...props
}: DitheringShaderProps) {
  return (
    <div
      className={`absolute inset-0 h-full w-full overflow-hidden pointer-events-none ${className}`}
      style={style}
    >
      <Dithering
        shape={shape}
        type={type}
        colorBack={colorBack}
        colorFront={colorFront}
        pxSize={pxSize}
        size={pxSize}
        speed={speed}
        style={{ width: '100%', height: '100%' }}
        {...props}
      />
    </div>
  );
}

export default DitheringShader;
