import type { CapacitorConfig } from '@capacitor/cli';

/* INFINITY // terminal — mobile shell config.
 * The web layer is the single-file production build (npm run build → dist/),
 * referenced here via webDir. localStorage in the WebView provides persistence;
 * native icons/splash come from resources/ via `npx @capacitor/assets generate`. */
const config: CapacitorConfig = {
  appId: 'app.infinity.terminal',
  appName: 'INFINITY',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#050805',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: '#050805',
    contentInset: 'always',
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#050805',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#050805',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
    },
  },
};

export default config;
