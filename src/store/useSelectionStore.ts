import { create } from 'zustand';
import { ProminentEntity } from './useProminenceStore';

export interface SelectionStoreState {
  readonly selectedEntity: ProminentEntity | null;
  readonly lastTap: { x: number; y: number } | null;
  readonly selectEntity: (entity: ProminentEntity | null) => void;
  readonly setLastTap: (x: number, y: number) => void;
}

export const useSelectionStore = create<SelectionStoreState>()((set) => ({
  selectedEntity: null,
  lastTap: null,
  selectEntity: (entity) => set({ selectedEntity: entity }),
  setLastTap: (x, y) => set({ lastTap: { x, y } }),
}));