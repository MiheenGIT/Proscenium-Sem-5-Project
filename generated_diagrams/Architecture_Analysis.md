# Proscenium: Reverse-Engineered System Architecture & Engineering Analysis

**Project Title:** Proscenium (Sem 5 Independent Film Platform)  
**Document Generated:** October 2026  
**Methodology:** Direct Static Repository Analysis & Execution Flow Reconstruction  
**Output Directory:** `generated_diagrams/`

---

## 1. Executive Summary & Technology Stack

Proscenium is a full-stack, cloud-integrated independent cinema streaming, curation, and analytics platform. It facilitates the end-to-end lifecycle of independent cinema: filmmaker registration and video submission, automated AI super-resolution upscaling, multi-rendition HLS transcoding, administrative content moderation, adaptive HLS video streaming, social engagement (reviews, comments, reactions), and multi-channel notification and telemetry tracking.

### Core Technology Stack

| Layer | Technologies & Libraries | Architectural Role |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, React Router DOM v6, Axios, Lucide React, Hls.js, Tailwind CSS | Single Page Application (SPA), role-based view routing, custom responsive UI, adaptive streaming player, client telemetry tracking. |
| **Backend** | Python 3.11, FastAPI, Starlette, Uvicorn, Pydantic v2 | High-performance asynchronous REST API, multipart form ingestion, role-based JWT authentication, rate limiting, and background workers. |
| **Database** | MongoDB Atlas / Community, PyMongo, Certifi | Document-oriented data store utilizing 19 distinct collections, schema-free metadata storage with compound indexes and sparse deduplication keys. |
| **Media Processing** | FFmpeg, FFprobe, Docker (`miratmu/ffmpeg-tensorflow`), Intel OpenVINO (IR model) | Video duration and resolution probing, automated frame extraction for posters, 2x/4x ESPCN super-resolution upscaling, multi-rendition HLS ladder generation. |
| **Cloud Storage** | Cloudinary Python SDK (`cloudinary.uploader`) | Distributed CDN for poster thumbnails, cast headshots, director/viewer/admin avatars, HLS `.ts` video segment chunks, and `.m3u8` manifests. |
| **Notification Engine** | Python `smtplib`, `email.message.EmailMessage`, SSL | Branded HTML email notifications with plain-text fallbacks via Gmail SMTP (SSL 465) and asynchronous FastAPI `BackgroundTasks`. |
| **Security & Auth** | Bcrypt, PyJWT (HS256), HTTPBearer | Password salt-hashing, stateless JWT Bearer token generation, route dependency guards (`require_role`), and account suspension checks. |

---

## 2. Repository Structure Analysis

```text
C:\Users\mihee\Desktop\Sem-5 Project\
├── backend/
│   ├── app/
│   │   ├── config/
│   │   │   └── cloudinary_config.py       # Cloudinary SDK credentials configuration
│   │   ├── routes/
│   │   │   ├── admin.py                   # Moderation, curation, bulk approval, director governance
│   │   │   ├── analytics.py               # Platform intelligence, engagement metrics, event logging
│   │   │   ├── auth.py                    # Multi-role registration, login, account deletion cascades
│   │   │   ├── director.py                # Video upload, ESPCN upscaling, HLS ladder, cast, bio
│   │   │   ├── notifications.py           # User-scoped notification queries and read-status management
│   │   │   └── viewer.py                  # Catalog, search, HLS watch, heartbeats, reviews, comments
│   │   └── main.py                        # FastAPI application entrypoint, CORS, telemetry registration
│   ├── database.py                        # PyMongo client initialization and collection definitions (19 collections)
│   ├── models/
│   │   ├── schemas.py                     # Pydantic validation models and request bodies
│   │   ├── single-image-super-resolution-1032.bin # Intel OpenVINO IR model weights
│   │   └── single-image-super-resolution-1032.xml # Intel OpenVINO IR network topology
│   ├── utils/
│   │   ├── AIhelpers.py                   # Dockerized FFmpeg-TensorFlow ESPCN 2x/4x upscaler
│   │   ├── api_telemetry.py               # Middleware timing and request metrics collector
│   │   ├── backfill_analytics_data.py     # Database seeding and historical data backfill utility
│   │   ├── backfill_moderation.py         # Moderation status migration script
│   │   ├── cloudinary_helpers.py          # Asset upload, headshot processing, asset purging
│   │   ├── email_service.py               # Branded HTML email layout and SMTP transport engine
│   │   ├── moderation.py                  # Deterministic multilingual text safety & profanity filter
│   │   ├── notifications.py               # In-app notification creation, deduplication & event triggers
│   │   ├── rate_limit.py                  # Sliding window IP-based rate limiter
│   │   ├── security.py                    # Password hashing, JWT token encoding/decoding, role dependencies
│   │   └── video_trimmer.py               # FFmpeg-based video extraction and clipping utility
│   └── requirements.txt                   # Backend dependencies
├── ffmpeg-tensorflow/                     # Docker build recipes and scripts for custom FFmpeg+TensorFlow
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js                  # Axios interceptors, JWT attachment, standardized error handling
│   │   ├── components/
│   │   │   ├── admin/                     # Admin sidebar, topbar, video player
│   │   │   ├── Dashboard/                 # Viewer catalog banners, movie rows, cards, search overlays
│   │   │   ├── notifications/             # Notification bell and unread badge component
│   │   │   ├── CustomSelect.jsx           # Styled custom dropdown selector component
│   │   │   ├── DirectorNav.jsx            # Director navigation header
│   │   │   ├── RequireRole.jsx            # Client-side route authorization guard
│   │   │   └── ViewerNav.jsx              # Viewer application navigation bar
│   │   ├── context/
│   │   │   └── AuthContext.jsx            # React Authentication context provider
│   │   ├── pages/
│   │   │   ├── Admin-panel/               # Content, Review, Comments, Tags, Dashboard
│   │   │   ├── Analytics/                 # Analytics dashboards for Admin, Director, Viewer
│   │   │   ├── Auth-panel/                # Login and multi-role registration forms
│   │   │   ├── Director-panel/            # Director home, video uploader, editor, profile
│   │   │   ├── Viewer-panel/              # Catalog home, movie detail, watch player, library, reviews
│   │   │   └── Shared/                    # Cross-role notifications page
│   │   ├── App.jsx                        # React Router DOM v6 route hierarchy and redirects
│   │   └── main.jsx                       # React DOM root bootstrapping
│   ├── package.json                       # Frontend dependencies and Vite build scripts
│   └── vite.config.js                     # Vite build configuration
└── generated_diagrams/                    # Output documentation directory containing MMD & MD files
```

