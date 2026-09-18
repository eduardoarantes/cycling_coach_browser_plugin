## MODIFIED Requirements

### Requirement: Clear stored auth on rejected token

The background worker SHALL clear the stored PlanMyPeak token when a validation request returns `401`, so the popup reflects a not-authenticated state instead of a stale valid state.

Clearing SHALL apply only to the credential that was actually rejected. Before removing the stored credential, the worker SHALL compare the credential the rejected request used against the credential stored at that moment, and SHALL leave storage untouched when they differ.

#### Scenario: Expired or foreign token is cleared

- **WHEN** the validation request to the PlanMyPeak backend returns `401` and the stored credential is still the one that request used
- **THEN** the stored PlanMyPeak token is removed and the popup shows PlanMyPeak as not authenticated

#### Scenario: Late rejection does not erase a newer credential

- **WHEN** a validation request issued before a recovery returns `401` after recovery has stored a new credential
- **THEN** the newer credential is left in place and the coach is not signed out

## ADDED Requirements

### Requirement: One owner performs every automatic credential removal

Every automatic removal of the stored PlanMyPeak credential SHALL be performed by a single background owner. The paths that remove it today — the shared API client on rejection, the popup validation request, and the popup store after its own freshness check — SHALL all route through that owner rather than removing the credential themselves.

The owner SHALL serialize the comparison and the removal against credential capture writes, so a replacement stored between the decision and the removal is not erased. A separate read followed by a removal SHALL NOT be relied upon, because the storage area offers no compare-and-swap.

#### Scenario: Popup does not remove the credential itself

- **WHEN** the popup determines that the stored credential is no longer fresh
- **THEN** it asks the background owner to remove it rather than removing it directly

#### Scenario: Replacement arriving mid-decision is not erased

- **WHEN** a credential is judged unusable and a replacement is captured before the removal is applied
- **THEN** the replacement is left in place and the coach is not signed out

#### Scenario: Freshness-driven removal follows the same rule

- **WHEN** removal is triggered by a freshness check rather than by a rejected request
- **THEN** the same compare-and-remove rule and the same serialization apply

### Requirement: Credential freshness is derived from the token's expiry

The extension SHALL determine whether a stored PlanMyPeak credential is fresh from the expiry claim carried by the credential itself, rather than from a fixed maximum age since capture. The expiry SHALL be read without verifying the signature, which remains the server's responsibility, and a small clock-skew allowance SHALL cause a credential to be treated as expired shortly before its stated expiry.

When the stored value is not a decodable token, or carries no usable expiry, the extension SHALL fall back to the existing maximum-age rule rather than treating it as expired.

#### Scenario: Short-lived credential is recognised as expired

- **WHEN** a stored credential's expiry has passed but it was captured less than the maximum age ago
- **THEN** the credential is treated as expired rather than fresh

#### Scenario: Skew allowance refreshes just before expiry

- **WHEN** a stored credential expires within the clock-skew allowance
- **THEN** it is treated as expired so a replacement is obtained before a request is spent

#### Scenario: Undecodable value falls back to the age rule

- **WHEN** the stored value is not a decodable token, or carries no usable expiry
- **THEN** freshness is decided by the maximum-age rule and the coach is not signed out

#### Scenario: Freshness rule is shared

- **WHEN** the popup and the background each need to decide whether the credential is fresh
- **THEN** both apply the same rule rather than separate implementations

### Requirement: Auth capture is refused for a confirmed inactive environment

The extension SHALL derive the environment of an observed PlanMyPeak credential from the sender's origin, never from the message contents, and SHALL ignore a capture whose origin maps to an environment other than the active one. Storing the credential and rejecting it later SHALL NOT be relied upon, because the single credential slot would already have been overwritten.

A capture whose origin maps to no known environment SHALL be stored and recorded as being of unknown environment. A stored credential recorded as unknown, or carrying no recorded environment, SHALL remain usable, so credentials captured before this requirement continue to work.

#### Scenario: Staging sign-in does not displace the production credential

- **WHEN** the active environment is production and an authenticated request is observed on the staging origin
- **THEN** the stored production credential is left in place and the export continues to work

#### Scenario: Environment comes from the sender

- **WHEN** a capture is received
- **THEN** its environment is derived from the sender's origin rather than from any value carried in the message

#### Scenario: Lookalike origin is not accepted as first-party

- **WHEN** a capture arrives from an origin that merely resembles a first-party origin, such as one with a first-party host as a prefix of a longer domain
- **THEN** it is not treated as that environment

#### Scenario: Previously stored credential keeps working

- **WHEN** a credential stored before environments were recorded is read
- **THEN** it is treated as usable rather than as belonging to the wrong environment
