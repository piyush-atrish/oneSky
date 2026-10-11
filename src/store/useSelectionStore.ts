import { create } from 'zustand';
import { getEntityDetail, type EntityDetail } from '../data/entityDetails';

export interface SelectionStoreState {
  readonly selectedEntity: EntityDetail | null;
  readonly lastTap: { readonly x: number; readonly y: number } | null;
  /** Looks the id up in the dictionary. An unknown id changes nothing and returns false. */
  readonly selectEntity: (id: string) => boolean;
  readonly clearSelection: () => void;
  readonly setLastTap: (x: number, y: number) => void;
}

export const useSelectionStore = create<SelectionStoreState>()((set) => ({
  selectedEntity: null,
  lastTap: null,
  selectEntity: (id) => {
    const entity = getEntityDetail(id);
    if (!entity) return false;
    set({ selectedEntity: entity });
    return true;
  },
  clearSelection: () => set({ selectedEntity: null }),
  setLastTap: (x, y) => set({ lastTap: { x, y } }),
}));