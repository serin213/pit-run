import { Linking } from 'react-native';

export type DeepLinkSubscription = { remove: () => void };

export function addDeepLinkListener(handler: (url: string) => void): DeepLinkSubscription {
  return Linking.addEventListener('url', ({ url }) => handler(url));
}

export function getInitialDeepLink(): Promise<string | null> {
  return Linking.getInitialURL();
}
