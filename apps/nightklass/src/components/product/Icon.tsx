const paths = {
  home: 'M3 10.5 12 3l9 7.5M5 9v12h5v-7h4v7h5V9',
  book: 'M12 6v15M3 5c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1V5Z',
  calendar: 'M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z',
  target: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5m-5 0 9-9m-5 0h5v5',
  cards: 'M8 8h13v13H8V8ZM3 16V3h13',
  chart: 'M4 20h16M7 16v-5m5 5V5m5 11V8',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21v-2a7 7 0 0 1 14 0v2',
  spark: 'm12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  back: 'M19 12H5m5-5-5 5 5 5',
  check: 'm5 12 4 4L19 6',
  clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  chat: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Zm2 5h10M7 13h6',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
  edit: 'm15 5 4 4M4 20l5-1L21 7l-4-4L5 15l-1 5Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M18 6 6 18',
  logout: 'M9 3H4v18h5m5-14 5 5-5 5m-5-5h10',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  eyeOff: 'm3 3 18 18M9 5.5a11 11 0 0 1 3-.5c6 0 10 7 10 7a18 18 0 0 1-4 4M6 6a18 18 0 0 0-4 6s4 7 10 7a11 11 0 0 0 5-1',
  flame: 'M12 3c0 6-6 7-6 12a6 6 0 1 0 12 0c0-3-1-5-3-7 0 4-3 4-3 4V3Z',
} as const
export type IconName = keyof typeof paths

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
