const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableElements(container: ParentNode) {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.getClientRects().length > 0,
  );
}

export function wrapTabTarget<T>(
  key: string,
  shiftKey: boolean,
  active: T | null,
  focusable: T[],
) {
  if (key !== "Tab" || focusable.length === 0) return null;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (first === undefined || last === undefined) return null;
  if (shiftKey && active === first) return last;
  if (!shiftKey && active === last) return first;
  return null;
}
