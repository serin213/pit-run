# Project Guidelines

## Target Platform
- Target: iOS and Android (App Store / Play Store distribution)
- Web is NOT a target platform — do not use it as a QA reference
- All implementation must be verified on native iOS simulator or Android emulator

## Styling Rules
- When iOS and Android behave differently (shadows, fonts, blur, overflow, etc.), use `Platform.OS` to branch
- Never assume web-compatible CSS behavior applies to native

## Stack
- React Native / Expo
- TypeScript
