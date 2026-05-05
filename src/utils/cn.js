/**
 * src/utils/cn.js — class name merger.
 * Tiny wrapper around clsx so component imports are short.
 */
import clsx from 'clsx';
export function cn(...args) {
  return clsx(...args);
}
