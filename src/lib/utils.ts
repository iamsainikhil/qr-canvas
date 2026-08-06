import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isValidHex = (hex: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(hex);

export const isLightColor = (color: string): boolean => {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return true;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
};

export const getContrastingTextColor = (bgColor: string): string =>
  isLightColor(bgColor) ? '#171717' : '#FFFFFF';

export const normalizeHex = (value: string): string => {
  const uppercase = value.trim().toUpperCase();
  const hex = uppercase.replace(/^#/, '').replace(/[^0-9A-F]/g, '').slice(0, 6);
  return `#${hex}`;
};

export const getImageSrc = (image: string | { src: string }): string =>
  typeof image === 'string' ? image : image.src;
