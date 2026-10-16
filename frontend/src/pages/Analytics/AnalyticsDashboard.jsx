import React, { useEffect, useMemo, useState } from "react";
import {Activity,BarChart3,Bookmark,Clock3,Eye,Film,Heart,MessageSquare,RefreshCw,Star,Users,TrendingUp,MousePointerClick,Globe2,Megaphone,ShieldCheck,Wallet,Gauge,PlayCircle,CalendarDays,Search,ArrowLeft,Tags as TagsIcon,Lightbulb,} from "lucide-react";
import { getRequest, putJson } from "../../api/client.js";
import "./analytics.css";

// When an admin opens another account's analytics, first-person wording is made neutral.
const AdminViewContext = React.createContext(false);
const neutral = (text, on) =>
  on && typeof text === "string"
    ? text
        .replace(/\bYour own\b/g, "This account's")
        .replace(/\byour own\b/g, "this account's")
        .replace(/\bYour\b/g, "Their")
        .replace(/\byour\b/g, "their")
        .replace(/\bYou\b/g, "They")
        .replace(/\byou\b/g, "they")
    : text;

// Plain-language explanation of each metric.
const METRIC_HELP = {
  totalUsers:
    "Everyone with a Proscenium account: viewers, directors and admins.",
  viewers: "Accounts that watch films.",
  directors: "Accounts that upload films.",
  registrations: "New accounts created during the selected period.",
  videos: "Films uploaded to the platform, whatever their review status.",
  approvedVideos:
    "Films a moderator approved that are also public, so viewers can watch them.",
  pendingVideos: "Films waiting for a moderator's decision.",
  views: "Times viewers started watching a film.",
  watchMinutes: "Minutes viewers spent watching, added together.",
  pageViews: "Times a page on the website was opened.",
  uniqueVisitors:
    "Different browsers that visited. One person using two devices counts twice.",
  sessions: "Separate visits to the site.",
  navigationClicks: "Clicks on links and menu items.",
  campaignTaggedPageViews: "Visits that came from a link with a campaign tag.",
  visitorToRegistrationPercent:
    "Share of visitors who went on to create an account.",
  searchToPlayPercent: "Share of visits that searched and then played a film.",
  reactions: "Likes and dislikes left on films.",
  reviews: "Written reviews.",
  comments: "Comments left on films.",
  videosWatched: "Different films that were started.",
  completed: "Films watched to the end.",
  watchlist: "Films you saved to your watchlist during the selected period.",
  likes: "Films you liked during the selected period.",
  watchlists: "Films saved to a watchlist during the selected period.",
  registrationToWatchPercent:
    "Share of new accounts that went on to play a film.",
  activeViewers: "Viewers who watched something during the selected period.",
  returningViewers: "Active viewers who had also watched before this period.",
  completionRate: "Share of the films you started that you finished.",
};

const plural = (n, one, many) => `${number(n)} ${Number(n) === 1 ? one : many}`;

// Short plain-English summary shown at the top of each page.
function buildTakeaways({
  role,
  tab,
  days,
  summary = {},
  data,
  engagement,
  intelligence,
  tagData,
}) {
  const out = [];
  const period = `the last ${days} days`;
  const eng = engagement?.summary || {};
  const intel = intelligence?.summary || {};
  if (role === "admin") {
    if (tab === "overview" && data) {
      out.push(
        `${plural(summary.totalUsers || 0, "account is", "accounts are")} registered, and the catalogue holds ${plural(summary.videos || 0, "film", "films")} (${number(summary.approvedVideos || 0)} approved).`,
      );
      out.push(
        `Films were viewed ${plural(summary.views || 0, "time", "times")} in ${period}, adding up to ${plural(summary.watchMinutes || 0, "minute", "minutes")} of watching.`,
      );
      const top = data.topVideos?.[0];
      if (top?.title)
        out.push(
          `The most-viewed film was "${top.title}" with ${plural(top.views || 0, "view", "views")}.`,
        );
      if (Number(summary.pendingVideos) > 0)
        out.push(
          `${plural(summary.pendingVideos, "film is", "films are")} waiting for a moderator's decision.`,
        );
    } else if (tab === "engagement" && engagement) {
      if (!Number(eng.pageViews))
        out.push(
          "No website visits have been recorded in this period yet. Numbers appear as people use the site.",
        );
      else {
        out.push(
          `${plural(eng.uniqueVisitors || 0, "browser", "different browsers")} visited in ${period}, opening pages ${plural(eng.pageViews, "time", "times")} across ${plural(eng.sessions || 0, "visit", "visits")}.`,
        );
        const page = engagement.topPages?.[0];
        if (page?.path)
          out.push(
            `The most visited page was ${page.path} (${plural(page.views, "view", "views")}).`,
          );
      }
    } else if (tab === "audience" && data) {
      out.push(
        `${plural(summary.viewers || 0, "viewer", "viewers")} and ${plural(summary.directors || 0, "director", "directors")} have accounts.`,
      );
      if (summary.registrations != null)
        out.push(
          `${plural(summary.registrations || 0, "new viewer or director account was", "new viewer and director accounts were")} created in ${period}.`,
        );
    } else if (tab === "content" && data) {
      const top = data.topVideos?.[0];
      if (top?.title)
        out.push(`"${top.title}" is the most-viewed film in ${period}.`);
      if (intelligence?.highStartLowCompletion?.length)
        out.push(
          `${plural(intelligence.highStartLowCompletion.length, "film is", "films are")} started often but rarely finished.`,
        );
    } else if (tab === "tags" && tagData) {
      out.push(
        `${plural(tagData.totalTags || 0, "distinct tag is", "distinct tags are")} in use across the catalogue.`,
      );
      const top = tagData.tags?.[0];
      if (top?.tag)
        out.push(
          `The most-used tag is "${top.tag}", on ${plural(top.filmCount, "film", "films")}.`,
        );
    } else if (tab === "marketing" && engagement) {
      const source = engagement.trafficSources?.[0];
      if (source?.label)
        out.push(
          `Most visits came from "${source.label}" (${plural(source.value, "visit", "visits")}).`,
        );
      if (eng.visitorToRegistrationPercent != null)
        out.push(
          `${eng.visitorToRegistrationPercent}% of visitors went on to create an account.`,
        );
      if (!Number(eng.campaignTaggedPageViews))
        out.push(
          "No visits carry a campaign tag yet, so campaign results cannot be measured. Add utm_ tags to the links you share.",
        );
    } else if (tab === "demand" && intelligence) {
      out.push(
        `${plural(intel.searches || 0, "search was", "searches were")} made in ${period}.`,
      );
      if (Number(intel.zeroResultSearches) > 0)
        out.push(
          `${plural(intel.zeroResultSearches, "search found", "searches found")} no films.`,
        );
    } else if (tab === "health" && intelligence) {
      const req = Number(intel.apiRequests || 0);
      if (!req)
        out.push("No server activity has been recorded in this period yet.");
      else
        out.push(
          `The server handled ${plural(req, "request", "requests")} with ${plural(intel.apiErrors || 0, "error", "errors")} (${((Number(intel.apiErrors || 0) / req) * 100).toFixed(1)}%).`,
        );
    }
  } else if (role === "director" && data) {
    if (tab === "overview") {
      out.push(
        `You have ${plural(summary.videos || 0, "film", "films")}, viewed ${plural(summary.views || 0, "time", "times")} in ${period} with ${plural(summary.watchMinutes || 0, "minute", "minutes")} of watching.`,
      );
      out.push(
        `Viewers left ${plural(summary.reactions || 0, "reaction", "reactions")}, ${plural(summary.reviews || 0, "review", "reviews")} and ${plural(summary.comments || 0, "comment", "comments")}.`,
      );
      const top = data.videos?.[0];
      if (top && Number(top.views) > 0)
        out.push(
          `Your most-viewed film in ${period} is "${top.title}" (${plural(top.views, "view", "views")}).`,
        );
    }
  } else if (role === "viewer" && data) {
    if (tab === "overview")
      out.push(
        `You watched ${plural(summary.videosWatched || 0, "film", "films")} (${plural(summary.watchMinutes || 0, "minute", "minutes")}) in ${period} and finished ${number(summary.completed || 0)}.`,
      );
  }
  return out;
}

function Takeaways({ items }) {
  const on = React.useContext(AdminViewContext);
  if (!items?.length) return null;
  return (
    <section
      className="analytics-takeaways"
      aria-label="Summary in plain words"
    >
      <h2>
        <Lightbulb size={15} /> At a glance
      </h2>
      <ul>
        {items.map((text) => (
          <li key={text}>{neutral(text, on)}</li>
        ))}
      </ul>
    </section>
  );
}

