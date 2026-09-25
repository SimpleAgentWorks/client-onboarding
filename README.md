# SimpleAgentWorks client onboarding

The public entry point is `index.html` on GitHub Pages. It embeds the deployed Apps Script web app in `apps-script/Index.html`, backed by `apps-script/Code.gs`. The manifest is `apps-script/appsscript.json`. Every release should commit all three source files before updating the Apps Script deployment, then tag the commit with the deployed version. The GitHub Pages wrapper remains unchanged unless iframe wiring changes.

## Set up a new environment

1. In Supabase, choose the existing `simpleagentworks-ops` project, then run `supabase/schema.sql` in its SQL editor. This creates `public.client_intakes` and a private Storage bucket, `client-intake-uploads`. Do not add public RLS policies.
2. In the Apps Script project settings, set Script Properties `SUPABASE_URL` to the exact project origin and `SUPABASE_SECRET_KEY` to a Supabase secret key. Never put this key in HTML or GitHub. Set `REVIEW_BOOKING_URL` to a real HTTPS booking page before advertising a booking button; when absent, the interface offers email instead. The SimpleAgentWorks review schedule is 30 minutes, weekdays 9 AM-5 PM America/Chicago with a 15-minute buffer and Google Meet; its live public page is https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ18g533OZKwMl2e0vY0DpwAy_8y00cusbTG4wIOMEqWDnZ_Gqen16FV4J_t9yqCVH4HNgHAW6Eu?gv=true .
3. Import Code.gs, Index.html, and appsscript.json into Apps Script. Authorize Drive, Mail, UrlFetch and external requests under the intended business Google account. Deploy the web app as that account, accessible to customers, then put the deployed URL in the Pages wrapper. Test with a real end-to-end intake and clean up test records.

The server writes each record to Supabase before accepting uploads, stores uploaded files in the private bucket under an intake/department/category prefix, mirrors files and answers into Drive, then marks the record complete and emails the intake notification. No key is exposed to customers. A failed primary write stops submission rather than silently falling back to Drive.

## AI service interview and product boundary

The intake collects requested actions plus optional configuration notes: calendars and booking rules, pricing ranges and terms, photo-estimate requirements and human review, and schedule-update channels. This is discovery, not an active automation or customer-facing AI endpoint. A final quote must be reviewed before acceptance. Calendar access and notifications require a separate implementation and permission flow. For future employee logins on client sites, plan Supabase Auth phone OTP with SMS delivery, abuse limits, audit trails and per-tenant authorization. This intake does not implement login.

## QA before release

- Re-run all three project paths, including a custom department, at 390px and 1280px, with single header/footer, no horizontal overflow or nested scroll.
- At each file field on a real iPhone Safari, select from Photo Library and confirm the filename appears without leaving the step; take a photo and repeat. Back/forward must retain selections; submit and confirm the image opens from Drive and private Supabase Storage. HEIC must convert to JPEG or show a clear conversion fallback, never claim it uploaded when it did not. Test a large image, multiple team photos, and documents.
- Walk all 30 showcase examples: previous/next retains each rating. Preview or fallback link opens the intended module without losing the current index. Test load at mobile width.
- Select every AI option and enter details; verify review, Supabase JSON, Drive answers JSON and notification email. Verify empty selection. Confirm no accidental secrets in client HTML or repository.
- Confirm the success page and help affordance. If booking URL is absent, there must not be a dead booking button.
