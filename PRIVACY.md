# Privacy Policy - PlanMyPeak Importer Extension

**Last Updated**: February 21, 2026

## Overview

PlanMyPeak Importer is a Chrome browser extension that helps you access your TrainingPeaks workout libraries directly from your browser.

## Data Collection and Storage

### Authentication Token

- **What we collect**: Your TrainingPeaks authentication token (bearer token)
- **How we collect it**: Automatically intercepted from your browser when you log into TrainingPeaks
- **Where it's stored**: Locally in your browser using Chrome's secure storage API (`chrome.storage.local`)
- **Who has access**: Only you. The token never leaves your device except to communicate with TrainingPeaks API
- **How long we keep it**: 24 hours, then it's automatically considered expired

### API Requests

- **What we access**: Your TrainingPeaks workout libraries and user profile
- **Purpose**: To display your workout data in the extension popup
- **Where data goes**: Fetched directly from TrainingPeaks API and displayed in the extension. No data is sent to third parties.

## Data We DO NOT Collect

- ❌ We do NOT collect personally identifiable information
- ❌ We do NOT track your browsing history
- ❌ We do NOT sell or share your data with third parties
- ❌ We do NOT send data to external servers (except TrainingPeaks API)
- ❌ We do NOT use analytics or tracking services

## Permissions Explained

### Storage Permission

- **Purpose**: Store your authentication token locally in your browser
- **Scope**: Only used for extension functionality

### Host Permissions

- **`https://tpapi.trainingpeaks.com/*`**: Required to fetch workout library data
- **`https://app.trainingpeaks.com/*`**: Required to intercept authentication token when you log in

## Data Security

- All data storage uses Chrome's encrypted storage API
- Authentication tokens are handled securely
- No data is transmitted to third-party services
- All communication with TrainingPeaks uses HTTPS

## User Control

You can:

- Clear your authentication token anytime using the "Logout" button in the extension
- Uninstall the extension to remove all stored data
- Revoke extension permissions in Chrome settings

## Third-Party Services

This extension only communicates with:

- **TrainingPeaks API** (`tpapi.trainingpeaks.com`) - To fetch your workout data
- **TrainingPeaks Web App** (`app.trainingpeaks.com`) - To intercept authentication

We have no affiliation with TrainingPeaks. This is an independent project.

## Children's Privacy

This extension does not knowingly collect information from children under 13.

## Changes to This Policy

We will notify users of any privacy policy changes by updating this document and the "Last Updated" date.

## Contact

For privacy concerns or questions:

- GitHub Issues: https://github.com/eduardoarantes/cycling_coach_browser_plugin/issues
- Email: [Your contact email]

## Open Source

This extension is open source. You can review the code at:
https://github.com/eduardoarantes/cycling_coach_browser_plugin
