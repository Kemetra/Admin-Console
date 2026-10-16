# Product

## Register

product

## Users

Seven actor tiers, all using the console as an operational tool:

- **Platform Admin (A1)**: Operates the entire Retail Tower OS platform. Cross-tenant. Manages tenants, system-wide settings, global audit. Highest privilege.
- **Tenant Owner (A2)**: Highest privilege within a single tenant. Provisions stores, manages tenant config and admin staff.
- **Tenant Admin (A3)**: Tenant-scoped admin. Manages stores, catalog, operators, and audit within one tenant.
- **Store Manager (A4)**: Store-scoped. Manages store catalog, unknown-item triage, store operators, and store audit.
- **Store Staff (A5)**: Read-mostly. Views catalog, reviews unknown items, queries audit.

All users are internal operators, not consumers. They use the console in the context of active retail operations, often under time pressure. Speed and clarity matter more than delight. Errors have operational consequences.

## Product Purpose

Retail Tower Console is the admin web frontend for the Retail Tower OS platform. It provides operational control across seven route families: auth/session, tenant/store management, catalog management, unknown-item review, operator/staff management, audit/search, and system settings. It consumes the Data-Pulse-2 backend API; it owns no data itself.

Success looks like: an operator can complete any routine administrative task with zero training, make scope-sensitive decisions (what tenant/store am I acting in?) without hesitation, and recover from errors without data loss.

## Brand Personality

Precise, Efficient, Direct. Linear discipline meets Vercel data-density. The interface is confident without being aggressive, fast without being terse. Every element is there because it earns its place.

Voice: matter-of-fact. Labels are short, accurate, and unambiguous. No marketing language in operational UI. Error messages say what happened and what to do next.

## Anti-references

- **Bootstrap-era CRUD admin**: dark navbar, blue primary buttons, table-heavy layouts, 2015 Rails-app aesthetic. This is the primary anti-reference. Note the console ships a dark *default* deliberately (a command-desk surface with gold as the authority signal); the anti-reference is the *undisciplined* dark navbar, generic and theme-left-unchanged, which we out-execute rather than resemble.
- **Bloated SaaS dashboard**: gradient hero metrics, identical stat-card grids, glassmorphism panels, generic purple/indigo palette, decorative animations.
- No pattern should look like it came from a default component library with the theme left unchanged.

## Design Principles

1. **Scope before action.** The active tenant and store context must always be legible. An operator who doesn't know where they are makes the wrong change. Never bury scope selection.
2. **Density earns its place.** Admins need information, not whitespace. Prefer a well-organized dense layout over an airy one that forces scrolling to see related data. But density is not clutter: remove elements that don't aid the task.
3. **Role-appropriate surfaces.** A store manager and a platform admin have different cognitive loads and different stakes. Screens should feel scoped to the actor using them, not expose everything to everyone.
4. **Errors are first-class.** Operational errors have consequences. Error states are designed with the same care as happy paths. Every error says what went wrong, who can fix it, and how.
5. **No chrome for chrome's sake.** Decorative elements, illustrative icons, gradient fills, and motion that doesn't signal state change are removed on sight. The product's value is operational utility.
6. **The operator owns the surface.** Operators work in real rooms, dim and bright, across long sessions. The console is light-first by default (RT-396) and ships a fully accessible opt-in dark theme the operator can switch to and that persists (RT-398). Both themes meet WCAG AA; theme is a preference, never a downgrade. Neither theme is an afterthought, the same system is expressed on two grounds.

## Accessibility & Inclusion

WCAG AA compliance. All interactive elements keyboard-navigable. Sufficient color contrast for text and UI components at AA ratios. Screen reader support for all form controls, status messages, and navigation. Reduced-motion media query respected for any transitions or animations.
