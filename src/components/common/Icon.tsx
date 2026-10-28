/** Inline stroke icons (24×24, lucide-style). */
const PATHS: Record<string, string> = {
  back: 'M15 18l-6-6 6-6',
  forward: 'M9 18l6-6-6-6',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M8 5v14M16 5v14',
  stop: 'M6.5 6.5h11v11h-11z',
  loop: 'M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3',
  flask: 'M9 3h6M10 3v6L4.5 18.5A2 2 0 006.2 21h11.6a2 2 0 001.7-2.5L14 9V3M7 15h10',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
  chevron: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  close: 'M18 6L6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
  eraser: 'M7 21h10M5.5 13.5l7-7a2 2 0 012.8 0l3.2 3.2a2 2 0 010 2.8L12 19H8.5L5.5 16a1.8 1.8 0 010-2.5zM9 10l6 6',
  cursor: 'M4 3l7 17 2.5-7.5L21 10z',
  link: 'M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7',
  note: 'M4 4h16v12l-4 4H4zM15 20v-4h5M8 9h8M8 13h5',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  upload: 'M12 21V9M7 14l5-5 5 5M4 3h16',
  folder: 'M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  refresh: 'M21 12a9 9 0 01-15.5 6.2L3 16M3 12a9 9 0 0115.5-6.2L21 8M21 3v5h-5M3 21v-5h5',
  edit: 'M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z',
  check: 'M5 12l5 5 9-10',
  sidebar: 'M3 4h18v16H3zM9 4v16',
  sidebarR: 'M3 4h18v16H3zM15 4v16',
  zoomIn: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3M11 8v6M8 11h6',
  zoomOut: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3M8 11h6',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z',
  printer: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18',
  question: 'M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01M12 21a9 9 0 100-18 9 9 0 000 18z',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8zM7.5 7.5h.01',
  palette: 'M12 21a9 9 0 110-18c5 0 9 3.6 9 8 0 2.5-2 4-4.5 4H15a2 2 0 00-1.5 3.3A1.6 1.6 0 0112 21zM7.5 11.5h.01M10.5 7.5h.01M15.5 7.5h.01',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z',
  grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
}

export function Icon({ name, size = 18, stroke = 1.8, className, fill }: { name: keyof typeof PATHS | string; size?: number; stroke?: number; className?: string; fill?: boolean }) {
  return (
    <svg className={`icon ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name] ?? ''} />
    </svg>
  )
}
