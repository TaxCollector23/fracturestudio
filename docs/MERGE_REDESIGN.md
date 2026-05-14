# Merging `redesign-for-rangan`

The `redesign-for-rangan-main` folder is a reference prototype. It is not the active app: the real application is this codebase with `react-router-dom` routes, `MarketingLayout`, `SiteNav`, and `src/pages/*`.

Use this order when translating future redesign exports:

1. **Inventory** the redesign’s entry (`main.tsx` / `App.tsx`), router table, and global CSS tokens (colors, radii, type scale).
2. **Map routes** from the redesign onto this app’s URLs: `/`, `/methodology`, `/manifesto`, `/docs`, `/pricing`, `/changelog`, `/privacy`, `/studio/*`. Prefer extending `src/router.tsx` instead of running two routers.
3. **Replace layout primitives first**: swap `SiteNav`, `MarketingFooter`, and page wrappers while keeping `StudioCasePage` logic (tabs + `postChat`) unless the redesign re-implements the studio.
4. **Tokens**: consolidate Tailwind theme extensions in `tailwind.config.ts` and shared variables in `src/index.css` so marketing and studio share one scale.
5. **Delete** duplicate shells only after `npm run lint`, `npm run check`, and `npm run test` pass and you have manually smoke-tested Fracture / Citations / Rebuttals on your target host.

If the redesign ships its own API client, **discard** client-side system prompts and keep calls going through `postChat` + server `processChatPost` so keys and instructions stay server-side.