---

## 3. Entity Relationship & Data Model (MongoDB)

Proscenium uses MongoDB as its primary datastore (`proscenium` database). The data model uses document referencing (`ObjectId`) combined with targeted embedding for high-read performance (such as embedded moderation audit results, recent watch summaries, and moderation history).

### 3.1 MongoDB Collections Catalog

The system defines **19 distinct collections** in `backend/database.py`:

```python
viewers_collection = db["viewers_collection"]
directors_collection = db["directors_collection"]
admin_collection = db["admin_collection"]
film_collection = db["film_collection"]
video_views_collection = db["video_views"]
watch_sessions_collection = db["watch_sessions"]
watch_history_collection = db["watch_history"]
watchlist_collection = db["watchlist"]
comments_collection = db["comments_collection"]
video_reactions_collection = db["video_reactions"]
comment_reactions_collection = db["comment_reactions"]
video_reviews_collection = db["video_reviews"]
review_reactions_collection = db["review_reactions"]
cast_collection = db["cast"]
viewer_settings_collection = db["viewer_settings"]
notifications_collection = db["notifications"]
account_deletions_collection = db["account_deletions"]
analytics_events_collection = db["analytics_events"]
watch_log_collection = db["watch_session_log"]
```

### 3.2 Collection Specifications & Schemas

#### 1. `viewers_collection`
* **Purpose:** Consumer profile, authentication credentials, and preferences.
* **Fields:**
  * `_id` (`ObjectId`, PK): Unique viewer identity.
  * `username` (`str`): Unique viewer handle (3-30 chars).
  * `email` (`str`): Unique email address across all role collections.
  * `passwordHash` (`str`): Bcrypt salted hash.
  * `date_of_birth` (`datetime`): Birthdate for maturity evaluation.
  * `role` (`str`): Fixed to `"viewer"`.
  * `avatarUrl` (`str | None`): Cloudinary URL for profile headshot.
  * `bio` (`str | None`): Biography text.
  * `isBanned` (`bool`): Account ban state.
  * `banReason` (`str | None`), `bannedAt` (`datetime | None`), `bannedBy` (`ObjectId | None`).
  * `isVerifiedEmail` (`bool`): Verification flag.
  * `loginCount` (`int`): Successful login counter.
  * `genrePreferences` (`list[str]`), `languagePreferences` (`list[str]`).
  * `maturitySetting` (`str`): `"all"` or `"mature"`.
  * `gender` (`str | None`): Demographic attribute.
  * `recentWatched` (`list[dict]`): Embedded bounded list of recently watched films.
  * `createdAt` (`datetime`), `updatedAt` (`datetime`).

#### 2. `directors_collection`
* **Purpose:** Filmmaker credentials, creative identity, studio information, and governance status.
* **Fields:**
  * `_id` (`ObjectId`, PK): Unique filmmaker identity.
  * `username` (`str`): Unique director handle.
  * `email` (`str`): Unique email address.
  * `passwordHash` (`str`): Bcrypt hash.
  * `date_of_birth` (`datetime`).
  * `role` (`str`): Fixed to `"director"`.
  * `avatarUrl` (`str | None`), `bio` (`str | None`).
  * `studioName` (`str | None`), `portfolioUrl` (`str | None`).
  * `accountStatus` (`str`): `"active"` or `"suspended"`.
  * `suspendedReason` (`str | None`), `suspendedAt` (`datetime | None`), `suspendedBy` (`ObjectId | None`).
  * `isBanned` (`bool`): Ban status flag.
  * `verificationStatus` (`str`): `"pending" | "verified" | "rejected"`.
  * `uploadsCount` (`int`): Count of submitted films.
  * `loginCount` (`int`).
  * `createdAt` (`datetime`), `updatedAt` (`datetime`).

#### 3. `admin_collection`
* **Purpose:** Platform curators and operational administrators.
* **Fields:**
  * `_id` (`ObjectId`, PK): Unique admin identity.
  * `username` (`str`), `email` (`str`), `passwordHash` (`str`).
  * `role` (`str`): Fixed to `"admin"`.
  * `adminLevel` (`str`): `"moderator"` or `"superadmin"`.
  * `avatarUrl` (`str | None`), `bio` (`str | None`), `loginCount` (`int`).
  * `createdAt` (`datetime`), `updatedAt` (`datetime`).

