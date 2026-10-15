# @goalpath/api

The backend. Not built yet.

When we build it, it will:

1. Serve the content the admin dashboard manages (banners, popups, pages, starter plans) to the app.
2. Check Firebase login tokens, so only the right people can read or change things.
3. Store everything in MongoDB Atlas.

The admin already talks to a `ContentApi` interface (`apps/admin/src/lib/api.ts`). This backend will answer that same interface over HTTP.
