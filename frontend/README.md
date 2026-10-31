# Frontend code map

## ඉක්මනට අදාළ code එක හොයාගන්න

VS Code එකේ **Ctrl+P** ඔබලා පහත file නම type කරන්න.

| වෙනස් කරන්න අවශ්‍ය කොටස | File එක |
| --- | --- |
| Navbar/search bar උස, පළල, අකුරු, spacing | `src/components/Navbar.tsx` |
| Sidebar links සහ expand/collapse | `src/components/Sidebar.tsx` |
| Search results සහ filter buttons | `src/components/MouldSearch.tsx` |
| Mould card පෙනුම | `src/components/MouldCard.tsx` |
| Mould details dialog | `src/components/MouldSheet.tsx` |
| Mould එක move කිරීම, status, shots form | `src/components/MouldActions.tsx` |
| Mould add/edit form | `src/components/MouldFormSheet.tsx` |
| Work log form | `src/components/WorkLogForm.tsx` |
| Problem report form | `src/components/ProblemForm.tsx` |
| Login form | `src/app/login/page.tsx` |
| Racks screen | `src/app/(tracker)/racks/page.tsx` |
| Workshop screen | `src/app/(tracker)/workshop/page.tsx` |
| Work report screen | `src/app/(tracker)/work-report/page.tsx` |
| Rack administration | `src/app/(tracker)/rack-admin/page.tsx` |
| Users / Account / Audit / Passkeys | `src/app/(tracker)/users`, `account`, `audit`, `passkeys` යන folder එකේ `page.tsx` |
| හැම page එකටම පොදු colors සහ responsive rules | `src/app/globals.css` |
| Sinhala/English වචන | `src/utils/i18n.ts` සහ `src/utils/passkeyText.ts` |

Screen file එක තුළ `Screen state`, `Effects`, `Button and form actions`, `UI` comments අනුව අදාළ කොටස හොයාගන්න පුළුවන්. UI එකේ size සහ spacing වෙනස් කරන්න `className` බලන්න. Theme colors සහ පොදු responsive/state rules `globals.css` තුළ තියෙනවා.

Every screen has its own Next.js page and URL. Login lives at `/login`. The tracker layout shares navigation, language and mould dialogs across signed-in pages.

```text
src/
  app/
    page.tsx                  Opens /find; forwards old hash bookmarks
    login/page.tsx            /login: form, login, passkeys, language and redirect
    layout.tsx                Fonts, metadata, initial theme and PWA setup
    (tracker)/
      layout.tsx              Shared app layout
      find/page.tsx           /find
      extrusion/page.tsx      /extrusion
      racks/page.tsx          /racks
      workshop/page.tsx       /workshop
      work-report/page.tsx    /work-report
      rack-admin/page.tsx     /rack-admin
      audit/page.tsx          /audit
      users/page.tsx          /users
      account/page.tsx        /account
      passkeys/page.tsx       /passkeys
  components/
    AppLayout.tsx             Session checks, navbar, sidebar, shared dialogs
    MouldSearch.tsx           Search results and filters for /find and /extrusion
    Navbar.tsx                Compact navbar: search, title, language, theme, menu
    MouldSheet.tsx            Shared mould details dialog
    MouldFormSheet.tsx        Shared add/edit form
    WorkLogForm.tsx           Add/edit a work log
    ProblemForm.tsx           Report a mould problem
    MouldActions.tsx          Move mould, change status, record shots
    ...                      Other reusable UI
  utils/                      API, types, translations, helpers
  providers/                  PWA install state only
```

The `(tracker)` folder is a route group: its name does not appear in the URL. Each `page.tsx` contains its own page state, loading, handlers, and UI. `find` and `extrusion` share `components/MouldSearch.tsx` because they use the same interface with different tool types.

| Sidebar screen | URL |
| --- | --- |
| Find moulds | `/find` |
| Extrusion dies | `/extrusion` |
| Racks | `/racks` |
| Workshop | `/workshop` |
| Work reports | `/work-report` |
| Rack administration | `/rack-admin` |
| Audit history | `/audit` |
| Users | `/users` |
| Account/password | `/account` |
| Passkeys | `/passkeys` |

Account, users, and passkeys are regular pages. Mould details remain a dialog on the current page: `/find?mould=<id>`. Closing the dialog removes that parameter. Old links such as `/#/racks` and `/#/find/m/<id>` forward to the corresponding new page.

## Shared code

- `components/AppLayout.tsx` renders the current page through `children`; it does not switch between page components.
- `components/AppLayout.tsx` owns and shares the signed-in user, language, refresh state, and common callbacks. Pages read it with `useApp()`.
- `components/Sidebar.tsx` uses Next.js links. Sign out and install remain actions.
- `utils/helpers.ts` keeps the small rack, theme, and URL helpers together.
- `utils/permissions.ts` checks access before a restricted page is rendered. The backend enforces API permissions too.
- `utils/api.ts` handles backend requests; `utils/i18n.ts` contains English and Sinhala text.

Keep page-only UI inside its page file, such as `RackRows` in `app/(tracker)/racks/page.tsx`. Extract reusable UI to `components/`. Write Tailwind classes directly in JSX; `app/globals.css` keeps theme variables and shared responsive/state rules.

The three auto-refreshing screens keep their interval and cleanup in their own `useEffect`. `components/ThemeToggle.tsx` owns the theme state directly, without a theme context/provider. The PWA provider remains shared so the login and sidebar install buttons use the same browser install prompt.

## Run and verify

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

## Change the navbar or sidebar

- `src/components/Navbar.tsx`: navbar layout, search state, debounce effect, clear handler and inline Tailwind styles.
- `src/components/Sidebar.tsx`: sidebar links, expansion state, effects and inline Tailwind styles.
- `src/components/MouldSearch.tsx`: filters, API loading and search results.

The Find and Extrusion search input sits inside the navbar. There is no separate search header.

Navbar sizes are in `Navbar.tsx`: `56px` minimum height, `h-10` (40px) search input, and `text-[15px]` input text. Its width fills the space between the title and controls.

## Login and notifications

- `/login` → `src/app/login/page.tsx`. All login fields, password/passkey handlers, language selection and Tailwind classes live here.
- Opening a tracker page without a session redirects to `/login?next=...`. Login returns to that local tracker page, including a mould link. Signed-in visitors to `/login` go straight to the requested tracker page.
- `src/app/layout.tsx` renders the library's `<Toaster />` once. Pages/forms import `toast` from `react-hot-toast` and call `toast.promise(...)` or `toast.error(...)` directly. There is no custom toast component, feedback helper, or toast callback in the page context.
- Reusable UI stays in `components/`. A one-off full screen belongs in its route's `page.tsx`.

Official docs checked for this structure: [Next.js pages and layouts](https://nextjs.org/docs/app/getting-started/layouts-and-pages), [Tailwind utility classes](https://tailwindcss.com/docs/styling-with-utility-classes), [react-hot-toast API](https://react-hot-toast.com/docs/toast).
