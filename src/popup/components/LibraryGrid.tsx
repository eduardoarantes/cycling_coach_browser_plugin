import type { ReactElement, ReactNode } from 'react';

export interface LibraryGridProps {
  children: ReactNode;
}

export function LibraryGrid({ children }: LibraryGridProps): ReactElement {
  return <div className="grid grid-cols-1 gap-4">{children}</div>;
}
