import type { AnimalId, Reward } from '../state/types';

export const FONT = '"Hiragino Maru Gothic ProN", "Rounded Mplus 1c", "Yu Gothic UI", "Segoe UI", system-ui, -apple-system, sans-serif';

export const COLORS = {
  bg: '#FFF4F7',
  bgDark: '#F7DCE5',
  panel: '#FFFFFF',
  panelShadow: 'rgba(120, 60, 90, 0.18)',
  text: '#4A2E3B',
  textSoft: '#8C6A7A',
  primary: '#FF7AA2',
  primaryDark: '#E25C86',
  secondary: '#7FD1C8',
  secondaryDark: '#4FB1A6',
  accent: '#FFD166',
  board: '#FFFBF5',
  boardLine: '#D9B8C4',
  highlight: 'rgba(255, 122, 162, 0.35)',
  lastMove: '#FF4D7D',
  heart: '#FF5C8A',
  blush: 'rgba(255, 110, 140, 0.55)',
  o: '#5AA7FF',
  x: '#FF6F91',
  disabled: '#D8CCD2',
};

export interface AnimalPalette {
  body: string;
  accent: string;
  dark: string;
}

export const ANIMAL_COLORS: Record<AnimalId, AnimalPalette> = {
  cat: { body: '#F8E8C6', accent: '#F2A65A', dark: '#C77A2E' },
  dog: { body: '#DDAE74', accent: '#B98250', dark: '#8A5A2E' },
  rabbit: { body: '#FFFFFF', accent: '#F7B4C8', dark: '#D98AA3' },
  bear: { body: '#A5744A', accent: '#7A5030', dark: '#4E3119' },
};

export const REWARD_EMOJI: Record<Reward, string> = { kiss: '💋', hug: '🤗' };