#### 4. `film_collection`
* **Purpose:** Core catalog document containing complete metadata, media URLs, curation status, and engagement counters.
* **Fields:**
  * `_id` (`ObjectId`, PK): Unique film identifier.
  * `directorId` (`ObjectId`, FK -> `directors_collection`): Owner filmmaker.
  * `title` (`str`), `slug` (`str`), `description` (`str`).
  * `genres` (`list[str]`), `tags` (`list[str]`), `language` (`str`), `subtitles` (`list`).
  * `durationSec` (`float`): Precise video duration via FFprobe.
  * `cast` (`list[ObjectId]`, FK -> `cast_collection`): Array of cast document IDs.
  * `thumbnailUrl` (`str`): Cloudinary poster image URL.
  * `hlsManifestUrl` (`str`): Cloudinary URL for `master.m3u8`.
  * `rawFileUrl` (`str`): Original video storage URL if preserved.
  * `resolutions` (`list[str]`): Generated resolutions (e.g. `["360p", "480p", "720p", "1080p"]`).
  * `fileSizeBytes` (`int`), `mimeType` (`str`).
  * `status` (`str`): `"ready" | "processing" | "failed"`.
  * `visibility` (`str`): `"private"` (during review) or `"public"` (post-approval).
  * `ageRestricted` (`bool`): Maturity gating flag.
  * `contentWarnings` (`list[str]`): Specific warning descriptors.
  * `moderationStatus` (`str`): `"pending" | "approved" | "rejected"`.
  * `moderationComment` (`str | None`): Admin rejection rationale or feedback note.
  * `moderatedBy` (`ObjectId | None`, FK -> `admin_collection`), `moderatedAt` (`datetime | None`).
  * `moderationHistory` (`list[dict]`): Embedded audit log of moderation state transitions.
  * `adminNotes` (`list[dict]`): Private curator remarks (hidden from directors).
  * `views` (`int`), `uniqueViews` (`int`), `likes` (`int`), `dislikes` (`int`).
  * `avgRating` (`float`), `reviewCount` (`int`), `commentCount` (`int`).
  * `releaseYear` (`int | None`), `productionCountry` (`str`), `isFeatured` (`bool`).
  * `uploadedAt` (`datetime`), `publishedAt` (`datetime | None`), `updatedAt` (`datetime`).

#### 5. `cast_collection`
* **Purpose:** Cast and crew credits linked to specific films.
* **Fields:**
  * `_id` (`ObjectId`, PK).
  * `videoId` (`ObjectId`, FK -> `film_collection`): Film association.
  * `name` (`str`): Actor / performer name.
  * `characterName` (`str`): Role name.
  * `photoUrl` (`str | None`): Cloudinary image URL.
  * `createdAt` (`datetime`), `updatedAt` (`datetime`).

#### 6. `watch_sessions_collection` & `watch_log_collection`
* **Purpose:** Real-time playback heartbeats, anti-drift duration accounting, and append-only play logging.
* **`watch_sessions` Fields:**
  * `_id` (`ObjectId`, PK).
  * `videoId` (`ObjectId`, FK -> `film_collection`), `viewerId` (`ObjectId`, FK -> `viewers_collection`).
  * `accumulatedSeconds` (`float`): Verified active seconds watched.
  * `lastHeartbeatAt` (`datetime`), `lastReportedTimeSec` (`float`).
  * `counted` (`bool`): Whether the 75% qualified view threshold was reached.
  * `logId` (`ObjectId`, FK -> `watch_log_collection`).
* **`watch_session_log` Fields:**
  * `_id` (`ObjectId`, PK), `viewerId` (`ObjectId`), `videoId` (`ObjectId`).
  * `startedAt` (`datetime`), `lastHeartbeatAt` (`datetime`), `accumulatedSeconds` (`float`).

#### 7. `watch_history_collection` & `video_views_collection`
* **Purpose:** Resume playhead persistence and unique view deduplication.
* **`watch_history` Fields:**
  * `_id` (`ObjectId`, PK), `viewerId` (`ObjectId`), `videoId` (`ObjectId`).
  * `currentTimeSec` (`float`): Resume position in seconds.
  * `durationSec` (`float`), `progress` (`float`), `completed` (`bool` >= 95%).
  * `timesWatched` (`int`), `startedAt` (`datetime`), `lastWatchedAt` (`datetime`).
* **`video_views` Fields:**
  * `_id` (`ObjectId`, PK), `videoId` (`ObjectId`), `viewerId` (`ObjectId`).
  * `firstWatchedAt` (`datetime`).
  * Index: Unique compound index on `(videoId, viewerId)`.

#### 8. `comments_collection` & `comment_reactions_collection`
* **Purpose:** Moderated community commentary and comment upvotes/downvotes.
* **`comments_collection` Fields:**
  * `_id` (`ObjectId`, PK), `videoId` (`ObjectId`), `viewerId` (`ObjectId | None`).
  * `username` (`str`), `avatarUrl` (`str | None`), `text` (`str`).
  * `parentId` (`ObjectId | None`, FK -> `comments_collection`): Threaded reply pointer.
  * `likeCount` (`int`), `dislikeCount` (`int`), `flagged` (`bool`).
  * `moderation` (`dict`): Embedded report (`categories`, `matchedTerms`, `severity`, `languages`).
  * `adminRemoved` (`bool`): Soft-delete flag by moderator.
  * `createdAt` (`datetime`), `updatedAt` (`datetime`).
* **`comment_reactions` Fields:**
  * `_id` (`ObjectId`, PK), `commentId` (`ObjectId`), `viewerId` (`ObjectId`).
  * `type` (`str`): `"like"` or `"dislike"`.

#### 9. `video_reviews_collection` & `review_reactions_collection`
* **Purpose:** 1.0 - 5.0 star editorial ratings, written reviews, and helpfulness likes.
* **`video_reviews` Fields:**
  * `_id` (`ObjectId`, PK), `videoId` (`ObjectId`), `viewerId` (`ObjectId | None`).
  * `username` (`str`), `avatarUrl` (`str | None`), `rating` (`float` 1.0-5.0), `text` (`str`).
  * `likeCount` (`int`), `flagged` (`bool`), `moderation` (`dict`), `adminRemoved` (`bool`).
  * `createdAt` (`datetime`), `updatedAt` (`datetime`).
* **`review_reactions` Fields:**
  * `_id` (`ObjectId`, PK), `reviewId` (`ObjectId`), `viewerId` (`ObjectId`).

