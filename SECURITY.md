# Security Policy

## Supported Versions

Security fixes are handled on a best-effort basis for:

- The latest state of the default branch
- The most recent packaged release, if one exists

Older builds may not receive fixes.

## What To Report

Please report issues such as:

- Exposure or unsafe handling of TrainingPeaks tokens
- Exposure or unsafe handling of PlanMyPeak or Supabase auth tokens
- Exposure or unsafe handling of Intervals.icu API keys
- Permission bypasses
- XSS, script injection, or unsafe HTML rendering
- Bugs that expose private workout, note, or plan data to the wrong user

## How To Report

1. Use GitHub private vulnerability reporting if it is enabled for this
   repository.
2. If private reporting is not available, open a minimal public GitHub issue
   asking for a private contact channel.
3. Do not include secrets, tokens, API keys, screenshots with credentials, or
   private athlete data in a public issue.
4. Revoke or rotate exposed credentials as soon as possible.

Include the following when you report a vulnerability:

- Extension version
- Browser and browser version
- Affected provider or integration
- Reproduction steps
- Security impact
- Whether the issue is local-only or remotely triggerable

## Response Process

- Initial acknowledgment target: within 7 days, best effort
- After triage, the maintainer will try to confirm severity and scope
- Please allow time for a fix before public disclosure

## Sensitive Data Handling

If you are unsure whether something is safe to post, assume it is not. Redact:

- Bearer tokens
- API keys
- Personal training data
- Email addresses or athlete identifiers that are not already public
