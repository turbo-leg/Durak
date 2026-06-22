import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV !== 'production';

const config: CapacitorConfig = {
  appId: 'com.durak.online',
  appName: 'Durak Online',
  webDir: 'dist',
  // Dev: point to local Vite server for hot reload. Remove for production builds.
  ...(isDev && {
    server: {
      url: 'http://localhost:5173',
      cleartext: true,
    },
  }),
  ios: {
    contentInset: 'automatic',
    // Felt green so the rubber-band overscroll bounce blends with the table
    // instead of showing a black bar behind the web content.
    backgroundColor: '#0a3624',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#040f09',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#040f09',
    },
  },
};

export default config;
