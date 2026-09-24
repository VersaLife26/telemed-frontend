"use client";

import { useEffect, useRef } from "react";

type StreamVideoProps = Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "src"> & {
  stream: MediaStream | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
};

/**
 * A <video> bound to a MediaStream by prop. srcObject is not an attribute, so
 * it is assigned on mount and whenever the stream changes; this is what lets
 * one call render in several places (full view, floating tile, PiP) without
 * any of them going black on remount.
 */
export function StreamVideo({
  stream,
  videoRef,
  autoPlay = true,
  playsInline = true,
  ...props
}: StreamVideoProps) {
  const ownRef = useRef<HTMLVideoElement>(null);
  const ref = videoRef ?? ownRef;

  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [ref, stream]);

  return <video ref={ref} autoPlay={autoPlay} playsInline={playsInline} {...props} />;
}
