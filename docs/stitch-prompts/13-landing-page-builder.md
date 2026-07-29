# Google Stitch Prompt — Landing Page Builder

## Description
Create a landing page builder for merchants, allowing them to create and publish marketing pages with drag-and-drop sections.

## Changes
### Database: `server/prisma/schema.prisma`
- Add `LandingPage` model: id, storeId, name, slug (unique), sections (JSON string), published (bool), timestamps
- Add `landingPages` relation to Store model

### Server: `server/src/routes/landingPages.ts` (new)
- `GET /api/merchant/landing-pages` — list pages (id, name, slug, published, dates)
- `POST /api/merchant/landing-pages` — create page
- `GET /api/merchant/landing-pages/:id` — get single page with parsed sections
- `PUT /api/merchant/landing-pages/:id` — update page
- `DELETE /api/merchant/landing-pages/:id` — delete page
- `POST /api/merchant/landing-pages/:id/publish` — toggle published
- `GET /api/merchant/landing-pages/public/:slug` — public endpoint (published only, includes store branding)

### Client: `src/pages/MerchantLandingPages.tsx` (new)
- List all landing pages with name, slug, published status toggle, created date
- Create new page button with name/slug form
- Edit, view published, delete actions per row

### Client: `src/pages/MerchantLandingEditor.tsx` (new)
- Section types: hero (image, headline, subtext, CTA), features (title + list items), products (title), cta (headline, button), footer (text)
- Add section buttons, reorder up/down, edit inline, delete
- Save button persists sections as JSON

### Client: `src/pages/PublicLanding.tsx` (new)
- Renders published page at `/p/:slug`
- Full-width hero, features grid, CTA banner, footer
- Uses store branding (logo, name, tagLine, primaryColor)

### Client: `src/App.tsx`
- Route: `/merchant/landing-pages`
- Route: `/merchant/landing-pages/:id`
- Route: `/p/:slug`

### Client: `src/components/Sidebar.tsx`
- Add "صفحات هبوط" to MERCHANT_NAV
