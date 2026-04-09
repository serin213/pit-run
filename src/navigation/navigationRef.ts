import { createNavigationContainerRef } from '@react-navigation/native';
import { useState, useEffect } from 'react';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const TAB_ROUTES: Record<string, 0 | 1 | 2 | 3> = {
  Home: 0,
  Race: 1,
  History: 2,
  Profile: 3,
};

type TabListener = (tab: 0 | 1 | 2 | 3 | undefined) => void;
const _listeners = new Set<TabListener>();
let _currentTab: 0 | 1 | 2 | 3 | undefined = undefined;

export function syncTabFromRoute(routeName: string): void {
  const tab = TAB_ROUTES[routeName];
  _currentTab = tab;
  _listeners.forEach((l) => l(tab));
}

export function useActiveTab(): 0 | 1 | 2 | 3 | undefined {
  const [tab, setTab] = useState<0 | 1 | 2 | 3 | undefined>(_currentTab);
  useEffect(() => {
    _listeners.add(setTab);
    return () => {
      _listeners.delete(setTab);
    };
  }, []);
  return tab;
}
