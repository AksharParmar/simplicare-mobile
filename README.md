# SimpliCare

SimpliCare is a privacy-first medication management app built with Expo, React Native, and TypeScript.

The current implementation focuses on a local-first mobile experience: medication schedules, reminders, dose logging, and dashboard insights all work without a backend.

## Current Features

### Home Dashboard
- `Next up` focus card with primary actions (`Mark taken`, `Skip`)
- `Day progress` card with today’s taken/skipped/remaining counts
- `7-day adherence` ring and summary percentage
- Functional streak badge based on consecutive perfect-adherence days
- `Later today` quick list for upcoming doses

### Medications
- Medication list with search and sort
- Add medication manually
- Medication detail with schedule and per-medication history
- Edit and delete medication flows

### Reminders & Logging
- Local notifications scheduled from saved medication times
- Snooze support with configurable default snooze minutes
- Dose action sheet for taken/skipped/snooze
- Dose logs persisted locally

### Copilot (Stub)
- Modern local chat UI
- Suggested prompts + local stub responses
- No external API calls yet

### Settings
- Display name personalization
- Reminder toggle and default snooze preference
- Export local data
- Delete all local data
- Show tutorial again
- Dev-only tools (in development builds)

### Onboarding & UX
- First-time tutorial modal
- iOS-like tab navigation with center add hub
- Safe-area and keyboard handling across input-heavy screens

## Tech Stack
- Expo SDK 54
- React Native + TypeScript
- React Navigation (bottom tabs + native stack)
- AsyncStorage for persistence
- Expo Notifications for local reminders

## Repository Structure
- `apps/mobile`: Expo mobile application
- `services/api`: Placeholder for future backend services
- `docs`: Product and implementation notes
- `AGENTS.md`: Product guardrails and MVP scope

## Local Development
```bash
cd apps/mobile
npm install
npm run start
```

Type-check:
```bash
cd apps/mobile
npx tsc --noEmit
```

## Product Direction
- Local-first by default
- No analytics by default
- Privacy-first handling for medication data
- MVP scope centered on reminders, logging, and clarity
