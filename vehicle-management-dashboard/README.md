# Motiv Vehicle Operations Dashboard

A responsive dashboard for a vehicle import, shipping, and fleet management system. The interface is plain HTML, CSS, and JavaScript. It can still run as a browser-only demo, or you can start the optional dependency-free Node.js backend to require sign-in.

## Run it

Open `index.html` directly in a modern browser. The dashboard works from a `file://` URL. An internet connection is only needed if you want the optional Google Fonts; the page falls back to system sans-serif fonts otherwise.

### Sign-in mode (optional)

Install Node.js 18 or newer, then run `node server.js` from this folder and open `http://127.0.0.1:4173`. The server protects the dashboard files and sends signed-in visitors to a login page. Sign in with username `Eldadboateng` and the password you supplied in chat. The server keeps only a salted PBKDF2-SHA-256 password hash in `auth.json`; the plain password is not stored in the project. Sessions use an HTTP-only, SameSite cookie, expire after eight hours, and are held in memory until expiry or server restart. Sign out from the profile menu.

`auth.json` is ignored by Git because it contains the account's password hash. Keep this file private and include it in secure backups if you need the login to continue working. The optional server is intended for local use on a trusted computer. Before exposing it to a network or the public internet, put it behind HTTPS and replace the demo's in-memory sessions and local data storage with production-grade identity and persistent storage. Opening `index.html` directly remains demo mode and does not enforce sign-in.

## Project structure

- `index.html` — semantic page structure, navigation, dashboard panels, sample fleet table, and accessible control labels.
- `style.css` — responsive layout, theme variables, component styles, SVG chart presentation, and dark mode.
- `script.js` — dependency-free dashboard, inventory, shipment, customer, driver, maintenance, expense, report, and settings interactions, local demo storage, filtering, CSV export, and form handling.
- `server.js` — optional built-in Node.js server, password verification, rate-limited sign-in, and session handling.
- `auth.json` — local username and salted password hash. Keep private; excluded from Git.
- `login.html`, `login.css`, `login.js` — optional server sign-in screen.
- `.gitignore` — excludes local credentials and dependencies from Git.

## Included interactions

- Responsive sidebar with mobile drawer and scrim.
- Light and dark themes; the selected theme is saved in local storage.
- Notifications and profile menus, with dismissible read state.
- Vehicle filtering from either the table filter or global search. `Ctrl+K` / `⌘K` focuses global search.
- Hover values on the business overview chart, plus clickable dashboard actions with feedback.
- Responsive SVG revenue and volume chart, fleet status visualization, shipment progress, activity feed, and realistic demo data.

The dashboard and Vehicles, Shipments, Customers, Drivers, Maintenance, Expenses, Reports, and Settings modules present illustrative sample data. Inventory supports add/remove, filtering, and CSV export. Shipments supports creation, status progression, filtering, and CSV export. Customers and Drivers support adding records, filtering, and CSV export. Maintenance supports service scheduling and work order status updates. Expenses supports recording costs and toggling payment status. Reports summarize these demo records and export a CSV snapshot. Settings lets you update your demo profile and workspace name, username, theme, and notification indicator, and download a JSON backup. Demo changes are saved in browser local storage.

## Planned next modules

1. Vehicles — inventory, vehicle records, intake, pricing, documents, and delivery readiness. The first inventory view is implemented.
2. Shipments — container tracking, milestones, ports, freight details, and arrival processing. The first tracking view is implemented.
3. Customers — customer records, reservations, invoices, and delivery history. A first customer directory is implemented.
4. Drivers — driver profiles, assignments, and delivery schedules. A first driver directory is implemented.
5. Maintenance — service plans, work orders, and vehicle condition. A first work order board is implemented.
6. Expenses — import costs, operating expenses, and payment tracking. A first expense ledger is implemented.
7. Reports — fleet, shipment, sales, and profitability reports. A first operations and expense reporting view is implemented.
8. Settings — workspace, users, roles, and preferences. A first profile and workspace preference view is implemented.

## Notes

Vehicle, shipment, customer, driver, maintenance, expense, and preference demo records remain in browser local storage. The optional local server adds an actual sign-in gate for served pages; no real carrier tracking service or persistent server database is connected yet. The administrator profile defaults to Eldad Asante Boateng (`Eldadboateng`). Reported sales use total amounts from active customer records, and expenses use records in the selected period, so the net figure is an illustrative tracked value rather than accounting profit. Keep the app framework-free by adding future module behavior in `script.js` and shared styling in `style.css`, or extend the optional server when persistent API-backed records are needed.
