import * as WebBrowser from 'expo-web-browser';
import { COLORS } from '../constants/colors';

export function openInAppBrowser(url: string): void {
  WebBrowser.openBrowserAsync(url, {
    toolbarColor: COLORS.bg,
    controlsColor: '#FFFFFF',
    enableBarCollapsing: true,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  }).catch(() => {});
}

export function dismissInAppBrowser(): void {
  try {
    WebBrowser.dismissBrowser();
  } catch {
    // no-op
  }
}