const GLOSSARY = {
  admin: [
    [
      "Visitor",
      "A browser that opened the site. If someone clears their browser data or uses another device, they count as a new visitor.",
    ],
    ["Visit (session)", "One continuous stay on the site."],
    ["Page view", "One time a page was opened."],
    ["Film view", "One time a viewer started watching a film."],
    ["Watch minutes", "Total time spent watching, added across all viewers."],
    ["Completion", "How much of a film viewers finished."],
    [
      "Traffic source",
      "Where a visit came from, such as a shared link, a social site or typing the address directly.",
    ],
    [
      "Campaign tag (UTM)",
      "A label added to a link, like utm_campaign=launch, so visits from that link can be measured.",
    ],
    [
      "Conversion",
      "A visitor who took the next step, such as creating an account or playing a film. These are estimates based on the same browser.",
    ],
  ],
  director: [
    ["View", "One time a viewer started one of your films."],
    ["Watch minutes", "Total time viewers spent watching your films."],
    ["Reaction", "A like or dislike on a film."],
    ["Completion", "How much of a film viewers finished."],
  ],
  viewer: [
    ["Films watched", "Different films you started."],
    ["Completed", "Films you watched to the end."],
    ["Watch minutes", "Total time you spent watching."],
    ["Watchlist", "Films you saved for later."],
  ],
};

