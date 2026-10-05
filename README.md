# yng4check-news

Public news feed for the YNG4check SDK message box. GitHub Actions refreshes one calm top headline per country every 30 minutes.
This repository contains only public headlines. No code or data of the SDK.

- File: `https://raw.githubusercontent.com/mack-hey/yng4check-news/main/news/<COUNTRY>.json` (for example `JP.json`, `US.json`)
- Format: `{ "country", "title", "source", "published", "updated_at" }`
- Countries: US, JP, GB, CA, AU, IN, SG, TH, VN. KH (Cambodia) uses the US English headline (no Cambodia edition).
- Headlines about violence, disasters, deaths and the military are skipped.

Notes
- Keep this repository public: browsers read the files directly.
- GitHub may pause scheduled workflows in public repositories with no activity for 60 days. If updates stop, open Actions > Update news > Enable workflow / Run workflow.
- Trial source: Google News RSS (not for commercial use). Replace with a licensed news API before production.
