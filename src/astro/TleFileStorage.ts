import { File, Paths } from 'expo-file-system';
import type { TleStorage } from './TleCache';

/** Keeps the cached ISS orbit data in the app's cache folder (the system may clear it when storage runs low). */
const file = new File(Paths.cache, 'iss-tle.json');

export const fileTleStorage: TleStorage = {
  async read() {
    if (!file.exists) return null;
    return file.text();
  },
  async write(text) {
    if (file.exists) file.delete();
    file.create();
    file.write(text);
  },
};