function Glossary({ role }) {
  const on = React.useContext(AdminViewContext);
  const terms = GLOSSARY[role] || [];
  if (!terms.length) return null;
  return (
    <details className="analytics-glossary">
      <summary>How to read these numbers</summary>
      <dl>
        {terms.map(([term, text]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{neutral(text, on)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

const number = (value) => Number(value || 0).toLocaleString("en-IN");
const compact = (value) => {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return number(n);
};

const busiestDay = (rows, key) => {
  let best = null;
  for (const row of rows || [])
    if (Number(row[key] || 0) > Number(best?.[key] || 0)) best = row;
  return best ? `${best.date} (${number(best[key])})` : "—";
};

const roleConfig = {
  admin: {
    title: "Platform intelligence",
    subtitle:
      "A business-wide view of audience, content and website engagement.",
    endpoint: "/analytics/admin",
    tabs: [
      ["overview", "Overview", BarChart3],
      ["engagement", "Website engagement", Activity],
      ["audience", "Audience growth", Users],
      ["users", "User analytics", Users],
      ["insights", "Why & trends", Lightbulb],
      ["content", "Content performance", Film],
      ["tags", "Tags", TagsIcon],
      ["marketing", "Marketing & business", Megaphone],
      ["health", "Platform health", ShieldCheck],
      ["demand", "Demand & insights", TrendingUp],
    ],
  },
  director: {
    title: "Film performance studio",
    subtitle: "Understand the reach and audience response for your own films.",
    endpoint: "/analytics/director",
    tabs: [
      ["overview", "Overview", BarChart3],
      ["insights", "Top performers", Star],
      ["films", "Film performance", Film],
      ["engagement", "Audience engagement", Heart],
    ],
  },
  viewer: {
    title: "My viewing insights",
    subtitle:
      "A private summary of your viewing habits and activity on Proscenium.",
    endpoint: "/analytics/viewer",
    tabs: [
      ["overview", "My activity", Activity],
      ["trends", "Viewing trends", CalendarDays],
      ["taste", "My taste profile", Heart],
      ["community", "Community insights", Globe2],
    ],
  },
};

function StatCard({ label, value, Icon, note, index = 0 }) {
  const on = React.useContext(AdminViewContext);
  label = neutral(label, on);
  note = neutral(note, on);
  return (
    <article
      className="analytics-stat"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="analytics-stat-top">
        <span>{label}</span>
        <span className="analytics-stat-icon">
          <Icon size={17} />
        </span>
      </div>
      <strong>{typeof value === "string" ? value : compact(value)}</strong>
      <small>{note || "For the selected period"}</small>
    </article>
  );
}

function Panel({
  title,
  subtitle,
  icon: Icon = Activity,
  children,
  className = "",
}) {
  const on = React.useContext(AdminViewContext);
  title = neutral(title, on);
  subtitle = neutral(subtitle, on);
  return (
    <section className={`analytics-panel ${className}`}>
      <div className="analytics-panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <span className="analytics-panel-mark">
          <Icon size={17} />
        </span>
      </div>
      {children}
    </section>
  );
}

function Bars({ rows, dataKey, labelKey = "date" }) {
  // Daily rows are zero-filled, so "has rows" is not the same as "has data".
  const hasData = rows?.some((r) => Number(r[dataKey] || 0) > 0);
  if (!hasData)
    return (
      <div className="analytics-empty">
        Nothing has been recorded for this period yet. The chart fills in as
        people use the site.
      </div>
    );
  // Long ranges are summed into ~10 buckets so no day's activity is dropped from the chart.
  const step = rows.length > 12 ? Math.ceil(rows.length / 10) : 1;
  const grouped = [];
  for (let i = 0; i < rows.length; i += step) {
    const chunk = rows.slice(i, i + step);
    const first = chunk[0][labelKey];
    const last = chunk[chunk.length - 1][labelKey];
    grouped.push({
      [labelKey]: first,
      range: chunk.length > 1 ? `${first} – ${last}` : first,
      [dataKey]: chunk.reduce((sum, r) => sum + Number(r[dataKey] || 0), 0),
    });
  }
  const barMax = Math.max(1, ...grouped.map((r) => Number(r[dataKey] || 0)));
  return (
    <div className="analytics-bars">
      {grouped.map((row, i) => (
        <div
          className="analytics-bar-column"
          key={`${row[labelKey]}-${i}`}
          title={`${row.range}: ${number(row[dataKey])}`}
        >
          <div className="analytics-bar-track">
            <div
              className="analytics-bar"
              style={{
                height: `${Math.max(3, (Number(row[dataKey] || 0) / barMax) * 100)}%`,
              }}
            />
          </div>
          <span>{row[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

function DataTable({ rows, columns, empty }) {
  empty = neutral(empty, React.useContext(AdminViewContext));
  if (!rows?.length)
    return (
      <div className="analytics-empty">{empty || "No data to show yet."}</div>
    );
  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table">
        <thead>
          <tr>
            {columns.map((c, ci) => (
              <th key={`${c.key}-${ci}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.title || row.path || row.label || "row"}-${i}`}>
              {columns.map((c, ci) => (
                <td key={`${c.key}-${ci}`}>
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusList({ rows, empty = "Nothing recorded for this period yet." }) {
  if (!rows?.length || rows.every((r) => !Number(r.value)))
    return <div className="analytics-empty">{empty}</div>;
  const total = Math.max(
    1,
    rows.reduce((sum, item) => sum + Number(item.value || 0), 0),
  );
  return (
    <div className="analytics-status-list">
      {rows.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{number(item.value)}</strong>
          <div className="analytics-status-track">
            <span
              style={{
                width: `${Math.min(100, (Number(item.value || 0) / total) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoState({ icon: Icon = Gauge, title, text }) {
  const on = React.useContext(AdminViewContext);
  title = neutral(title, on);
  text = neutral(text, on);
  return (
    <div className="analytics-info-state">
      <span>
        <Icon size={20} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

const USERS_PAGE = 20;

function InsightFilmCard({ film, good, admin }) {
  const s = film.sentiment || {};
  const themes = (film.themes || []).map((t) => t.theme.toLowerCase()).join(", ");
  return (
    <article className={`insight-card ${good ? "is-best" : ""}`}>
      <header className="insight-card-head">
        <h4>{film.title}</h4>
        <span className="analytics-status-pill">Score {film.score}</span>
      </header>
      <div className="analytics-mini-stats">
        <div><span>Views</span><strong>{number(film.views)}</strong></div>
        <div><span>Watched to end</span><strong>{film.completionRate == null ? "—" : `${film.completionRate}%`}</strong></div>
        <div><span>Likes</span><strong>{film.likeRatio == null ? "—" : `${Math.round(film.likeRatio * 100)}%`}</strong></div>
        <div><span>Rating</span><strong>{film.avgRating ? `${film.avgRating} / 5` : "—"}</strong></div>
        <div><span>Comments</span><strong>{number(film.comments)}</strong></div>
      </div>
      <p className="insight-label">{admin ? "Why it is doing well" : good ? "Why it did well" : "Why it did less well"}</p>
      <ul className="insight-reasons">
        {(film.reasons || []).map((r) => <li key={r}>{r}</li>)}
      </ul>
      <p className="analytics-muted-copy">
        Feedback: {s.positive || 0} positive · {s.negative || 0} negative · {s.neutral || 0} neutral
        {themes ? ` · viewers talk about ${themes}` : ""}
      </p>
      {film.feedbackSummary && (
        <p className="analytics-muted-copy">Summary: {film.feedbackSummary}</p>
      )}
      {admin && film.audience?.notes?.length > 0 && (
        <p className="analytics-muted-copy">Who watches it: {film.audience.notes.join(" ")}</p>
      )}
      {!admin && good && film.similar?.length > 0 && (
        <p className="analytics-muted-copy">
          Similar on Proscenium:{" "}
          {film.similar.map((x) => `${x.title}${x.isYours ? " (yours)" : ""}, ${number(x.views)} views`).join(" · ")}
        </p>
      )}
    </article>
  );
}

function AudiencePanel({ audience, title, subtitle }) {
  if (!audience || !audience.viewers) {
    return (
      <Panel title={title} subtitle={subtitle} icon={Users}>
        <p className="analytics-muted-copy">No viewers in this period yet.</p>
      </Panel>
    );
  }
  return (
    <Panel title={title} subtitle={subtitle} icon={Users}>
      <ul className="insight-reasons">
        {audience.notes.map((n) => <li key={n}>{n}</li>)}
      </ul>
      <div className="analytics-content-grid">
        <div>
          <p className="insight-label">By gender (shared by viewers, optional)</p>
          <StatusList rows={audience.gender.map((g) => ({ label: g.label, value: g.count }))} empty="No data." />
        </div>
        <div>
          <p className="insight-label">By age (from date of birth)</p>
          <StatusList rows={audience.ageBands.map((g) => ({ label: g.label, value: g.count }))} empty="No data." />
        </div>
      </div>
    </Panel>
  );
}

export default function AnalyticsDashboard({ role, userId, onBack }) {
  const config = roleConfig[role] || roleConfig.viewer;
  const endpoint = userId
    ? `/analytics/admin/users/${role}/${userId}`
    : config.endpoint;
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState(() => {
    // Deep link: /admin/analytics?tab=tags opens that tab directly.
    const wanted =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("tab");
    return !userId && wanted && config.tabs.some(([key]) => key === wanted)
      ? wanted
      : "overview";
  });
  const [data, setData] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [community, setCommunity] = useState(null);
  const [viewerGender, setViewerGender] = useState(null);
  const [genderSaving, setGenderSaving] = useState(false);
  const [intelligence, setIntelligence] = useState(null);
  const [intelligenceError, setIntelligenceError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [engagementError, setEngagementError] = useState("");
  const [reload, setReload] = useState(0);
  const [userRole, setUserRole] = useState("viewer");
  const [userQuery, setUserQuery] = useState("");
  const [userSkip, setUserSkip] = useState(0);
  const [users, setUsers] = useState(null);
  const [usersError, setUsersError] = useState("");
  const [selected, setSelected] = useState(null);
const [dIns, setDIns] = useState(null);
const [dInsError, setDInsError] = useState("");
const [dSort, setDSort] = useState("score");
const [dOrder, setDOrder] = useState("desc");
const [dSkip, setDSkip] = useState(0);
const [openRow, setOpenRow] = useState(null);
const [aIns, setAIns] = useState(null);
const [aInsError, setAInsError] = useState("");
const [deletionData, setDeletionData] = useState(null);
const [deletionError, setDeletionError] = useState("");
const INSIGHT_PAGE = 10;

useEffect(() => {
  if (role !== "director" || tab !== "insights") return undefined;
  let alive = true;
  setDInsError("");
  const q = new URLSearchParams({ days, sort: dSort, order: dOrder, limit: INSIGHT_PAGE, skip: dSkip });
  if (userId) q.set("director_id", userId); // admin opening one director's analytics
  getRequest(`/analytics/director/insights?${q}`)
    .then((r) => alive && setDIns(r))
    .catch((e) => alive && setDInsError(e.message || "Insights are not available yet."));
  return () => {
    alive = false;
  };
}, [role, tab, days, reload, userId, dSort, dOrder, dSkip]);

useEffect(() => {
  if (role !== "admin" || tab !== "insights" || userId) return undefined;
  let alive = true;
  setAInsError("");
  getRequest(`/analytics/admin/insights?days=${days}&limit=5`)
    .then((r) => alive && setAIns(r))
    .catch((e) => alive && setAInsError(e.message || "Insights are not available yet."));
  return () => {
    alive = false;
  };
}, [role, tab, days, reload, userId]);

useEffect(() => {
  if (role !== "admin" || tab !== "insights" || userId) return undefined;
  let alive = true;
  setDeletionError("");
  getRequest(`/analytics/admin/account-deletions?days=${days}`)
    .then((r) => alive && setDeletionData(r))
    .catch((e) => alive && setDeletionError(e.message || "Account exit data is not available yet."));
  return () => {
    alive = false;
  };
}, [role, tab, days, reload, userId]);
  const [tagData, setTagData] = useState(null);
  const [tagError, setTagError] = useState("");
  const [tagQuery, setTagQuery] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    getRequest(`${endpoint}?days=${days}`)
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((e) => {
        if (alive) setError(e.message || "Could not load analytics.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [endpoint, days, reload]);

  useEffect(() => {
    if (role !== "admin") return undefined;
    let alive = true;
    setEngagementError("");
    getRequest(`/analytics/admin/engagement?days=${days}`)
      .then((result) => {
        if (alive) setEngagement(result);
      })
      .catch((e) => {
        if (alive)
          setEngagementError(
            e.message || "Website engagement data is not available yet.",
          );
      });
    return () => {
      alive = false;
    };
  }, [role, days, reload]);

  useEffect(() => {
    if (role !== "admin") return undefined;
    let alive = true;
    setIntelligenceError("");
    getRequest(`/analytics/admin/intelligence?days=${days}`)
      .then((result) => {
        if (alive) setIntelligence(result);
      })
      .catch((e) => {
        if (alive)
          setIntelligenceError(
            e.message || "Advanced insights are not available yet.",
          );
      });
    return () => {
      alive = false;
    };
  }, [role, days, reload]);

  useEffect(() => {
    if (role !== "admin" || tab !== "users") return undefined;
    let alive = true;
    setUsersError("");
    const timer = setTimeout(
      () => {
        getRequest(
          `/analytics/admin/users?role=${userRole}&q=${encodeURIComponent(userQuery.trim())}&limit=${USERS_PAGE}&skip=${userSkip}`,
        )
          .then((result) => {
            if (alive) setUsers(result);
          })
          .catch((e) => {
            if (alive) setUsersError(e.message || "Could not load users.");
          });
      },
      userQuery ? 300 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [role, tab, userRole, userQuery, userSkip, reload]);

  useEffect(() => {
    if (role !== "admin" || userId || tab !== "tags") return undefined;
    let alive = true;
    setTagError("");
    getRequest("/analytics/admin/tags")
      .then((result) => {
        if (alive) setTagData(result);
      })
      .catch((e) => {
        if (alive)
          setTagError(e.message || "Tag analytics could not be loaded.");
      });
    return () => {
      alive = false;
    };
  }, [role, userId, tab, reload]);

  useEffect(() => {
    if (role !== "viewer" || userId) return undefined;
    let alive = true;
    getRequest("/analytics/insights")
      .then((result) => {
        if (alive) setCommunity(result);
      })
      .catch(() => {
        if (alive) setCommunity(null);
      });
    return () => {
      alive = false;
    };
  }, [role, reload]);

  useEffect(() => {
    if (role !== "viewer" || userId) return undefined;
    let alive = true;
    getRequest("/viewer/profile")
      .then((profile) => alive && setViewerGender(profile.gender || ""))
      .catch(() => alive && setViewerGender(null));
    return () => {
      alive = false;
    };
  }, [role, userId, reload]);

  async function saveViewerGender(value) {
    setGenderSaving(true);
    try {
      await putJson("/viewer/profile", { gender: value });
      setViewerGender(value);
    } catch {
      // The profile page remains available if this optional prompt fails.
    } finally {
      setGenderSaving(false);
    }
  }

  const summary = data?.summary || {};
  const tabs = userId
    ? config.tabs.filter(([key]) => key !== "community")
    : config.tabs;
  const tabText = (label) =>
    userId
      ? label.replace(/^My /, "").replace(/^./, (c) => c.toUpperCase())
      : label;
  const listReady = users && users.role === userRole;
  const setActiveTab = (next) => setTab(next);
  const cards = useMemo(() => {
    if (role === "admin") {
      if (["health", "demand", "users", "tags"].includes(tab)) return [];
      const values = {
        overview: [
          ["totalUsers", "Registered accounts", Users],
          ["videos", "Films in catalogue", Film],
          ["views", "Film views", Eye],
          ["watchMinutes", "Watch minutes", Clock3],
          ["pendingVideos", "Awaiting moderation", Activity],
        ],
        engagement: [
          ["pageViews", "Page views", Eye],
          ["uniqueVisitors", "Unique visitors", Users],
          ["sessions", "Visits", Activity],
          ["navigationClicks", "Navigation clicks", MousePointerClick],
        ],
        audience: [
          ["viewers", "Viewer accounts", Users],
          ["directors", "Director accounts", Film],
          ["registrations", "Registrations in period", TrendingUp],
          ["activeViewers", "Active viewers", Activity],
          ["returningViewers", "Returning viewers", RefreshCw],
        ],
        marketing: [
          ["campaignTaggedPageViews", "Visits from tagged links", Megaphone],
          ["visitorToRegistrationPercent", "Visitor → registration", Users],
          ["registrationToWatchPercent", "Registration → first film", PlayCircle],
          ["searchToPlayPercent", "Search → playback", Search],
        ],
        content: [
          ["reactions", "Reactions", Heart],
          ["reviews", "Reviews", Star],
          ["comments", "Comments", MessageSquare],
          ["watchlists", "Watchlist saves", Bookmark],
        ],
      };
      // Audience growth now reads registrations from the same endpoint as the rest of its numbers.
      const source =
        tab === "engagement" || tab === "marketing"
          ? engagement?.summary || {}
          : tab === "audience"
            ? { ...summary, ...(intelligence?.summary || {}) }
            : summary;
      return (values[tab] || values.overview).map(([key, label, Icon]) => ({
        key,
        label,
        Icon,
        note: METRIC_HELP[key],
        value: /Percent$/.test(key)
          ? source[key] == null
            ? "—"
            : `${source[key]}%`
          : (source[key] ?? 0),
      }));
    }
    // Director and viewer pages show their KPI cards once, on the overview tab.
    if (tab !== "overview") return [];
    if (role === "director")
      return [
        ["videos", "Your films", Film],
        ["views", "Film views", Eye],
        ["watchMinutes", "Watch minutes", Clock3],
        ["reactions", "Reactions", Heart],
        ["reviews", "Reviews", Star],
        ["comments", "Comments", MessageSquare],
      ].map(([key, label, Icon]) => ({
        key,
        label,
        Icon,
        note: METRIC_HELP[key],
        value: summary[key] ?? 0,
      }));
    const started = Number(summary.videosWatched || 0);
    const completionRate = started
      ? `${Math.round((Number(summary.completed || 0) / started) * 100)}%`
      : "—";
    return [
      ["videosWatched", "Films watched", Film],
      ["completed", "Films completed", PlayCircle],
      ["completionRate", "Completion rate", Gauge],
      ["watchMinutes", "Watch minutes", Clock3],
      ["watchlist", "Added to watchlist", Bookmark],
      ["likes", "Likes given", Heart],
    ].map(([key, label, Icon]) => ({
      key,
      label,
      Icon,
      note: METRIC_HELP[key],
      value: key === "completionRate" ? completionRate : (summary[key] ?? 0),
    }));
  }, [role, tab, summary, engagement, intelligence]);

  const trend =
    role === "admin" && tab === "engagement"
      ? engagement?.trend || []
      : data?.trend || [];
  const trendKey =
    role === "admin" && tab === "engagement"
      ? "pageViews"
      : role === "viewer"
        ? "sessions"
        : "views";

  if (role === "admin" && tab === "users" && selected)
    return (
      <AnalyticsDashboard
        key={selected.id}
        role={selected.role}
        userId={selected.id}
        onBack={() => setSelected(null)}
      />
    );

  return (
    <AdminViewContext.Provider value={Boolean(userId)}>
      <section className={`analytics-page analytics-${role}`}>
        <div className="analytics-heading">
          <div>
            <div className="analytics-eyebrow">
              <BarChart3 size={14} />{" "}
              {userId
                ? `ADMIN VIEW · ${role.toUpperCase()}`
                : "INSIGHTS & PERFORMANCE"}
            </div>
            <h1>
              {userId
                ? data?.account?.name || "Account analytics"
                : config.title}
            </h1>
            <p>
              {userId
                ? `Exactly what this ${role} sees on their own analytics page${data?.account?.createdAt ? `, joined ${new Date(data.account.createdAt).toLocaleDateString("en-IN")}` : ""}${data?.account?.isBanned ? " · account is banned" : ""}.`
                : config.subtitle}
            </p>
          </div>
          <div className="analytics-actions">
            {onBack && (
              <button type="button" onClick={onBack}>
                <ArrowLeft size={15} /> All users
              </button>
            )}
            <select
              aria-label="Analytics date range"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 12 months</option>
            </select>
            <button
              type="button"
              onClick={() => setReload((n) => n + 1)}
              title="Refresh analytics"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </div>

        <nav className="analytics-tabs" aria-label={`${role} analytics pages`}>
          {tabs.map(([key, label, Icon]) => (
            <button
              type="button"
              key={key}
              className={tab === key ? "is-active" : ""}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={15} />
              <span>{tabText(label)}</span>
            </button>
          ))}
        </nav>

        {error && (
          <div className="analytics-error">
            <strong>Analytics could not be loaded.</strong>
            <span>{error}</span>
            <small>
              Check that the FastAPI backend is running and the MongoDB
              connection is available.
            </small>
          </div>
        )}
        {loading ? (
          <div className="analytics-loading">
            <span className="analytics-spinner" /> Loading real analytics from
            Proscenium…
          </div>
        ) : (
          <>
            {role === "admin" && engagementError && tab === "engagement" && (
              <div className="analytics-error">
                <strong>Website engagement is not available.</strong>
                <span>{engagementError}</span>
                <small>
                  Check that the updated analytics backend is running. Film
                  analytics remain separate.
                </small>
              </div>
            )}
            {!error && (
              <Takeaways
                items={buildTakeaways({
                  role,
                  tab,
                  days,
                  summary,
                  data,
                  engagement,
                  intelligence,
                  tagData,
                })}
              />
            )}
            {!error && (
              <div className="analytics-stat-grid">
                {cards.map((c, i) => (
                  <StatCard
                    key={`${tab}-${c.key}`}
                    {...c}
                    index={i}
                    note={c.note}
                  />
                ))}
              </div>
            )}

{role === "admin" && tab === "insights" && (
  <>
    {aInsError && <p className="analytics-muted-copy">{aInsError}</p>}
    {!aIns && !aInsError && <p className="analytics-muted-copy">Loading insights…</p>}
    {aIns && (
      <>
        <Panel title="What is trending, and why" subtitle="Top films right now, compared with the platform average and the previous period" icon={TrendingUp}>
          {aIns.trending.length === 0 && <p className="analytics-muted-copy">No viewing activity in this period yet.</p>}
          <div className="insight-grid">
            {aIns.trending.map((f) => <InsightFilmCard key={f.videoId} film={f} good admin />)}
          </div>
        </Panel>

        <AudiencePanel audience={aIns.audience} title="Who watches the platform" subtitle="All viewers with a view in this period" />

        <Panel title="Where to invest" subtitle="Genre share of views compared with share of films" icon={Lightbulb}>
          {aIns.investmentHints.length === 0 ? (
            <p className="analytics-muted-copy">Views and films are balanced across genres. No gaps stand out yet.</p>
          ) : (
            <ul className="insight-reasons">{aIns.investmentHints.map((h) => <li key={h.text}>{h.text}</li>)}</ul>
          )}
        </Panel>

        <Panel title="Why people leave" subtitle="Anonymous account deletion reasons in the selected period" icon={Users}>
          {deletionError && <p className="analytics-muted-copy">{deletionError}</p>}
          {!deletionError && deletionData && (
            <>
              <div className="analytics-mini-stats">
                <div><span>Deleted accounts</span><strong>{number(deletionData.total)}</strong></div>
                <div><span>Viewers</span><strong>{number((deletionData.byRole || []).find((item) => item.role === "viewer")?.count)}</strong></div>
                <div><span>Directors</span><strong>{number((deletionData.byRole || []).find((item) => item.role === "director")?.count)}</strong></div>
              </div>
              <StatusList
                rows={(deletionData.byReason || []).map((item) => ({
                  label: item.reason.replaceAll("_", " "),
                  value: item.count,
                }))}
                empty="No account deletions have been recorded in this period."
              />
              {deletionData.averageDaysMember != null && (
                <p className="analytics-muted-copy">
                  Average time before deletion: {number(deletionData.averageDaysMember)} days.
                </p>
              )}
            </>
          )}
          {!deletionError && !deletionData && <p className="analytics-muted-copy">Loading account exit data…</p>}
        </Panel>

        {aIns.castBuzz.length > 0 && (
          <Panel title="Cast people talk about" subtitle="Names mentioned in reviews and comments on the trending films" icon={Heart}>
            <StatusList rows={aIns.castBuzz.map((c) => ({ label: `${c.name} (${c.film})`, value: c.mentions }))} />
          </Panel>
        )}

        <p className="analytics-muted-copy">
          Platform average: {number(aIns.platform?.avgViews)} views per film
          {aIns.platform?.completionRate != null ? `, ${aIns.platform.completionRate}% watched to the end` : ""}. {aIns.method}
        </p>
      </>
    )}
  </>
)}
            {role === "admin" && tab === "overview" && (
              <>
                <div className="analytics-content-grid">
                  <Panel
                    title="Film activity over time"
                    subtitle="Recorded views from existing playback records"
                    icon={Activity}
                  >
                    <Bars rows={data?.trend || []} dataKey="views" />
                  </Panel>
                  <Panel
                    title="Content moderation queue"
                    subtitle="Films requiring review and public workflow status"
                    icon={ShieldCheck}
                  >
                    <StatusList rows={data?.contentStatus || []} />
                  </Panel>
                </div>
              </>
            )}

            {role === "admin" && tab === "engagement" && (
              <>
                <Panel
                  title="Website activity"
                  subtitle="Page views per day"
                  icon={Activity}
                >
                  <Bars rows={engagement?.trend || []} dataKey="pageViews" />
                </Panel>
                <Panel
                  title="Most visited pages"
                  subtitle="Page views and distinct anonymous visitors"
                  icon={MousePointerClick}
                  className="analytics-table-panel"
                >
                  <DataTable
                    rows={engagement?.topPages || []}
                    columns={[
                      { key: "path", label: "Page" },
                      {
                        key: "views",
                        label: "Page views",
                        render: (v) => number(v),
                      },
                      {
                        key: "uniqueVisitors",
                        label: "Unique visitors",
                        render: (v) => number(v),
                      },
                    ]}
                    empty="Website visits will appear after the analytics tracker starts collecting events."
                  />
                </Panel>
                <Panel
                  title="Pages with most exits"
                  subtitle="Route changes/unmounts observed by the tracker; closing a browser tab may not always send an event"
                  icon={Activity}
                >
                  <DataTable
                    rows={engagement?.topExits || []}
                    columns={[
                      { key: "path", label: "Page" },
                      {
                        key: "exits",
                        label: "Recorded exits",
                        render: (v) => number(v),
                      },
                      {
                        key: "avgTimeOnPageMs",
                        label: "Average time",
                        render: (v) =>
                          v ? `${Math.round(v / 1000)} sec` : "—",
                      },
                    ]}
                    empty="Page-exit events will appear as users navigate between routes."
                  />
                </Panel>
                <div className="analytics-footnote">
                  Unique visitors use a browser-stored anonymous identifier.
                  Clearing browser storage or changing devices can create a new
                  visitor identity.
                </div>
              </>
            )}

            {role === "admin" && tab === "audience" && (
              <>
                {intelligenceError && (
                  <div className="analytics-error">
                    <strong>Advanced insights are not available.</strong>
                    <span>{intelligenceError}</span>
                  </div>
                )}
                <Panel
                  title="New accounts per day"
                  subtitle="Viewer and director sign-ups in the selected period"
                  icon={TrendingUp}
                >
                  <Bars
                    rows={data?.registrationTrend || []}
                    dataKey="registrations"
                  />
                  <p className="analytics-muted-copy" style={{ marginTop: 12 }}>
                    Uses account creation timestamps. Accounts without a
                    creation date are not included.
                  </p>
                </Panel>
                <Panel
                  title="Signup cohorts"
                  subtitle="Monthly registration cohorts and session-based early-return proxy"
                  icon={Users}
                >
                  <DataTable
                    rows={intelligence?.cohorts || []}
                    columns={[
                      { key: "cohort", label: "Signup month" },
                      {
                        key: "signups",
                        label: "Signups",
                        render: (v) => number(v),
                      },
                      {
                        key: "eligibleFor7DayMeasure",
                        label: "Eligible for 7-day measure",
                        render: (v) => number(v),
                      },
                      {
                        key: "returnedWithin7Days",
                        label: "Seen in first 7 days",
                        render: (v) => number(v),
                      },
                      {
                        key: "earlyReturnRatePercent",
                        label: "Early return",
                        render: (v) => (v == null ? "Not mature yet" : `${v}%`),
                      },
                    ]}
                    empty="Cohorts will appear after viewer accounts with creation timestamps exist."
                  />
                  <p className="analytics-muted-copy">
                    This is a session-based proxy, not a canonical day-7
                    retention cohort: plays are now logged append-only, but
                    sessions from before that logging began only exist as the
                    latest record per viewer/film. Treat older cohort rates as
                    directional.
                  </p>
                </Panel>
              </>
            )}

            {role === "admin" && tab === "content" && (
              <>
                {intelligenceError && (
                  <div className="analytics-error">
                    <strong>Advanced insights are not available.</strong>
                    <span>{intelligenceError}</span>
                  </div>
                )}
                <Panel
                  title="Film performance ranking"
                  subtitle="Approved public films, most viewed first. Completion uses saved watch-history progress; the score needs completion data"
                  icon={Film}
                >
                  <DataTable
                    rows={intelligence?.filmPerformance || []}
                    columns={[
                      { key: "title", label: "Film" },
                      {
                        key: "views",
                        label: "Qualified viewers",
                        render: (v) => number(v),
                      },
                      {
                        key: "completionRatePercent",
                        label: "Completion",
                        render: (v) =>
                          v == null ? "Not enough data" : `${v}%`,
                      },
                      {
                        key: "likes",
                        label: "Likes",
                        render: (v) => number(v),
                      },
                      {
                        key: "reviews",
                        label: "Reviews",
                        render: (v) => number(v),
                      },
                      {
                        key: "rewatchViewers",
                        label: "Rewatchers",
                        render: (v) => number(v),
                      },
                      {
                        key: "performanceScore",
                        label: "Score / 100",
                        render: (v) =>
                          v == null ? "Not enough data" : <strong>{v}</strong>,
                      },
                    ]}
                    empty="Film performance will appear when public films and viewer activity are available."
                  />
                  <p className="analytics-muted-copy">
                    Score weights: qualified viewers 35%, completion 30%,
                    engagement (likes + reviews + watchlists) 20%, rewatchers
                    15%. View and engagement components are normalized against
                    the selected catalogue and period. Missing completion data
                    suppresses the score.
                  </p>
                </Panel>
                <Panel
                  title="Started often, finished rarely"
                  subtitle="Films with at least 5 recorded starts and under 40% completion"
                  icon={Gauge}
                >
                  <DataTable
                    rows={intelligence?.highStartLowCompletion || []}
                    columns={[
                      { key: "title", label: "Film" },
                      {
                        key: "starts",
                        label: "Starts",
                        render: (v) => number(v),
                      },
                      {
                        key: "completionRatePercent",
                        label: "Completion",
                        render: (v) => (v == null ? "—" : `${v}%`),
                      },
                    ]}
                    empty="No film is flagged right now. Films appear here once they have enough starts and a low completion rate."
                  />
                </Panel>
              </>
            )}

            {role === "admin" && tab === "tags" && (
              <>
                {tagError && (
                  <div className="analytics-error">
                    <strong>Tag analytics could not be loaded.</strong>
                    <span>{tagError}</span>
                  </div>
                )}
                <Panel
                  title="Tags in use"
                  subtitle="Tags come from film metadata. Counts are films per tag, across all review states"
                  icon={TagsIcon}
                >
                  <div className="analytics-user-filters">
                    <input
                      type="search"
                      aria-label="Search tags"
                      placeholder="Search tags"
                      value={tagQuery}
                      onChange={(e) => setTagQuery(e.target.value)}
                    />
                  </div>
                  <DataTable
                    rows={(tagData?.tags || []).filter((row) =>
                      String(row.tag || "")
                        .toLowerCase()
                        .includes(tagQuery.trim().toLowerCase()),
                    )}
                    columns={[
                      { key: "tag", label: "Tag" },
                      {
                        key: "filmCount",
                        label: "Films",
                        render: (v) => number(v),
                      },
                      {
                        key: "publishedCount",
                        label: "Published",
                        render: (v) => number(v),
                      },
                      {
                        key: "films",
                        label: "Example films",
                        render: (v) =>
                          (v || [])
                            .slice(0, 3)
                            .map((f) => f.title)
                            .join(", ") || "—",
                      },
                    ]}
                    empty={
                      tagData
                        ? "No tags match. Tags appear once films are uploaded with tags."
                        : "Loading tags…"
                    }
                  />
                </Panel>
              </>
            )}

            {role === "admin" && tab === "users" && (
              <Panel
                title="User analytics"
                subtitle="Open the same analytics a viewer or director sees for their own account"
                icon={Users}
              >
                <div className="analytics-user-filters">
                  <select
                    aria-label="Account type"
                    value={userRole}
                    onChange={(e) => {
                      setUserRole(e.target.value);
                      setUserSkip(0);
                    }}
                  >
                    <option value="viewer">Viewers</option>
                    <option value="director">Directors</option>
                  </select>
                  <input
                    type="search"
                    aria-label="Search accounts"
                    placeholder={
                      userRole === "director"
                        ? "Search username, email or studio"
                        : "Search username or email"
                    }
                    value={userQuery}
                    onChange={(e) => {
                      setUserQuery(e.target.value);
                      setUserSkip(0);
                    }}
                  />
                </div>
                {usersError && (
                  <div className="analytics-error">
                    <strong>Users could not be loaded.</strong>
                    <span>{usersError}</span>
                  </div>
                )}
                <DataTable
                  rows={listReady ? users.users : []}
                  empty={
                    listReady
                      ? "No accounts match this search."
                      : "Loading accounts…"
                  }
                  columns={[
                    {
                      key: "name",
                      label:
                        userRole === "director"
                          ? "Studio / director"
                          : "Username",
                    },
                    {
                      key: "createdAt",
                      label: "Joined",
                      render: (v) =>
                        v ? new Date(v).toLocaleDateString("en-IN") : "—",
                    },
                    {
                      key: "activityCount",
                      label:
                        userRole === "viewer"
                          ? "Films watched"
                          : "Films uploaded",
                      render: (v) => number(v),
                    },
                    {
                      key: "isBanned",
                      label: "Status",
                      render: (v) => (
                        <span className="analytics-status-pill">
                          {v ? "Banned" : "Active"}
                        </span>
                      ),
                    },
                    {
                      key: "id",
                      label: "",
                      render: (id) => (
                        <button
                          type="button"
                          className="analytics-row-btn"
                          onClick={() => setSelected({ role: userRole, id })}
                        >
                          View analytics
                        </button>
                      ),
                    },
                  ]}
                />
                {listReady && users.total > USERS_PAGE && (
                  <div className="analytics-pager">
                    <span>
                      {userSkip + 1}–
                      {Math.min(userSkip + USERS_PAGE, users.total)} of{" "}
                      {number(users.total)}
                    </span>
                    <span>
                      <button
                        type="button"
                        className="analytics-row-btn"
                        disabled={userSkip === 0}
                        onClick={() =>
                          setUserSkip(Math.max(0, userSkip - USERS_PAGE))
                        }
                      >
                        Previous
                      </button>{" "}
                      <button
                        type="button"
                        className="analytics-row-btn"
                        disabled={userSkip + USERS_PAGE >= users.total}
                        onClick={() => setUserSkip(userSkip + USERS_PAGE)}
                      >
                        Next
                      </button>
                    </span>
                  </div>
                )}
              </Panel>
            )}

            {role === "admin" && tab === "marketing" && (
              <>
                {engagementError && (
                  <div className="analytics-error">
                    <strong>Website data is not available.</strong>
                    <span>{engagementError}</span>
                  </div>
                )}
                <Panel
                  title="Where visitors come from"
                  subtitle="Each visit is counted under the link or site that sent it"
                  icon={Globe2}
                >
                  <StatusList
                    rows={(engagement?.trafficSources || []).map((s) => ({
                      label: s.label,
                      value: s.value,
                    }))}
                    empty="No visits recorded yet. Sources appear as people open the site."
                  />
                  <p className="analytics-muted-copy" style={{ marginTop: 12 }}>
                    Add utm_source, utm_medium and utm_campaign to the links
                    you share so each campaign can be measured. The step rates
                    above are estimates based on the same browser: people who
                    switch devices or clear their browser data can make them
                    look lower than they are, and a dash means no matching
                    events have been recorded yet.
                  </p>
                </Panel>
                <div className="analytics-footnote">
                  Revenue, profit and advertising cost are not shown because
                  Proscenium does not collect that data.
                </div>
              </>
            )}

            {role === "admin" && tab === "demand" && (
              <>
                {intelligenceError && (
                  <div className="analytics-error">
                    <strong>Advanced insights are not available.</strong>
                    <span>{intelligenceError}</span>
                  </div>
                )}
                <div className="analytics-stat-grid">
                  <StatCard
                    label="Searches"
                    value={intelligence?.summary?.searches || 0}
                    Icon={Search}
                    note="Searches made in the site search"
                  />
                  <StatCard
                    label="No-result searches"
                    value={intelligence?.summary?.zeroResultSearches || 0}
                    Icon={Search}
                    note="Searches that found no films"
                  />
                  <StatCard
                    label="Playback completion"
                    value={
                      intelligence?.summary?.completionRatePercent == null
                        ? "—"
                        : `${intelligence.summary.completionRatePercent}%`
                    }
                    Icon={PlayCircle}
                    note="Plays that reached the end, counted once per visit and film"
                  />
                </div>
                <div className="analytics-content-grid">
                  <Panel
                    title="Content demand gaps"
                    subtitle="Search phrases with the most no-result events"
                    icon={Search}
                  >
                    <DataTable
                      rows={intelligence?.demandGaps || []}
                      columns={[
                        { key: "query", label: "Search phrase" },
                        {
                          key: "searches",
                          label: "Searches",
                          render: (v) => number(v),
                        },
                        {
                          key: "zeroResults",
                          label: "No results",
                          render: (v) => number(v),
                        },
                      ]}
                      empty="Search demand will appear after search tracking collects events."
                    />
                  </Panel>
                  <Panel
                    title="Viewer journey event funnel"
                    subtitle="Raw event counts, not unique people"
                    icon={TrendingUp}
                  >
                    <StatusList
                      rows={(intelligence?.funnel || []).map((item) => ({
                        label: item.stage,
                        value: item.value,
                      }))}
                    />
                    <p className="analytics-muted-copy">
                      This is an event-count funnel. Unique-user conversion
                      needs reliable identity linking between anonymous visits
                      and registered accounts.
                    </p>
                  </Panel>
                </div>
                <Panel
                  title="Director performance leaderboard"
                  subtitle="Ranked by recorded views, then watch minutes, within the selected period"
                  icon={Users}
                >
                  <DataTable
                    rows={intelligence?.directorLeaderboard || []}
                    columns={[
                      { key: "director", label: "Director" },
                      { key: "films", label: "Films" },
                      {
                        key: "views",
                        label: "Film views",
                        render: (v) => number(v),
                      },
                      {
                        key: "watchMinutes",
                        label: "Watch minutes",
                        render: (v) => number(v),
                      },
                    ]}
                    empty="Director rankings will appear when films and playback records are available."
                  />
                </Panel>
                <div className="analytics-content-grid">
                  <Panel
                    title="Genre performance"
                    subtitle="Qualified viewer records across approved public films"
                    icon={Film}
                  >
                    <StatusList
                      rows={(intelligence?.genrePerformance || []).map(
                        (item) => ({ label: item.genre, value: item.views }),
                      )}
                    />
                  </Panel>
                  <Panel
                    title="Language performance"
                    subtitle="Qualified viewer records across approved public films"
                    icon={Globe2}
                  >
                    <StatusList
                      rows={(intelligence?.languagePerformance || []).map(
                        (item) => ({ label: item.language, value: item.views }),
                      )}
                    />
                  </Panel>
                </div>
                <Panel
                  title="New-release view windows"
                  subtitle="Qualified-view records for films published in each age window; requires publishedAt or createdAt timestamps"
                  icon={CalendarDays}
                >
                  <div className="analytics-mini-stats">
                    <div>
                      <span>First 7 days</span>
                      <strong>
                        {number(intelligence?.newReleaseViews?.first7Days || 0)}
                      </strong>
                    </div>
                    <div>
                      <span>First 30 days</span>
                      <strong>
                        {number(
                          intelligence?.newReleaseViews?.first30Days || 0,
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>First 90 days</span>
                      <strong>
                        {number(
                          intelligence?.newReleaseViews?.first90Days || 0,
                        )}
                      </strong>
                    </div>
                  </div>
                </Panel>
              </>
            )}

            {role === "admin" && tab === "health" && (
              <>
                <Panel
                  title="API health telemetry"
                  subtitle="Request timing and HTTP status codes recorded by backend middleware during the selected period"
                  icon={ShieldCheck}
                >
                  <div className="analytics-mini-stats">
                    <div>
                      <span>API requests</span>
                      <strong>
                        {number(intelligence?.summary?.apiRequests || 0)}
                      </strong>
                    </div>
                    <div>
                      <span>HTTP errors (4xx/5xx)</span>
                      <strong>
                        {number(intelligence?.summary?.apiErrors || 0)}
                      </strong>
                    </div>
                    <div>
                      <span>Error rate</span>
                      <strong>
                        {intelligence?.summary?.apiErrorRatePercent == null
                          ? "—"
                          : `${intelligence.summary.apiErrorRatePercent}%`}
                      </strong>
                    </div>
                    <div>
                      <span>Average response</span>
                      <strong>
                        {intelligence?.summary?.apiAverageResponseMs == null
                          ? "—"
                          : `${intelligence.summary.apiAverageResponseMs} ms`}
                      </strong>
                    </div>
                    <div>
                      <span>Slowest response</span>
                      <strong>
                        {intelligence?.summary?.apiMaxResponseMs == null
                          ? "—"
                          : `${intelligence.summary.apiMaxResponseMs} ms`}
                      </strong>
                    </div>
                  </div>
                  {!Number(intelligence?.summary?.apiRequests) && (
                    <p className="analytics-muted-copy" style={{ marginTop: 12 }}>
                      No API requests have been recorded yet. Make sure the API
                      telemetry middleware is installed in the backend; numbers
                      appear after the next requests.
                    </p>
                  )}
                </Panel>
                <div className="analytics-info-grid">
                  <InfoState
                    icon={Gauge}
                    title="Player quality telemetry"
                    text={`${number(intelligence?.summary?.playbackErrors || 0)} playback errors and ${number(intelligence?.summary?.bufferEvents || 0)} buffering events were recorded. Startup time, buffering duration, resolution changes and HLS segment errors still need player-specific instrumentation.`}
                  />
                  <InfoState
                    icon={Activity}
                    title="Upload and transcoding health"
                    text="Storage usage, transcoding duration, Cloudinary upload failures and job-level processing metrics still need explicit job instrumentation; they are not inferred from film counts."
                  />
                </div>
              </>
            )}

{role === "director" && tab === "insights" && (
  <>
    {dInsError && <p className="analytics-muted-copy">{dInsError}</p>}
    {!dIns && !dInsError && <p className="analytics-muted-copy">Loading insights…</p>}
    {dIns && (
      <>
        <Panel title="Your best performing films" subtitle="Top third of approved films, ranked by views, completion and engagement" icon={Star}>
          {dIns.best.length === 0 && (
            <p className="analytics-muted-copy">Once your films are approved and watched, your best performers appear here.</p>
          )}
          <div className="insight-grid">
            {dIns.best.map((f) => <InsightFilmCard key={f.videoId} film={f} good />)}
          </div>
        </Panel>

        {dIns.best.length > 0 && (
          <div className="analytics-content-grid">
            <Panel title="Genres and tags that work" subtitle="Weighted by views on your top films" icon={Film}>
              <StatusList
                rows={[...dIns.genreTheme.genres, ...dIns.genreTheme.tags].map((g) => ({ label: g.name, value: g.weight }))}
                empty="No genres or tags on your top films yet."
              />
            </Panel>
            <Panel title="What viewers talk about" subtitle="Themes in reviews and comments on your top films" icon={MessageSquare}>
              <StatusList
                rows={dIns.genreTheme.themes.map((t) => ({ label: t.theme, value: t.mentions }))}
                empty="No review or comment themes yet."
              />
            </Panel>
          </div>
        )}

        {dIns.castBuzz.length > 0 && (
          <Panel title="Cast mentioned by viewers" subtitle="Cast names found in reviews and comments" icon={Heart}>
            <StatusList rows={dIns.castBuzz.map((c) => ({ label: `${c.name} (${c.film})`, value: c.mentions }))} />
          </Panel>
        )}

        <AudiencePanel audience={dIns.audience} title="Who watches your films" subtitle="Viewers of your films in this period" />

        <Panel title="All your other films" subtitle="Click a column to sort, click a row to see why" icon={Film}>
          {dIns.othersTotal === 0 && <p className="analytics-muted-copy">No other approved films yet.</p>}
          {dIns.othersTotal > 0 && (
            <div className="insight-table-wrap">
              <table className="insight-table">
                <thead>
                  <tr>
                    <th>Film</th>
                    {[["views", "Views"], ["completion", "Watched to end"], ["likes", "Likes"], ["rating", "Rating"], ["comments", "Comments"], ["score", "Score"]].map(([k, label]) => (
                      <th key={k}>
                        <button
                          type="button"
                          className="insight-sort"
                          onClick={() => {
                            if (dSort === k) setDOrder(dOrder === "desc" ? "asc" : "desc");
                            else { setDSort(k); setDOrder("desc"); }
                            setDSkip(0);
                            setOpenRow(null);
                          }}
                        >
                          {label}{dSort === k ? (dOrder === "desc" ? " ↓" : " ↑") : ""}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dIns.others.map((f) => (
                    <React.Fragment key={f.videoId}>
                      <tr className="insight-row" onClick={() => setOpenRow(openRow === f.videoId ? null : f.videoId)}>
                        <td>{f.title}</td>
                        <td>{number(f.views)}</td>
                        <td>{f.completionRate == null ? "—" : `${f.completionRate}%`}</td>
                        <td>{f.likeRatio == null ? "—" : `${Math.round(f.likeRatio * 100)}%`}</td>
                        <td>{f.avgRating ? f.avgRating : "—"}</td>
                        <td>{number(f.comments)}</td>
                        <td>{f.score}</td>
                      </tr>
                      {openRow === f.videoId && (
                        <tr className="insight-why">
                          <td colSpan={7}>
                            <strong>Why it did less well</strong>
                            <ul className="insight-reasons">{f.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                            <small>
                              Feedback: {f.sentiment.positive} positive · {f.sentiment.negative} negative · {f.sentiment.neutral} neutral
                            </small>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {dIns.othersTotal > INSIGHT_PAGE && (
            <div className="insight-pager">
              <button type="button" disabled={dSkip === 0} onClick={() => setDSkip(Math.max(0, dSkip - INSIGHT_PAGE))}>Previous</button>
              <span>{dSkip + 1}–{Math.min(dSkip + INSIGHT_PAGE, dIns.othersTotal)} of {dIns.othersTotal}</span>
              <button type="button" disabled={dSkip + INSIGHT_PAGE >= dIns.othersTotal} onClick={() => setDSkip(dSkip + INSIGHT_PAGE)}>Next</button>
            </div>
          )}
        </Panel>

        <p className="analytics-muted-copy">
          Platform average: {number(dIns.platform?.avgViews)} views per film
          {dIns.platform?.completionRate != null ? `, ${dIns.platform.completionRate}% watched to the end` : ""}.{" "}
          {dIns.scoreNote} {dIns.method}
          {dIns.pendingFilms > 0 ? ` ${dIns.pendingFilms} film(s) not yet approved are left out.` : ""}
        </p>
      </>
    )}
  </>
)}
            {role === "director" && tab === "overview" && (
              <Panel
                title="Film activity over time"
                subtitle="Recorded views for your own films"
                icon={Activity}
              >
                <Bars rows={data?.trend || []} dataKey="views" />
              </Panel>
            )}

            {role === "director" && tab === "films" && (
              <Panel
                title="Film-by-film performance"
                subtitle="Complete comparative analysis across reach, viewer sessions, and feedback"
                icon={Film}
              >
                <DataTable
                  rows={data?.videos || []}
                  columns={[
                    { key: "title", label: "Film" },
                    {
                      key: "status",
                      label: "Status",
                      render: (v) => (
                        <span className="analytics-status-pill">
                          {String(v || "—")}
                        </span>
                      ),
                    },
                    { key: "views", label: "Views", render: (v) => number(v) },
                    {
                      key: "sessions",
                      label: "Sessions",
                      render: (v) => number(v),
                    },
                    {
                      key: "reactions",
                      label: "Reactions",
                      render: (v) => number(v),
                    },
                    {
                      key: "reviews",
                      label: "Reviews",
                      render: (v) => number(v),
                    },
                  ]}
                  empty="Upload films to begin measuring performance."
                />
              </Panel>
            )}

            {role === "director" && tab === "engagement" && (
              <>
                <Panel
                  title="Audience retention curve"
                  subtitle="Distinct anonymous sessions with progress samples in each 10% playback band; identifies where viewers engage most or drop off"
                  icon={Gauge}
                >
                  <Bars
                    rows={data?.retentionCurve || []}
                    dataKey="sessions"
                    labelKey="bucket"
                  />
                </Panel>
                <div className="analytics-content-grid">
                  <Panel
                    title="Audience feedback themes"
                    subtitle="Keyword themes found in reviews and comments on your own films"
                    icon={MessageSquare}
                  >
                    <StatusList
                      rows={(data?.feedbackThemes || []).map((item) => ({
                        label: item.theme,
                        value: item.mentions,
                      }))}
                      empty="No review or comment themes yet. They appear once viewers write feedback on your films."
                    />
                    <p className="analytics-muted-copy">
                      Theme counts can overlap when a review mentions more than
                      one topic.
                    </p>
                  </Panel>
                  <Panel
                    title="Feedback language signal"
                    subtitle="Simple keyword matching heuristic across audience feedback"
                    icon={Heart}
                  >
                    <div className="analytics-mini-stats">
                      <div>
                        <span>Positive matches</span>
                        <strong>
                          {number(
                            data?.feedbackSentiment?.positiveKeywordMatches || 0,
                          )}
                        </strong>
                      </div>
                      <div>
                        <span>Constructive matches</span>
                        <strong>
                          {number(
                            data?.feedbackSentiment?.negativeKeywordMatches || 0,
                          )}
                        </strong>
                      </div>
                      <div>
                        <span>Feedback scanned</span>
                        <strong>
                          {number(data?.feedbackSentiment?.analyzedItems || 0)}
                        </strong>
                      </div>
                    </div>
                    <p className="analytics-muted-copy">
                      {data?.feedbackSentiment?.method ||
                        "Keyword matching heuristic; not an AI sentiment model."}
                    </p>
                  </Panel>
                </div>
              </>
            )}

            {role === "viewer" && tab === "overview" && (
              <>
                {viewerGender === "" && (
                  <Panel
                    title="Help us understand the audience"
                    subtitle="Optional: your answer is used only in anonymous audience totals."
                    icon={Users}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        aria-label="Gender"
                        defaultValue=""
                        disabled={genderSaving}
                        onChange={(event) => saveViewerGender(event.target.value)}
                        className="rounded-xl border border-white/[0.08] bg-[#171216] px-3 py-3 text-xs text-[#efe7da]"
                      >
                        <option value="" disabled>Choose an option</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="non_binary">Non-binary</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                      <span className="analytics-muted-copy">You can change this in your profile later.</span>
                    </div>
                  </Panel>
                )}
                <Panel
                  title="Personal library snapshot"
                  subtitle="All-time totals, not limited to the selected period"
                  icon={Heart}
                >
                  <div className="analytics-mini-stats">
                    <div>
                      <span>Watchlist</span>
                      <strong>{number(data?.allTime?.watchlist ?? summary.watchlist)}</strong>
                    </div>
                    <div>
                      <span>Likes</span>
                      <strong>{number(data?.allTime?.likes ?? summary.likes)}</strong>
                    </div>
                    <div>
                      <span>Reviews</span>
                      <strong>{number(data?.allTime?.reviews ?? summary.reviews)}</strong>
                    </div>
                    <div>
                      <span>Comments</span>
                      <strong>{number(data?.allTime?.comments ?? summary.comments)}</strong>
                    </div>
                  </div>
                </Panel>
                <Panel
                  title="Recently watched"
                  subtitle="Pick up where you left off"
                  icon={Film}
                >
                  <DataTable
                    rows={data?.recentVideos || []}
                    columns={[
                      { key: "title", label: "Film" },
                      {
                        key: "progress",
                        label: "Progress",
                        render: (v) => (
                          <div className="analytics-progress">
                            <span
                              style={{
                                width: `${Math.max(0, Math.min(100, Number(v) || 0))}%`,
                              }}
                            />
                          </div>
                        ),
                      },
                      {
                        key: "progress",
                        label: "Watched",
                        render: (v, row) => (
                          <span>
                            {Math.round(Number(v) || 0)}%
                            {row.completed && " ✓"}
                          </span>
                        ),
                      },
                    ]}
                    empty="Your recently watched films will appear here."
                  />
                </Panel>
              </>
            )}

            {role === "viewer" && tab === "trends" && (
              <>
                <div className="analytics-content-grid">
                  <Panel
                    title="Daily viewing timeline"
                    subtitle="Viewing sessions recorded per day in the selected period"
                    icon={CalendarDays}
                  >
                    <Bars rows={data?.trend || []} dataKey="sessions" />
                  </Panel>
                  <Panel
                    title="Session efficiency & habits"
                    subtitle="How you spend time watching on Proscenium"
                    icon={Clock3}
                  >
                    <div className="analytics-mini-stats">
                      <div>
                        <span>Avg. session length</span>
                        <strong>
                          {summary.sessions
                            ? `${Math.round(Number(summary.watchMinutes || 0) / Number(summary.sessions || 1))} min`
                            : "—"}
                        </strong>
                      </div>
                      <div>
                        <span>Total sessions</span>
                        <strong>{number(summary.sessions)}</strong>
                      </div>
                      <div>
                        <span>Busiest day</span>
                        <strong>{busiestDay(data?.trend, "sessions")}</strong>
                      </div>
                    </div>
                    <p className="analytics-muted-copy" style={{ marginTop: 12 }}>
                      Session duration is aggregated from active playback heartbeats during your viewing.
                    </p>
                  </Panel>
                </div>
              </>
            )}

            {role === "viewer" && tab === "taste" && (
              <>
                <div className="analytics-content-grid">
                  <Panel
                    title="Your genre profile"
                    subtitle="Genres of films you watched in the selected period"
                    icon={Heart}
                  >
                    <StatusList
                      rows={(data?.favoriteGenres || []).map((g) => ({
                        label: g.label,
                        value: g.value,
                      }))}
                      empty="Watch a few films in this period to see your genre profile."
                    />
                  </Panel>
                  <Panel
                    title="Preferred languages"
                    subtitle="Languages of films you watched in the selected period"
                    icon={Globe2}
                  >
                    <StatusList
                      rows={(data?.favoriteLanguages || []).map((g) => ({
                        label: g.label,
                        value: g.value,
                      }))}
                      empty="Watch a few films in this period to see your languages."
                    />
                  </Panel>
                </div>
                <Panel
                  title="Directors you watch most"
                  subtitle="Based on films you watched in the selected period"
                  icon={Film}
                >
                  <StatusList
                    rows={(data?.favoriteDirectors || []).map((g) => ({
                      label: g.label,
                      value: g.value,
                    }))}
                    empty="Watch a few films in this period to see your favourite directors."
                  />
                </Panel>
              </>
            )}

            {role === "viewer" && tab === "community" && (
              <>
                <div className="analytics-content-grid">
                  <Panel
                    title="Community catalogue"
                    subtitle="Approved public films available on Proscenium"
                    icon={Globe2}
                  >
                    <div className="analytics-big-number">
                      {number(community?.totalPublicVideos || 0)}
                    </div>
                    <p className="analytics-muted-copy">
                      This is a catalogue count, not a claim about real-time
                      viewers.
                    </p>
                  </Panel>
                  <Panel
                    title="Popular community films"
                    subtitle="Based on recorded view records"
                    icon={TrendingUp}
                  >
                    <DataTable
                      rows={community?.topVideos || []}
                      columns={[
                        { key: "title", label: "Film" },
                        {
                          key: "views",
                          label: "Views",
                          render: (v) => number(v),
                        },
                      ]}
                      empty="Community rankings will appear when viewing data is available."
                    />
                  </Panel>
                </div>
                <InfoState
                  icon={ShieldCheck}
                  title="Privacy note"
                  text="This dashboard shows your personal history only. It does not expose other viewers' individual watch activity."
                />
              </>
            )}

            <Glossary role={role} />
            <div className="analytics-footnote">
              Metrics use records currently available in Proscenium. Page
              engagement begins collecting after the analytics tracker is
              deployed; advertising spend, revenue, profit, detailed playback
              quality and retention curves require their own verified data
              sources.
            </div>
          </>
        )}
      </section>
    </AdminViewContext.Provider>
  );
}