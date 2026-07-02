'use client';

import dynamic from 'next/dynamic';

// Leaflet touches `window`, so the map must be client-only (no SSR / static prerender).
// Same pattern as the live MapWrapper.
const PlaybackMap = dynamic(() => import('./PlaybackMap'), { ssr: false });

export default function PlaybackMapWrapper(props) {
  return <PlaybackMap {...props} />;
}
