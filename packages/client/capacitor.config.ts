import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.durak.online',
  appName: 'Durak Online',
  webDir: 'dist',
  assets: {
    iconPath: 'resources/icon.png',
    splashPath: 'resources/splash.png',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e1b4b',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1e1b4b',
    },
  },
};

export default config;