#### 10. `notifications_collection`
* **Purpose:** Polymorphic notification delivery and unread status tracking across all three user roles.
* **Fields:**
  * `_id` (`ObjectId`, PK).
  * `recipientRole` (`str`): `"viewer" | "director" | "admin"`.
  * `recipientId` (`ObjectId`): Target user ID.
  * `viewerId` (`ObjectId`): Legacy field retained for viewer compatibility.
  * `type` (`str`): Event category descriptor.
  * `title` (`str`), `message` (`str`).
  * `actorId` (`ObjectId | None`): User whose action initiated the notification.
  * `videoId` (`ObjectId | None`), `commentId` (`ObjectId | None`), `reviewId` (`ObjectId | None`).
  * `link` (`str | None`): Deep-link navigation URL.
  * `meta` (`dict`): Flexible context payload.
  * `read` (`bool`), `readAt` (`datetime | None`).
  * `dedupeKey` (`str | None`): Unique sparse index preventing duplicate alert dispatch.
  * `createdAt` (`datetime`).

#### 11. `account_deletions_collection` & `analytics_events_collection`
* **`account_deletions` Fields:** `_id`, `role`, `reason`, `details`, `daysMember`, `createdAt`.
* **`analytics_events` Fields:** `_id`, `eventName`, `eventCategory`, `sessionId`, `userRole`, `properties`, `path`, `ipHash`, `timestamp`.

---

## 4. Architectural Data Flows (DFD Analysis)

### 4.1 Level 0: System Context
The Level 0 diagram (`DFD_Level_0.mmd`) isolates Process 0 (`Proscenium Streaming & Curation System`) using the standard academic Context Diagram model (matching the left-to-right entity hub layout):
1. **Left-Side Human Actors / External Entities:**
   * **Viewer**: Sends search/browse queries, playback heartbeats, ratings, reviews, and comments; receives catalog feeds, stream URLs, and recommendations.
   * **Director**: Transmits `.mp4` video uploads, metadata, cast details, re-uploaded media, and authentication credentials; receives moderation status and feedback.
   * **Administrator**: Sends moderation decisions (approve/reject) and user governance actions; receives pending review queues and preview video streams.
2. **Right-Side External Sinks, Services & Targets:**
   * **System Display**: Renders catalog data, film details, and adaptive HLS video streams on client viewports.
   * **Report**: Receives aggregated daily watch metrics, viewer retention statistics, and administrative audit trails.
   * **Cloud Storage & CDN (Cloudinary)**: Receives uploaded HLS `.ts` segments, thumbnails, and playlists; delivers high-speed CDN media URLs.
   * **Email Service (Gmail SMTP)**: Receives automated email dispatch instructions for moderation decisions, re-upload alerts, and announcements.
   * **Transcoding Engine (OpenVINO / Docker FFmpeg)**: Receives raw media transcoding requests; returns multi-rendition HLS playlists and posters.

### 4.2 Level 1: Major System Processes
The Level 1 diagram (`DFD_Level_1.mmd`) decomposes the system into seven primary functional processes:
* **Process 1.0 (Authentication & Identity):** Governs multi-role registration, bcrypt hashing, JWT issuance, profile updates, and cascade deletion routines.
* **Process 2.0 (Video Ingestion & AI Processing):** Manages multipart upload parsing, FFprobe media analysis, cast photo uploads, poster generation, ESPCN 2x/4x super-resolution, FFmpeg multi-bitrate HLS transcoding, Cloudinary asset publishing, and pending document creation.
* **Process 3.0 (Administrative Curation & Content Moderation):** Governs review queues, video stream verification, approval/rejection decisions, internal admin notes, curation metadata flags, director account suspension, and feedback suppression.
* **Process 4.0 (Catalog Discovery, Streaming & Playback):** Evaluates user maturity preferences, delivers HLS manifests, validates heartbeat playback deltas against wall-clock drift, credits continuous watch duration, gates 75% qualified views, and updates resume history.
* **Process 5.0 (Social Engagement & Moderated Feedback):** Captures threaded comments, reviews, reactions, calculates dynamic video averages (`avgRating`), and executes deterministic multilingual safety checks across 26 languages.
* **Process 6.0 (Multi-Channel Notification & Messaging Engine):** Dispatches in-app notifications with deduplication enforcement and triggers asynchronous SMTP email broadcasts.
* **Process 7.0 (Platform Telemetry & Analytics Aggregation):** Collects client telemetry events, processes API telemetry middleware timings, and aggregates business metrics for viewers, directors, and administrators.

### 4.3 Level 2: Video Lifecycle Workflow
The Level 2 Video Workflow diagram (`DFD_Level_2_Video_Workflow.mmd`) maps the life of a video through four distinct stages:
1. **Ingestion & Metadata:** Multipart upload handling, cast member association, headshot upload to Cloudinary, and thumbnail generation.
2. **AI Enhancement & Transcoding Pipeline:**
   * Conditional check: If video height is `< 1080p` and `use_upscale == True`, the system invokes `miratmu/ffmpeg-tensorflow` Docker image.
   * Inside Docker, the video's YUV planes are split (`extractplanes=y+u+v`). The luma (`Y`) plane is processed through the ESPCN TensorFlow graph (`/models/espcn.pb`, `scale_factor=2`), while chroma (`U`, `V`) planes are lanczos-scaled. The planes are merged (`mergeplanes=0x001020:yuv420p`) and encoded to x264/AAC.
   * Resolution ladder calculation: HLS target renditions are selected from the ladder (`360p` up to `2160p`) if `rendition_height <= input_height * 1.2`.
   * For each rendition, FFmpeg outputs 6-second `.ts` segments and an index playlist (`index_{label}.m3u8`).
   * Media files are uploaded to Cloudinary folder `proscenium/{video_id}/{label}/`. The index playlist is rewritten with Cloudinary URLs and uploaded.
   * A master playlist (`master.m3u8`) is generated pointing to all index variants and uploaded as a raw Cloudinary asset.
   * Temporary directories (`media/{video_id}`) are purged in a `finally:` block.
   * The film document is saved to MongoDB with `status: "ready"`, `moderationStatus: "pending"`, and `visibility: "private"`.
