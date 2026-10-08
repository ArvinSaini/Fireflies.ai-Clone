# Fireflies.ai UI Research (October 2026)

Research done before building the frontend, so the clone matches the **current** product.
The web app needs a login, so the sources are public: the fireflies.ai homepage product mock-ups and
Fireflies Knowledge Base articles, whose screenshots and GIFs were last updated Feb to Jul 2026. Screens
were captured with Playwright; colors were sampled from the screenshots' pixels.

Sources:
- fireflies.ai homepage hero and "AI Summaries" mock-ups
- [Find and Manage Your Meetings (Notebook)](https://guide.fireflies.ai/articles/4827382971-learn-about-fireflies-notebook)
- [Learn about the Fireflies Notepad](https://guide.fireflies.ai/articles/6653885315-learn-about-the-fireflies-notepad)
- [Welcome Screen / Home dashboard](https://guide.fireflies.ai/articles/8020055559-Fireflies+Welcome+Screen%3A+A+Guide+to+Your+New+Home+Screen)
- [Tasks Feed](https://guide.fireflies.ai/articles/1574234155-learn-about-the-tasks-feed)
- [Analytics & Conversation Intelligence (Smart Search)](https://guide.fireflies.ai/articles/2608597716-understand-fireflies-analytics-and-conversation-intelligence)
- [Upload and transcribe files](https://guide.fireflies.ai/articles/3893959957-how-to-upload-and-transcribe-audio-or-video-files-in-fireflies)
- [AskFred for a meeting](https://guide.fireflies.ai/hc/en-us/articles/12241514674833)

## 1. Visual language

| Token | Value | Where seen |
|---|---|---|
| Brand / primary | `#6938EF` (hover `#5925DC`) | Capture button, Share, play button, "Create" |
| Brand soft | `#F4F3FF` bg + `#5925DC` text | active channel row ("My Meetings") |
| Brand light | `#7A5AF8`, `#EBE9FE`, `#D9D6FE` | focus rings, AI sparkles |
| Text | `#101828` (titles) · `#344054` (body) · `#475467` (secondary) · `#667085` (meta) · `#98A2B3` (placeholder) | everywhere |
| Surfaces | `#FFFFFF` content · `#FCFCFD` sidebar · `#F9FAFB` inputs/tiles · `#F2F4F7` active nav / hover | |
| Borders | `#EAECF0` (cards, dividers), `#D0D5DD` (inputs/buttons) | |
| Timestamp links | blue, underlined (`#155EEF`-ish) | transcript & notes `00:53` |
| Default avatar | `#5C6BC0` indigo square, white initial | meeting cards |
| Assignee pill | `#FEF3F2` bg, `#B42318` text | Tasks feed |
| Font | Inter-like geometric sans (homepage uses Inter / DM Sans) | |

- Generally a light, airy look: white canvas, 1px `#EAECF0` borders, `rounded-xl` cards, very soft shadows.
- Avatars are **rounded squares** (6px radius), not circles.
- Icons are thin line icons (Lucide-like, 1.5px stroke).
- The Home page has a soft gradient wash at the top: light blue at top-left, fading to peach/pink at top-right.
- A purple circular "?" help button floats at the bottom-right.

## 2. Global shell

**Expanded sidebar (~240px, bg `#FCFCFD`)**: Home, AskFred, Home and analytics pages.
- Top: workspace switcher (square avatar + name + chevron).
- Group 1: **Home**, **AskFred** (`NEW` green badge / `Ctrl+J`).
- Group 2: **Meetings**, **Tasks**, **AI Skills**.
- Group 3: **Analytics**, **Voice Agents**, **Upgrade** (`40% OFF` green pill).
- Bottom: "Try Email Assistant" card, **Integrations**, **Settings**, and an "Invite coworkers to your Fireflies team" card with a **Create Team** button.
- Active item: `#F2F4F7` rounded background with darker text.

**Collapsed icon rail (~56px) + channels panel (~300px)**: used on Meetings and Uploads.
- Channels panel:
  - "Search channels" input.
  - Default views: `# My Meetings`, `All Meetings`, `Voice Agent Meetings`, `Uploads`.
  - "All channels" header with a `+` button.
  - Channels listed as `# Public` or `🔒 Private`.

**Top bar (~64px, white, bottom border)**:
- Left: page title ("Home", "Meetings", "Tasks").
- Center: search box with "Search by title or keyword" and a `Ctrl + K` hint.
- Right:
  - "✨ Get AI credits" (outlined, glowing border).
  - Bell with a red dot.
  - "Invite" (soft purple).
  - **Capture** primary split button (video icon + chevron).

**Global search (Ctrl+K)**: a centered command-palette modal.
- An input with "Clear".
- A `Search "task"  · N results` row.
- A "Transcripts" group: avatar, meeting title, date on the right, snippet with the match highlighted in a grey box.
- Footer: "Ask Fred anything about your meetings" with a **Try AskFred** button.

## 3. Home
- "Good Evening, {name} 🌙" with a "Feedback" link.
- "✨ Personal Assistant" row with a toggle.
- Three cards:
  - **Daily Digest** ▶ Listen (OFF).
  - **Meeting Prep** (e.g. `IN 6 MINS` red tag / "1 upcoming meetings").
  - **Tasks** ("11 New tasks").
- "Connect Gmail" banner.
- Segmented tabs: **Recent | Upcoming · 1 | AI Feed**, with ⚙ Settings on the right.
- Recent list rows: square avatar, title, `Jul 23 · 5:19 PM`.
- A floating input at the bottom: "Ask anything here or press Ctrl + J for the full experience".
- First-run variant: a Welcome card with a video, and Quick Start cards (Schedule Meeting / Upload File / Capture Meeting).

## 4. Meetings (Notebook)

**Header row**:
- Segmented **Hosted by me | Shared with me**.
- **Filters** button.
- Search icon on the far right (local search).
- Channel views add `+ Add Meetings`, invite and `⋯`.

**Filters popover (two panes)**:
- Left list: Hosted by, Participants, Date Range, Duration, Captured From, Privacy.
- Right pane: search box and checkbox list, with "Clear all".
- Footer: "Clear All Filters".
- Options:
  - Date: Any Time, Today, Last 7 / 14 / 30 Days, Custom.
  - Duration: <15, 15–30, 30–60, 60–90, 90+ min.
  - Captured From: Notetaker, Chrome Extension, Mobile, Desktop, Uploads, Voice Agent.

**List**:
- Grouped by day: checkbox + "Tue, Jul 28" header, with "💬 Feedback" on the right of the first group.
- Each meeting is a bordered card (`rounded-xl`):
  - Indigo square avatar.
  - **Title ›** plus a capture-source icon (desktop / bot / chrome / upload).
  - Meta: `Jul 28 · 5:28 PM · 10 min · Host`.
  - A `# Channel` label below.
- Hover: grey background, `⋯` menu (Share, Copy Link, Download, Move to channel, Rename, **Delete** in red) and a **Details ›** button that opens the details panel.
- Bulk select: checkboxes per meeting, per day and "select all", with **Delete** and **Move** actions.
- End of list: "You've reached the end of your meetings."
- Right side: a collapsible AskFred panel ("Hi {name}! Get ready for your meeting", chips "My action items / Key decisions / Key initiatives", scope "# My Meetings").

**Uploads**:
- Dashed purple drop-zone (`#F4F3FF` bg): "Upload audio or video recordings", "Browse Files".
- The upload dialog has a language select, an editable date and an **Upload** button.
- "My Uploads" list: file-type badge (blue `MP4`), title, `Jun 22 · 4 min · 3.5 MB`.

## 5. Meeting page (Notepad)

The full-width layout replaces the app sidebar; a ☰ button opens it.

**Top bar**:
- Left: ☰, breadcrumb `#My Meetings / {title}`, `⋯` menu (Share, Copy Link, Regenerate notes `New`, Rename, Update Language, Meeting info, Download).
- Right:
  - Integrations dropdown (Slack / Google Docs / Notion / Monday.com, each with "Connect +").
  - "👁 1 View".
  - **Share** split button (globe + "Share" | link icon).
  - `+`, bell, avatar.

**Left icon rail** (each icon opens a ~330px side panel):
1. 🔍 **Smart Search**:
   - **AI FILTERS** tiles with colored dot and count: Metrics, Tasks, Questions, Date & Time.
   - **SENTIMENTS**: Positive / Neutral / Negative as %.
   - **SPEAKER TALKTIME** table: speaker, WPM, talk-time ring and %.
   - **TOPIC TRACKERS** with `+`.
2. 📑 **Index**: jump to summary sections and action items.
3. 🎙 **Soundbites**: "Clip out important moments", **Create Soundbite**, **AI Soundbite**.
4. 💬 **Comments**: timestamped comments and replies.
5. 🔖 **Bookmarks**: saved moments.

**Center: summary column** (max-width ~720px):
- Segmented **Notes | AI Skills · 4** and a fullscreen toggle.
- Big title and a **📹 Video** button.
- Meta: host avatar + name, `+1`, `Jul 20 2026, 4:51 PM`, `English (Global) ▾`.
- Toolbar: `✨ General Summary ▾` (template picker: General, Sales, 1:1, Team Meeting…), `Refine Summary`, copy icon, `✎ Edit`, `+ AI Apps`.
- Keywords as grey chips.
- **Overview**: bullets with nested sub-bullets; key numbers and names in **bold**.
- **Notes**: sections `🚀 Topic: 00:00 - 10:12` (or `Topic (00:00)` with a blue timestamp), bullets.
- **Action Items**: grouped by assignee name; each item ends with a blue timestamp link.
- **Outline / chapters**.
- A mini "index" scroll indicator on the right edge.

**Right panel: tabs Transcript | 🤖 AskFred** (+ edit ✎ and fullscreen):
- "Find or Replace" search (grey `#F9FAFB`).
- Transcript block: square colored initial avatar, **Name ▾**, `·`, blue underlined `00:53`, text below.
- The currently playing block gets a light-purple text highlight, and the current word is shown in pink.
- Hovering a line shows a toolbar: **Create Soundbite**, comment, bookmark, copy, link.
- A floating **^ Sync with audio** pill appears when the user scrolls away from the playhead.
- AskFred:
  - ✨ and "Hi {name}! Ask anything about this meeting".
  - "Try asking…" suggestion cards with colored sparkles.
  - Input: "Ask anything. Type / to run AI Skills".
  - Answers have copy / 👍 / 👎 actions.

**Bottom player bar (~64px)**:
- A thin purple progress line along the top edge.
- Left: `00:13 / 10:28`.
- Center: `1x` speed, ⟲ 15s back, purple pill ▶/⏸ (dark when playing), ⟳ 15s forward, download.
- Right: ☆, ☑ (create task), 👍, 👎.

## 6. Tasks
- Tabs: **My Tasks / All Tasks**.
- Banner: "Automatically send all your tasks to your work apps" with Asana/Monday/Trello/ClickUp icons and **Connect**.
- One card per meeting:
  - Header: avatar, meeting title, `Tue, Jul 28 · 4:47 PM`, `6 Tasks` and a collapse chevron.
  - Rows: 🗑 delete, checkbox, task text (click to edit inline, Enter saves), assignee pill + avatar ("Assign" when empty).
  - `+ New Task` at the bottom.

## 7. AskFred (global)
- Left panel: + New Chat, Search, Connectors, then **Recents** grouped by Today / Last 7 Days / Last 30 Days.
- Chat: user bubble on the right in grey; assistant text with a "Thought for 6s · 1 step" header; actions copy / 👍 / 👎 / ✨.
- Input: "Ask a follow-up question or anything…".

---

## 8. Decisions this research drives

### Backend changes
1. **Tags → Channels.** Fireflies organizes meetings into `#public` / `🔒private` **channels**.
   - Rename `tags` to `channels` (`name`, `description`, `is_private`, `color`) with an M:N `meeting_channels` table.
   - Add channel CRUD and a "move to channel" operation.
   - Channels also cover the bonus "tags/topics and filtering by them".
2. **Library filters** that mirror the Filters popover:
   - `host_id`, `participant_id[]`, `date_from` / `date_to`, `min_duration` / `max_duration`, `platform[]` (Captured From), `channel_id`.
   - `scope=mine|all` (Hosted by me vs. all).
   - The `uploads` view is `platform=upload`.
3. **Meeting fields**:
   - `language` ("English (Global)").
   - `source_filename` and `source_size_bytes` for the Uploads list (type badge + size).
4. **Bulk actions**: `POST /meetings/bulk` (delete / move).
5. **Smart Search**:
   - Add **sentiment** per segment (lexicon-based) to analytics: % plus segment ids.
   - Add **Topic Trackers**: a workspace table `topic_trackers(name, keywords[])`, with per-meeting counts and segment ids.
6. **Bookmarks** table (meeting, segment), for the 🔖 rail panel.
7. **AskFred suggestions**: `GET /meetings/{id}/chat/suggestions` (built from keywords and action items).
8. **Tasks**: `mine=true` filter (assigned to the current user's participant record), grouped by meeting on the client.

### Frontend structure
- **Pages**: `/` Home, `/meetings` Notebook (channels panel), `/meetings/[id]` Notepad, `/uploads`, `/tasks`, `/askfred`, and placeholders (Analytics, AI Skills, Voice Agents, Integrations, Team, Settings, Upgrade).
- **Shell**: the compact icon rail on every page (the avatar opens the full sidebar as a flyout); a channels panel next to it on Meetings and Uploads; no rail on the Notepad (hamburger drawer instead).
- **Notepad**: rail + panel, summary column, right Transcript/AskFred panel, bottom player. Wording, layout and colors follow sections 1 and 5.
- **"Coming soon" placeholders** (per the assignment):
  - Capture (live bot), Voice Agents, AI Skills / AI Apps, Integrations, Team/Invite, Get AI credits, Upgrade.
  - Video (no media), Daily Digest, Upcoming meetings (calendar), Share links.

## 9. Live-app comparison (October 2026)

After the clone was built, every page was compared side by side with the live app at `app.fireflies.ai`
(a free account, viewed read-only: nothing was changed, connected or sent). These differences were then matched:

| Area | Live Fireflies | Clone |
|---|---|---|
| Navigation | Compact 60px icon rail on **every** page (avatar · Home, AskFred · Meetings, Tasks, AI Skills · Analytics, Voice Agents · Upgrade with green dot · Invite, Integrations, Settings) | `IconRail` everywhere; clicking the avatar slides the full `Sidebar` out over the page (Esc, outside click, collapse button or navigation closes it) |
| Home | "Welcome Aboard, {name}!" card with product-demo video, **Quick Start** (Schedule Meeting · Upload File · Capture Meeting), Recent \| Upcoming \| AI Feed + Settings, **Try More** (Desktop App Download, Mobile App stores), floating "?" help | `HomeView` rebuilt to this layout; recent rows show "Thu, Oct 8 2026, 3:00 PM" |
| Global | Dismissible "You are eligible for 7 days business plan free trial · Start free trial →" strip | `TrialBanner` (dismissal remembered per browser) |
| Top bar | "3 Free meetings" counter + green **Upgrade**, bell, Capture ▾ | `PlanBadge` ("3 Free meetings" + Upgrade), bell, Capture ▾ |
| Meetings | Permanent right **Ask Fred** panel: "Hi Arvin! Get ready for your meeting", chips *My action items · Key decisions · Key initiatives*, "Connect Slack and Gmail" card, input scoped to `# My Meetings` | `LibraryAskFred` with the same chips, card and scope chip; answers come from `/api/askfred` |
| Meeting page | 4-icon rail (Smart Search, Soundbites, Comments, Bookmarks) with **Smart Search open**; right tabs **AskFred \| Transcript**; AskFred quick chips *Attendee Contributions · Todos*; "Ask anything. Type / to run AI Skills"; Upgrade in the top bar | Same rail (Index panel removed), Smart Search open ≥ 1280 px, same tab order, chips and placeholder; "Soundbite · 3" header with duration thumbnails; "All comments" / "All Bookmarks" with the live empty states |
| AskFred page | "Hi Arvin, how can I help today?", large composer (+, connectors, mic, send), "Bring context from 100+ apps with custom MCP + Add", five starters (action items this week, summarize last meeting, prepare for upcoming meeting, connect Gmail/Notion, weekly digest) | Same layout; each starter maps to a backend intent in `workspace_assistant.py`; connectors are placeholders |
| Tasks | My Tasks / All Tasks, work-apps strip, *Share Feedback* | Same, plus status filter |
| Upgrade | "You are on the **Free** plan", MONTHLY / ANNUAL (40% OFF) toggle, Free / Pro / Business (POPULAR) / Enterprise cards with "Everything in …, plus" lists | `PlansView` with the same structure; Upgrade → Coming soon |
| Settings | Personal / Team, many sections (recording, AI settings, MCP & API…) | Profile, Appearance, Notetaker, Channels, Topic Trackers, **Team** (coming soon), Billing, API |
| Not copied (outside the brief) | AI Skills builder, Voice Agents, Email Assistant, MCP & API, Knowledge Base | Present as navigation entries that open "Coming soon" |
| Analytics | Locked on the Free plan | Kept working (team/meeting analytics from the seeded data) |
