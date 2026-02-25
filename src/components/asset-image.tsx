"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, type ImgHTMLAttributes } from "react";

type AssetImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
  fallbackClassName?: string;
};

export function AssetImage({
  alt,
  className,
  fallbackClassName = "asset-fallback-md",
  onError,
  ...props
}: AssetImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span aria-hidden className={`asset-fallback ${fallbackClassName} ${className ?? ""}`} />;
  }

  return (
    <img
      {...props}
      data-asset-image="true"
      alt={alt}
      className={className}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