3. **Curation Decision & Audience Broadcast:**
   * Admin previews the film via `/admin/videos/{id}/watch`.
   * If rejected, `moderationStatus` becomes `"rejected"`, the film remains `"private"`, the rejection reason is saved to `moderationHistory`, and the director is notified via in-app alert and SMTP email.
   * If approved, `moderationStatus` becomes `"approved"`, `visibility` becomes `"public"`, `publishedAt` is set, the director is notified, and a background task queries all opted-in viewers (`newReleaseNotifications != False, emailNotifications != False`) to queue in-app alerts and batch emails.
4. **Streaming & View Qualification Gate:**
   * Viewer requests stream via `GET /videos/{id}/watch`.
   * An active watch session (`watch_sessions`) and append-only log record (`watch_session_log`) are initialized.
   * Client streams HLS segments via `Hls.js` from Cloudinary CDN.
   * Client sends periodic heartbeats (`POST /videos/{id}/heartbeat`, `currentTimeSec`).
   * Anti-drift verification: Calculates `wall_clock_gap = now - lastHeartbeatAt` (capped at 15s). Compares with `reported_advance`. If `drift <= 5s`, the gap is credited to `accumulatedSeconds`.
   * **75% Qualified View Gate:** When `accumulatedSeconds / durationSec >= 0.75`:
     * Inserts record into `video_views` (`videoId`, `viewerId`, `firstWatchedAt`).
     * If unique (first time), increments `views` and `uniqueViews` on `film_collection`. If duplicate key, increments only `views`.
     * Checks viewing milestones (10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000); if matched, dispatches a milestone notification to the director.

### 4.4 Level 2: Notification & Messaging Engine
The Level 2 Notification diagram (`DFD_Level_2_Notifications.mmd`) details the event-driven notification flow:
* **Event Sources:** Video submissions, re-uploads, resubmissions, administrative decisions, suspensions, comments, replies, reviews, likes, and view milestones.
* **In-App Processing:** Evaluates whether `actor_id == recipient_id` (suppressing self-notifications). Applies `dedupeKey` constraints (e.g. `comment_like:{commentId}:{actorId}` or `view_milestone:{videoId}:{views}`). Writes unread notifications to `notifications_collection`.
* **Email Processing:** Handled via FastAPI `BackgroundTasks`. Uses `_layout` to build branded responsive HTML templates with Proscenium color schemes (Gold `#e8b04b`, Dark `#0b0b10`), custom status badges, poster thumbnails, admin feedback quote boxes, and call-to-action buttons. Dispatches via `smtplib.SMTP_SSL` to `smtp.gmail.com:465`.

---

## 5. Frontend-to-Backend Route Traceability Matrix

The following table traces every primary user interface route and client call to its corresponding backend API endpoint, HTTP method, and backend controller function:

