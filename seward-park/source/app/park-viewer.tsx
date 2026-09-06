'use client';
import { useEffect, useRef, useState } from 'react';
import { assetPath } from './asset-path';
import type { LightingStatus } from './solar';

export default function ParkViewer({ modelVersion }: { modelVersion: string }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Awaited<ReturnType<typeof import('./scene').createParkViewer>> | null>(null);
  const [lighting, setLighting] = useState<LightingStatus>({mode:'live',phase:'Daylight',isNight:false,timeLabel:''});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    async function initialize() {
      const { createParkViewer } = await import('./scene');
      if (cancelled || !host.current) return;
      const viewer = await createParkViewer(host.current, () => {}, modelVersion, status => { if(!cancelled)setLighting(status); });
      if (cancelled) { viewer.dispose(); return; }
      cleanup = viewer.dispose;
      api.current = viewer;
      setReady(true);
      host.current.dataset.loaded = "true";
    }
    initialize().catch(error => console.error('Unable to load the park model.', error));
    return () => { cancelled = true; cleanup(); api.current = null; };
  }, [modelVersion]);
  function toggleNight() {
    api.current?.lighting(lighting.isNight?'day':'night');host.current?.focus({preventScroll:true});
  }
  function followSun() { api.current?.lighting('live');host.current?.focus({preventScroll:true}); }
  function resetView() { api.current?.reset(); host.current?.focus({preventScroll:true}); }
  return <main className="viewer" data-night={lighting.isNight} data-lighting-mode={lighting.mode}>
    <div className="scene" ref={host} tabIndex={0} role="application"
      aria-label="Interactive park. Drag to orbit, scroll or pinch to zoom. Double-click a detail to focus. Arrow keys or WASD fly. Q and E move down and up. Shift moves faster. Drag to look around while flying. Escape returns to orbit. Zero resets the view. N switches day and night. L follows the sun in New York."
      onKeyDown={event => {
        if(event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
        const key=event.key.toLowerCase();
        if(key==='n'){event.preventDefault();toggleNight();}
        if(key==='l'){event.preventDefault();followSun();}
      }} />
    <div className="viewer-controls">
    <button className="viewer-control" onClick={resetView} disabled={!ready} aria-label="Reset view" title="Reset view (0)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.5M3 4v6h6"/></svg>
    </button>
    <a className="viewer-control" href={assetPath('/downloads/seward-park-obj.zip') + '?v=' + encodeURIComponent(modelVersion)} download="Seward-Park-OBJ.zip" aria-label="Download OBJ model" title="Download OBJ model and materials">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/></svg>
    </a>
    <button className="viewer-control night-toggle" onClick={toggleNight} disabled={!ready} aria-pressed={lighting.isNight}
      aria-label={lighting.isNight?'Switch to daytime':'Switch to nighttime'} title={lighting.isNight?'Daytime · manual (N)':'Nighttime · manual (N)'}>
      {lighting.isNight ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
        : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 14.2A8.9 8.9 0 0 1 9.8 3.4a9 9 0 1 0 10.8 10.8Z"/></svg>}
    </button>
    <button className="viewer-control live-toggle" onClick={followSun} disabled={!ready} aria-pressed={lighting.mode==='live'}
      aria-label="Follow current New York time"
      title={lighting.mode==='live'?`Live · ${lighting.phase} · ${lighting.timeLabel} in New York (L)`:'Follow the sun in New York (L)'}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>
    </button>
    </div>
  </main>;
}
