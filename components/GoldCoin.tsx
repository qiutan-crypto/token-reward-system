/* eslint-disable @next/next/no-img-element */
import React from 'react'

export default function GoldCoin({ size = 200, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/coin.png"
      alt="金币"
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      style={{ width: size, height: size, objectFit: 'contain' }}
      draggable={false}
    />
  )
}
