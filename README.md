
         CITOG DEVELOPER — a single self-contained portfolio site.

         WHAT'S FULLY FUNCTIONAL (no backend required):
         - Responsive layout, mobile navigation, smooth scrolling, scroll reveals
         - Sign up -> Login flow with validation, backed by persistent storage —
           accounts survive a page reload. Passwords are SHA-256 hashed before
           being stored; the plain-text password itself is never saved.
         - "Forgot password" -> "reset link sent" flow (simulated — see notes below)
         - Slide-to-verify human check gating the login/signup forms
         - AI Assistant chat — calls the Anthropic API directly. Works live in the
           Claude.ai preview; gracefully falls back to canned replies if the API
           can't be reached (e.g. once this file is hosted on your own domain).
         - Contact form opens the visitor's email app with a pre-filled message.

         WHAT NEEDS REAL BACKEND WORK BEFORE THIS GOES LIVE FOR REAL USERS:
         - The persistent storage used here is this preview environment's built-in
           store — great for demos, but for a real production launch move accounts
           to a proper database (Firebase Auth, Supabase, Node/Express + Postgres,
           etc.) with server-side password hashing.
         - Real "Sign in with Google / GitHub / LinkedIn": needs OAuth apps
           registered with each provider + server-side token exchange. The
           buttons are wired and ready for those calls.
         - Real password-reset emails: needs an email service (Nodemailer,
           SendGrid, AWS SES) triggered from a backend — plus an actual "set a
           new password" step on the site, which isn't built yet either.
         - Swap the placeholder project mockups/video for real screenshots and a
           real demo video of your work.
         