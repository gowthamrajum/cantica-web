import type { CapacitorConfig } from '@capacitor/cli'

// Wraps the same web build as a native iOS/Android app. Run:
//   BASE_PATH=/ npm run build && npx cap add ios android && npx cap sync
const config: CapacitorConfig = {
  appId: 'org.teluguchurchdfw.app',
  appName: 'Telugu Community Church',
  webDir: 'dist',
  backgroundColor: '#0f1728',
  ios: { contentInset: 'always' }
}

export default config
