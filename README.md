# The Unnecessary Backstory

Every gift has a story. This one has too many drafts.

## How to run
Open `HomePage.html` in Google Chrome or Microsoft Edge (double-click it). No installation,
no server and no internet connection are needed: fonts and scripts are bundled in this folder.

Status of the build:

| Page | File | State |
|---|---|---|
| The Backstory (what the recipient sees) | `Backstory.html` | working, uses a built-in demo story |
| Home | `HomePage.html` | working |
| My Thoughts | `MyThoughts.html` | working: add, edit, delete with undo, attach and preview files |
| Curate | `Curate.html` | working: choose, reorder (buttons or drag), leave files out |
| Wrap It Up | `WrapItUp.html` | working: final message, preview, link; QR code needs a public address (see below) |

Quick tour: Home → Start a backstory → "Add example thoughts" → Curate (tick a few) → Wrap It Up → Preview.

## Sharing by QR code
A phone cannot open files on your computer, so a QR code only makes sense once the site is online.
Publish this folder (for example on GitHub Pages) and either open the online copy, or put its
address in `js/config.js` (`SITE_URL`). Until then Wrap It Up makes a link that opens on this
computer only, says so, and shows no QR code.

## Responsive strategy
The Backstory is mobile-first: it is opened by scanning a code on a physical gift.
The four authoring pages are built desktop-first and collapse to one column on small screens.
This is a development priority for the prototype, not a finding about where people write.

## The Backstory page
- Phone: a lock screen. A system notification offers to open the thoughts (Open / Maybe later).
  Thoughts then arrive one by one as notifications; opening one shows the whole thought on a sheet.
- Desktop: a notification centre on the left; delivered thoughts open as small windows on the right.
- Delivered thoughts can be moved around (phone: by the dotted grip on each notification; desktop: by the
  window's title bar). Each new thought lands on top of the earlier ones, overlapping them. Clicking or
  focusing a thought brings it to the front. Keyboard: focus a grip or title bar and use the arrow keys
  (Shift moves further), Enter brings it to the front. "Reset layout" puts everything back.
  Moving thoughts only changes where they sit on screen: the story order, Previous/Next and the
  share link are unchanged, and thoughts not yet delivered cannot be moved or opened.
- Previous and Next (buttons, or the left and right arrow keys) are the only things that move the story.
  Tapping text or scrolling never skips a thought.
- After the last thought the notifications clear and only the final message is left.
  "All thoughts" opens the notification history; "Read again" starts over.
- Thoughts are made of blocks (text, drawing, picture, file). Drawings have a written description
  for screen readers, shown under the drawing as "Description".

Where the story comes from:
- `Backstory.html` on its own shows the demo story.
- `Backstory.html?source=preview` shows the giver's own preview, saved in this browser.
- `Backstory.html#s=…` is a share link. Share links carry words only: pictures and files the giver
  added stay on their computer, and the page says so where one was left behind. Drawings that ship
  with the site (like the demo flowers) work everywhere.

## Folders
- `css/tokens.css` shared colours, type roles and spacing
- `js/story.js` the story format, demo story, share-link encoding
- `js/files.js` local file storage (IndexedDB)
- `js/assets.js` drawing slots that load files from `assets/drawings/`
- `assets/drawings/DRAWINGS-NEEDED.txt` the list of hand-drawn images to supply
- `fonts/` IBM Plex Sans, IBM Plex Mono, Caveat (SIL Open Font License)

## Known limits
- Built and tested for Chrome and Edge. Firefox treats files opened from disk differently,
  so saved drafts may not carry between pages there.
- No AI-generated images are used. Every illustration is hand-drawn or photographed by the author.
