/**
 * Type declarations for React Native APIs used by the SDK
 * These are provided locally to avoid requiring @types/react-native as a dependency.
 * When bundled for React Native, the actual react-native module will provide the implementation.
 */

/**
 * Event emitter subscription returned by addEventListener
 */
export interface ReactNativeEventSubscription {
  remove(): void;
}

/**
 * URL event from Linking.addEventListener
 */
export interface ReactNativeLinkingURLEvent {
  url: string;
}

/**
 * Minimal Linking API types used by this SDK
 */
export interface ReactNativeLinking {
  canOpenURL(url: string): Promise<boolean>;
  openURL(url: string): Promise<void>;
  getInitialURL(): Promise<string | null>;
  addEventListener(
    type: 'url',
    handler: (event: ReactNativeLinkingURLEvent) => void
  ): ReactNativeEventSubscription;
}

/**
 * Minimal Platform API types used by this SDK
 */
export interface ReactNativePlatform {
  OS: 'ios' | 'android';
  Version: number;
}
