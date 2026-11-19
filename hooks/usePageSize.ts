import { useState } from 'react';

// Rows per page for an admin list. 25 by default; the admin can pick another size, and each list
// (products, orders, reviews) remembers its own choice in this browser.
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

const storageKey = (list: string) => `admin.pageSize.${list}`;

const read = (list: string) => {
  try {
    const n = Number(localStorage.getItem(storageKey(list)));
    return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
};

export function usePageSize(list: string): [number, (size: number) => void] {
  const [size, setSize] = useState<number>(() => read(list));
  const update = (next: number) => {
    if (!PAGE_SIZE_OPTIONS.includes(next)) return;
    setSize(next);
    try {
      localStorage.setItem(storageKey(list), String(next));
    } catch {
      /* private window: the choice lasts until reload */
    }
  };
  return [size, update];
}
