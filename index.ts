import { registerRootComponent } from 'expo';

// three@0.186's CommonJS bridge calls process.emitWarning() while R3F's
// native entry is loading. Metro provides `process` on native, but not that
// Node-only method, which otherwise crashes Hermes before App can render.
type MetroProcess = {
  emitWarning?: (warning: string, options?: unknown) => void;
};

declare const process: MetroProcess | undefined;

const metroProcess = process;

if (metroProcess && typeof metroProcess.emitWarning !== 'function') {
  metroProcess.emitWarning = () => undefined;
}

// This must remain a runtime require: static imports are evaluated before the
// polyfill above, including SkyCanvas -> @react-three/fiber/native -> three.
const App = require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
