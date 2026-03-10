# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| Latest  | ✅ Yes             |
| Older   | ❌ No              |

Only the latest deployed version of PrepTrack receives security updates.

## Reporting a Vulnerability

If you discover a security vulnerability in PrepTrack, please report it responsibly:

**Email:** [belkis.aslani@gmail.com](mailto:belkis.aslani@gmail.com)

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

**Please do NOT:**
- Open a public GitHub issue for security vulnerabilities
- Exploit the vulnerability beyond what is necessary for verification

## Response Timeline

- **Acknowledgment:** Within 48 hours
- **Assessment:** Within 7 days
- **Fix:** As soon as possible, depending on severity

## Security Measures

PrepTrack implements the following security measures:

### Data Privacy
- All user data is stored exclusively in the browser's IndexedDB
- No data is transmitted to servers (except barcode lookups to Open Food Facts API)
- No cookies, tracking, analytics, or advertising

### Code Security
- Input sanitization on all user inputs
- CSV injection prevention (dangerous first characters are prefixed)
- Strict TypeScript mode with no implicit `any`
- Content Security Policy headers via Service Worker
- No `eval()`, `innerHTML`, or other unsafe DOM operations
- Dependencies audited during CI/CD pipeline (`npm audit`)

### PWA Security
- HTTPS enforced (GitHub Pages)
- Service Worker with precaching for integrity
- No external scripts or third-party trackers

## Scope

The following are in scope:
- The PrepTrack web application at `https://beko2210.github.io/Prepper_Log/`
- The source code in this repository

The following are out of scope:
- Open Food Facts API (third-party service)
- GitHub infrastructure
- Browser-level vulnerabilities
