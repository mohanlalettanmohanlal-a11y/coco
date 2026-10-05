# COCO//FINDER

Retro-modern, responsive coconut seller finder.

## Run it

No build step is required.

1. Unzip the project.
2. Open `index.html` in a modern browser.
3. Click **USE MY LOCATION** and allow location access.
4. The app queries OpenStreetMap/Overpass for nearby produce shops, markets, and places whose names mention coconut/thenga/tenga/narial/coco.

For best results, serve the folder from a local HTTP server:

- VS Code: Live Server extension
- Python: `python -m http.server 8000`
- Then open `http://localhost:8000`

## Notes

- Browser geolocation requires user permission.
- The app does not send the location to its own server.
- Search data comes from OpenStreetMap's Overpass API.
- OpenStreetMap does not have a universal "coconut seller" category, so the search combines coconut-related names with greengrocers, farms, markets, supermarkets, and similar local places.
- If Overpass is unavailable, the UI displays demo results.
- Replace the Google Maps direction link with another maps provider if desired.

## Suggested production upgrades

1. Add a backend/cache for Overpass queries.
2. Add seller verification, opening hours, phone number and "open now".
3. Let sellers submit their own shop.
4. Add "fresh coconut / tender coconut / dry coconut" filters.
5. Add Malayalam + English localization.
6. Add a real database and admin moderation.
