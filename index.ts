import { registerRootComponent } from 'expo';
import { defineBackgroundLocationTask } from './src/platform/locationTask';
import App from './App';

// Must run before registerRootComponent — TaskManager requires top-level registration
defineBackgroundLocationTask();

registerRootComponent(App);
