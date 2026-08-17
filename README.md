# Invoice gen - macOS desktop app

Offline macOS desktop build of the Invoice gen (Fakturagenerator) invoice app.
Everything runs locally: no server, no internet connection needed.

## Install

1. Download `Invoice-gen-macOS.zip` from the Releases page.
2. Unzip it.
3. Drag `Invoice gen.app` into your Applications folder.
4. First launch: right-click the app and choose **Open** (macOS shows a warning
   for apps that are not from the App Store; this only happens once).

## Where your data lives

Saved customers and invoice history are stored inside the app on your Mac
(`invoice.customers.v1` / `invoice.history.v1`). Nothing is uploaded anywhere and
data does not sync between machines.

## Layout

- `main.js` - Electron main process. Serves the built app over a custom, secure
  `app://local` scheme so the origin is stable and localStorage persists across
  launches. Also puts a Save dialog on the PDF download and reveals the saved
  file in Finder.
- `src-app/` - the app source. Same components, styles and logic as the original
  Lovable project, built as a plain static Vite SPA (the original uses TanStack
  Start, which requires a running server - not usable in an offline desktop app).
- `web/` - the built static app that gets bundled into the .app.

## Rebuild

```sh
cd src-app && npm install && npx vite build
cd .. && rm -rf web && cp -r src-app/dist web
npx @electron/packager . "Invoice gen" --platform=darwin --arch=x64 \
  --out=dist-mac --overwrite --app-bundle-id=com.fakturagenerator.desktop \
  --icon=build/icon.icns \
  --ignore="(/node_modules|/src-app|/dist-mac|/\.git|/\.gitignore|\.zip$|/README\.md|/package-lock\.json)"
```