| Frontend Page / Component | Client Request Call (`client.js`) | HTTP Verb | Backend Route Path | Backend Controller Function | File Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Login.jsx` | `postJson("/auth/login", ...)` | POST | `/auth/login` | `login` | `backend/app/routes/auth.py` |
| `Register.jsx` (Viewer) | `postForm("/auth/register/viewer", ...)` | POST | `/auth/register/viewer` | `register_viewer` | `backend/app/routes/auth.py` |
| `Register.jsx` (Director) | `postForm("/auth/register/creator", ...)` | POST | `/auth/register/creator` | `register_creator` | `backend/app/routes/auth.py` |
| `Register.jsx` (Admin) | `postForm("/auth/register/admin", ...)` | POST | `/auth/register/admin` | `register_admin` | `backend/app/routes/auth.py` |
| `AccountPages.jsx` | `deleteRequest("/auth/account", ...)` | DELETE | `/auth/account` | `delete_account` | `backend/app/routes/auth.py` |
| `UploadVideo.jsx` | `postForm("/directors/upload-video", ...)` | POST | `/directors/upload-video` | `upload_vid` | `backend/app/routes/director.py` |
| `EditVideo.jsx` (Save Meta) | `putForm("/directors/videos/{id}", ...)` | PUT | `/directors/videos/{video_id}` | `update_video_metadata` | `backend/app/routes/director.py` |
| `EditVideo.jsx` (Re-upload) | `postForm("/directors/videos/{id}/reupload", ...)` | POST | `/directors/videos/{video_id}/reupload` | `reupload_video` | `backend/app/routes/director.py` |
| `EditVideo.jsx` (Resubmit) | `postEmpty("/directors/videos/{id}/resubmit")` | POST | `/directors/videos/{video_id}/resubmit` | `resubmit_video` | `backend/app/routes/director.py` |
| `DirectorHome.jsx` | `getRequest("/directors/videos")` | GET | `/directors/videos` | `get_my_videos` | `backend/app/routes/director.py` |
| `DirectorProfile.jsx` | `putJson("/directors/profile/bio", ...)` | PUT | `/directors/profile/bio` | `update_bio` | `backend/app/routes/director.py` |
| `DirectorProfile.jsx` | `putForm("/directors/profile/avatar", ...)` | PUT | `/directors/profile/avatar` | `update_avatar` | `backend/app/routes/director.py` |
| `Admin-panel/Content.jsx` | `getRequest("/admin/videos")` | GET | `/admin/videos` | `list_admin_videos` | `backend/app/routes/admin.py` |
| `Admin-panel/Review.jsx` | `getRequest("/admin/videos/{id}")` | GET | `/admin/videos/{video_id}` | `get_admin_video_detail` | `backend/app/routes/admin.py` |
| `Admin-panel/Review.jsx` | `getRequest("/admin/videos/{id}/watch")` | GET | `/admin/videos/{video_id}/watch` | `admin_watch_video` | `backend/app/routes/admin.py` |
| `Admin-panel/Review.jsx` | `postJson("/admin/videos/{id}/approve", ...)` | POST | `/admin/videos/{video_id}/approve` | `approve_video` | `backend/app/routes/admin.py` |
| `Admin-panel/Review.jsx` | `postJson("/admin/videos/{id}/reject", ...)` | POST | `/admin/videos/{video_id}/reject` | `reject_video` | `backend/app/routes/admin.py` |
| `Admin-panel/Review.jsx` | `postEmpty("/admin/videos/{id}/reset")` | POST | `/admin/videos/{video_id}/reset` | `reset_video_moderation` | `backend/app/routes/admin.py` |
| `Admin-panel/Review.jsx` | `postJson("/admin/videos/{id}/age-restriction", ...)` | POST | `/admin/videos/{video_id}/age-restriction` | `set_age_restriction` | `backend/app/routes/admin.py` |
| `Admin-panel/Review.jsx` | `putJson("/admin/videos/{id}/content-warnings", ...)` | PUT | `/admin/videos/{video_id}/content-warnings` | `set_content_warnings` | `backend/app/routes/admin.py` |
| `Admin-panel/Review.jsx` | `postJson("/admin/videos/{id}/featured", ...)` | POST | `/admin/videos/{video_id}/featured` | `toggle_featured` | `backend/app/routes/admin.py` |
| `Admin-panel/Review.jsx` | `postJson("/admin/videos/{id}/notes", ...)` | POST | `/admin/videos/{video_id}/notes` | `add_admin_note` | `backend/app/routes/admin.py` |
| `Admin-panel/Content.jsx` | `postJson("/admin/videos/bulk-approve", ...)` | POST | `/admin/videos/bulk-approve` | `bulk_approve_videos` | `backend/app/routes/admin.py` |
| `Admin-panel/Content.jsx` | `postJson("/admin/videos/bulk-reject", ...)` | POST | `/admin/videos/bulk-reject` | `bulk_reject_videos` | `backend/app/routes/admin.py` |
| `Admin-panel/Comments.jsx` | `getRequest("/admin/comments")` | GET | `/admin/comments` | `admin_list_comments` | `backend/app/routes/admin.py` |
| `Admin-panel/Comments.jsx` | `postEmpty("/admin/comments/{id}/remove")` | POST | `/admin/comments/{comment_id}/remove` | `admin_remove_comment` | `backend/app/routes/admin.py` |
| `Admin-panel/Comments.jsx` | `postEmpty("/admin/comments/{id}/restore")` | POST | `/admin/comments/{comment_id}/restore` | `admin_restore_comment` | `backend/app/routes/admin.py` |
| `Viewer-panel/Dashboard.jsx`| `getRequest("/viewer/videos")` | GET | `/viewer/videos` | `list_videos` | `backend/app/routes/viewer.py` |
| `Dashboard/SearchOverlay.jsx`| `getRequest("/viewer/videos/search")` | GET | `/viewer/videos/search` | `search_videos` | `backend/app/routes/viewer.py` |
| `Viewer-panel/MovieDetail.jsx`| `getRequest("/viewer/videos/{id}")` | GET | `/viewer/videos/{video_id}` | `get_video_detail` | `backend/app/routes/viewer.py` |
| `Viewer-panel/WatchVideo.jsx`| `getRequest("/viewer/videos/{id}/watch")` | GET | `/viewer/videos/{video_id}/watch` | `watch_video` | `backend/app/routes/viewer.py` |
| `Viewer-panel/WatchVideo.jsx`| `postJson("/viewer/videos/{id}/heartbeat", ...)` | POST | `/viewer/videos/{video_id}/heartbeat` | `watch_heartbeat` | `backend/app/routes/viewer.py` |
| `WatchSidePanel.jsx` | `postJson("/viewer/videos/{id}/comments", ...)` | POST | `/viewer/videos/{video_id}/comments` | `post_comment` | `backend/app/routes/viewer.py` |
| `WatchSidePanel.jsx` | `postJson("/viewer/videos/{id}/comments/{cid}/reply", ...)` | POST | `/viewer/videos/{video_id}/comments/{comment_id}/reply` | `reply_to_comment` | `backend/app/routes/viewer.py` |
| `WatchSidePanel.jsx` | `postJson("/viewer/videos/{id}/comments/{cid}/react", ...)` | POST | `/viewer/videos/{video_id}/comments/{comment_id}/react` | `react_to_comment` | `backend/app/routes/viewer.py` |
| `Viewer-panel/Reviews.jsx` | `postJson("/viewer/videos/{id}/reviews", ...)` | POST | `/viewer/videos/{video_id}/reviews` | `post_review` | `backend/app/routes/viewer.py` |
| `Viewer-panel/Reviews.jsx` | `postEmpty("/viewer/videos/{id}/reviews/{rid}/like")` | POST | `/viewer/videos/{video_id}/reviews/{review_id}/like` | `like_review` | `backend/app/routes/viewer.py` |
| `LibraryPage.jsx` | `getRequest("/viewer/watchlist")` | GET | `/viewer/watchlist` | `get_watchlist` | `backend/app/routes/viewer.py` |
| `MovieCard.jsx` | `postEmpty("/viewer/videos/{id}/watchlist")` | POST | `/viewer/videos/{video_id}/watchlist` | `toggle_watchlist` | `backend/app/routes/viewer.py` |
| `Viewer-panel/History.jsx` | `getRequest("/viewer/history")` | GET | `/viewer/history` | `get_watch_history` | `backend/app/routes/viewer.py` |
| `Viewer-panel/History.jsx` | `deleteRequest("/viewer/history/{id}")` | DELETE | `/viewer/history/{video_id}` | `delete_history_item` | `backend/app/routes/viewer.py` |
| `Viewer-panel/History.jsx` | `deleteRequest("/viewer/history")` | DELETE | `/viewer/history` | `clear_watch_history` | `backend/app/routes/viewer.py` |
| `AccountPages.jsx` (Settings)| `getRequest("/viewer/settings")` | GET | `/viewer/settings` | `get_viewer_settings` | `backend/app/routes/viewer.py` |
| `AccountPages.jsx` (Settings)| `putJson("/viewer/settings", ...)` | PUT | `/viewer/settings` | `update_viewer_settings` | `backend/app/routes/viewer.py` |
| `NotificationsPage.jsx` | `getRequest("/notifications")` | GET | `/notifications` | `list_notifications` | `backend/app/routes/notifications.py` |
| `NotificationBell.jsx` | `getRequest("/notifications/unread-count")` | GET | `/notifications/unread-count` | `unread_count` | `backend/app/routes/notifications.py` |
| `NotificationsPage.jsx` | `patchJson("/notifications/{id}/read")` | PATCH | `/notifications/{notification_id}/read` | `mark_read` | `backend/app/routes/notifications.py` |
| `NotificationsPage.jsx` | `postEmpty("/notifications/read-all")` | POST | `/notifications/read-all` | `mark_all_read` | `backend/app/routes/notifications.py` |
| `AnalyticsTracker.jsx` | `postJson("/analytics/events", ...)` | POST | `/analytics/events` | `log_event` | `backend/app/routes/analytics.py` |
| `AdminAnalytics.jsx` | `getRequest("/analytics/admin")` | GET | `/analytics/admin` | `admin_overview` | `backend/app/routes/analytics.py` |
| `DirectorAnalytics.jsx` | `getRequest("/analytics/director")` | GET | `/analytics/director` | `director_overview` | `backend/app/routes/analytics.py` |
| `ViewerAnalytics.jsx` | `getRequest("/analytics/viewer")` | GET | `/analytics/viewer` | `viewer_overview` | `backend/app/routes/analytics.py` |

---

## 6. Relationship Traceability Table

The table below links every structural relationship in the ERD and DFDs directly to the supporting backend source code implementation:

| Source Entity / Collection | Target Entity / Collection | Relationship Semantics | Cardinality | Implementation Mechanism & Query Pattern | Source File & Function Reference |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `directors_collection` | `film_collection` | Director owns/authors submitted films | 1 : N | `film_collection.find({"directorId": director_oid})` | `backend/app/routes/director.py:upload_vid`, `get_my_videos` |
| `admin_collection` | `film_collection` | Admin moderates and curates film | 1 : N | `film_collection.update_one({"_id": oid}, {"$set": {"moderatedBy": admin_oid, "moderationStatus": "approved"}})` | `backend/app/routes/admin.py:approve_video`, `reject_video` |
| `film_collection` | `cast_collection` | Film references cast members | 1 : N | `cast_collection.insert_one({"videoId": video_oid})` and `film_collection.find({"cast": {"$in": cast_ids}})` | `backend/app/routes/director.py:upload_vid`, `get_my_video` |
| `viewers_collection` | `viewer_settings_collection` | Viewer manages viewing settings | 1 : 1 | `viewer_settings_collection.find_one({"viewerId": viewer_id})` | `backend/app/routes/viewer.py:get_viewer_settings`, `update_viewer_settings` |
| `viewers_collection` | `watch_sessions_collection` | Viewer has active playback session | 1 : N | `watch_sessions_collection.update_one({"videoId": oid, "viewerId": viewer["_id"]}, ...)` | `backend/app/routes/viewer.py:watch_video`, `watch_heartbeat` |
| `watch_sessions_collection` | `watch_log_collection` | Active session links to append-only log | 1 : 1 | `session.get("logId")` linking to `watch_log_collection` | `backend/app/routes/viewer.py:_start_watch_log`, `_log_watch_time` |
| `viewers_collection` | `watch_history_collection` | Viewer stores resume position | 1 : N | `watch_history_collection.update_one({"viewerId": vid, "videoId": oid}, {"$set": {"currentTimeSec": current}})` | `backend/app/routes/viewer.py:watch_heartbeat`, `get_watch_history` |
| `viewers_collection` | `video_views_collection` | Viewer completes 75% qualified view | 1 : N | `video_views_collection.insert_one({"videoId": oid, "viewerId": viewer["_id"]})` (Unique compound index) | `backend/app/routes/viewer.py:watch_heartbeat` |
| `viewers_collection` | `watchlist_collection` | Viewer bookmarks film | 1 : N | `watchlist_collection.insert_one({"viewerId": uid, "videoId": oid, "addedAt": now})` | `backend/app/routes/viewer.py:toggle_watchlist`, `get_watchlist` |
| `viewers_collection` | `video_reactions_collection` | Viewer likes/dislikes video | 1 : N | `video_reactions_collection.update_one({"videoId": oid, "viewerId": uid}, ...)` | `backend/app/routes/viewer.py:react_to_video` |
| `film_collection` | `comments_collection` | Film contains comments thread | 1 : N | `comments_collection.find({"videoId": oid, "parentId": None})` | `backend/app/routes/viewer.py:post_comment`, `get_comments` |
| `comments_collection` | `comments_collection` | Parent comment contains nested replies | 1 : N | `comments_collection.find({"parentId": comment_id})` | `backend/app/routes/viewer.py:reply_to_comment`, `get_comment_replies` |
| `viewers_collection` | `comment_reactions_collection` | Viewer upvotes/downvotes comment | 1 : N | `comment_reactions_collection.update_one({"commentId": cid, "viewerId": uid}, ...)` | `backend/app/routes/viewer.py:react_to_comment` |
| `film_collection` | `video_reviews_collection` | Film contains editorial reviews | 1 : N | `video_reviews_collection.find({"videoId": oid})` and `$inc: {"reviewCount": 1}` | `backend/app/routes/viewer.py:post_review`, `get_reviews` |
| `viewers_collection` | `review_reactions_collection` | Viewer marks review as helpful | 1 : N | `review_reactions_collection.insert_one({"reviewId": rid, "viewerId": uid})` | `backend/app/routes/viewer.py:like_review` |
| Multi-entity | `notifications_collection` | System dispatches notifications | 1 : N | `notifications_collection.insert_one({"recipientRole": role, "recipientId": uid, "type": ...})` | `backend/utils/notifications.py:notify`, `backend/app/routes/notifications.py` |
| Multi-entity | `account_deletions_collection` | Deletion audit trail | 1 : 1 | `account_deletions_collection.insert_one({"role": role, "reason": reason, "daysMember": days})` | `backend/app/routes/auth.py:delete_account` |
| Multi-entity | `analytics_events_collection` | Privacy-conscious event log | 1 : N | `analytics_events_collection.insert_one({"eventName": name, "sessionId": sid, "ipHash": hash})` | `backend/app/routes/analytics.py:log_event` |

---

## 7. Directly Verified vs. Inferred Architectural Behaviors

### 7.1 Directly Verified Behaviors
1. **Multi-Role User Segregation:** `viewers_collection`, `directors_collection`, and `admin_collection` are distinct collections in MongoDB. Email addresses are strictly enforced as unique across all three collections during registration (`backend/app/routes/auth.py:_check_email_unique`).
2. **Account Deletion Cascades:**
   * Viewer deletion anonymizes comments and reviews (`$set: {"username": "Deleted user"}`, `$unset: {"viewerId": ""}`) while hard-deleting private history, sessions, views, watchlist, and reactions.
   * Director deletion cleans up Cloudinary assets (`_cleanup_cloudinary_assets`), purges local media files, and completely removes all associated films, cast records, reviews, and comments from the database (`backend/app/routes/auth.py:delete_account`).
3. **75% Qualified View Gate & Anti-Drift Algorithm:** Views are not credited upon initial load. Heartbeat pings check playback drift against wall-clock duration (`drift <= 5s`). Only when active playback reaches 75% of total runtime (`durationSec * 0.75`) is a record inserted into `video_views`. Duplicate views from the same viewer are swallowed by `DuplicateKeyError`, ensuring `uniqueViews` reflects distinct human audiences (`backend/app/routes/viewer.py:watch_heartbeat`).
4. **Deterministic Multilingual Moderation:** Comments and reviews are processed locally using Unicode NFKC normalization, zero-width stripping, leetspeak mapping, and regex phrase boundary checks across 26 languages without relying on third-party cloud APIs (`backend/utils/moderation.py:check_comment_text`).
5. **Deduplicated Notification Fan-out:** Notifications employ a unique sparse index on `dedupeKey` in MongoDB (`dedupeKey: "view_milestone:{videoId}:{views}"` or `"comment_like:{commentId}:{actorId}"`), preventing duplicate alerts (`backend/utils/notifications.py`).
6. **HLS Multi-Rendition Ladder:** The transcoding engine validates input resolution, scales video using Lanczos resampling, packages video into 6-second MPEG-TS chunks (`-hls_time 6`), uploads chunks to Cloudinary, rewrites local playlists with remote URLs, and uploads a unified `master.m3u8` (`backend/app/routes/director.py:_build_hls`).

### 7.2 Inferred & Contextual Behaviors
1. **Dual AI Upscaling Engine Paths:**
   * *Active Path:* `backend/utils/AIhelpers.py` executes Dockerized TensorFlow ESPCN (`miratmu/ffmpeg-tensorflow`) via subprocess. This is the path explicitly wired into `director.py:_prepare_hls_input`.
   * *Alternate / Historical Path:* `backend/models/single-image-super-resolution-1032.xml` and `.bin` are Intel OpenVINO Intermediate Representation (IR) model files. A compiled artifact `backend/utils/__pycache__/ai_upscaler_openvino.cpython-311.pyc` was discovered, indicating that OpenVINO was either previously utilized or provided as an alternative hardware-accelerated upscaler before the Dockerized ESPCN engine was adopted.
2. **Rate Limiting Scope:** `SlidingWindowLimiter` in `backend/utils/rate_limit.py` is implemented using an in-memory dictionary. In a horizontally-scaled multi-worker deployment, rate-limiting state would be local to each worker process rather than globally synchronized via Redis.

---

## 8. Edge Cases, Limitations & Observations

1. **Synchronous Transcoding in API Request:** The video upload endpoint (`POST /directors/upload-video`) executes video probing, AI super-resolution, and HLS transcoding synchronously within the HTTP request lifecycle. While upload progress is streamed via Axios `onUploadProgress`, lengthy transcoding of larger film files can encounter HTTP client gateway timeouts unless server timeout limits are adjusted.
2. **Cloudinary Asset Synchronization:** Cloudinary deletions in `cleanup_old_thumbnail` and `_cleanup_cloudinary_assets` are executed on a best-effort basis (`try...except`). Network interruptions during deletion may leave orphan `.ts` segments in Cloudinary cloud storage.
3. **Soft-Deleted vs. Anonymized Content:** Comment deletion distinguishes between user-initiated deletion (which anonymizes the record as `"Deleted user"` to preserve discussion continuity) and admin moderation removal (`adminRemoved: True`, which hides the comment from public feeds while retaining auditability for moderators).

---

## 9. Conclusion

The Proscenium codebase presents an intentional, resilient architectural model tailored to independent film workflows. By combining document-based database design in MongoDB with containerized media processing (FFmpeg/Docker ESPCN), distributed Cloudinary asset distribution, and asynchronous email notifications, the platform achieves high decoupling between content creation, curation, and audience consumption.
