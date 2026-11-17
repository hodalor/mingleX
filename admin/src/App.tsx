import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError, mediaUrl } from "./api";
import { LoveWait } from "./love";
import { showToast } from "./toast";

type Page = "overview" | "members" | "reports" | "matches" | "blocks" | "paid";

type ServiceFlag = {
  id: string;
  label: string;
  detail: string;
  requiresPayment: boolean;
};

type Staff = {
  id: string;
  name: string;
  email: string | null;
  role: string;
};

type Session = { token: string; user: Staff };

type Person = { id: string; name: string; email: string } | null;

type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  age: number | null;
  gender: string;
  bio: string;
  city: string;
  jobTitle: string;
  interests: string[];
  lookingFor: string | null;
  drinking: string | null;
  smoking: string | null;
  workout: string | null;
  pets: string | null;
  education: string | null;
  kids: string | null;
  heightCm: number | null;
  photos: { url: string; isPrimary: boolean; kind?: "image" | "video" }[];
  providers?: string[];
  isBanned: boolean;
  banReason: string;
  deletedAt: string | null;
  deleteReason: string;
  createdAt: string | null;
  lastActiveAt: string | null;
  discoveryRadiusKm: number;
  discoveryMinAge: number;
  discoveryMaxAge: number;
  interestedIn: string[];
  paidAccess: boolean;
  photoCheck?: "none" | "pending" | "verified";
  videoCheck?: "none" | "pending" | "verified";
  verificationPhoto?: string | null;
  verificationVideo?: string | null;
  birthDate?: string | null;
};

type ReportRow = {
  id: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  reporter: Person;
  reportedUser: Person;
};

type MatchRow = {
  id: string;
  matchedAt: string;
  lastMessageAt: string | null;
  userA: Person;
  userB: Person;
};

type BlockRow = {
  id: string;
  createdAt: string;
  blocker: Person;
  blocked: Person;
};

type Stats = {
  users: number;
  matches: number;
  openReports: number;
  bannedUsers: number;
  deletedUsers: number;
  blocks: number;
};

type ModalState =
  | { kind: "member"; member: Member }
  | { kind: "report"; report: ReportRow }
  | { kind: "match"; match: MatchRow }
  | { kind: "block"; block: BlockRow };

const SESSION_KEY = "minglex.admin.session";

const menus: { id: Page; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "members", label: "Members" },
  { id: "reports", label: "Reports" },
  { id: "matches", label: "Matches" },
  { id: "blocks", label: "Blocks" },
  { id: "paid", label: "Paid services" },
];

const pageTitle: Record<Page, string> = {
  overview: "Overview",
  members: "Members",
  reports: "Reports",
  matches: "Matches",
  blocks: "Blocks",
  paid: "Paid services",
};

function loadSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (parsed.user.role !== "admin" || !parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

function when(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function labelOf(person: Person): string {
  if (!person) return "Unknown";
  return person.name || person.email || "Unknown";
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  if (!session) {
    return <Login onSuccess={setSession} />;
  }

  return <Console session={session} onSignOut={signOut} />;
}

function Login(props: { onSuccess: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ token: string; user: Staff }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (result.user.role !== "admin") {
        setError("This console is for mingleX staff.");
        return;
      }
      const next = { token: result.token, user: result.user };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      props.onSuccess(next);
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "Sign-in failed.";
      setError(message);
      showToast(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      {busy && <LoveWait />}
      <form onSubmit={(event) => void submit(event)}>
        <Mark />
        <h1>mingleX</h1>
        <p>Staff sign-in for the web and mobile apps.</p>
        {error && <p className="error">{error}</p>}
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <button className="primary" type="submit" disabled={busy}>Sign in</button>
      </form>
    </main>
  );
}

function Console(props: { session: Session; onSignOut: () => void }) {
  const [page, setPage] = useState<Page>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchTotal, setMatchTotal] = useState(0);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [blockTotal, setBlockTotal] = useState(0);
  const [services, setServices] = useState<ServiceFlag[]>([]);
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [banned, setBanned] = useState("all");
  const [deletedFilter, setDeletedFilter] = useState("active");
  const [status, setStatus] = useState("open");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const token = props.session.token;
    const run = async () => {
      const nextStats = await api<Stats>("/api/admin/stats", {}, token);
      if (page === "overview" || page === "reports") {
        const data = await api<{ total: number; pageSize?: number; reports: ReportRow[] }>(
          `/api/admin/reports?status=${page === "overview" ? "open" : status}&page=${listPage}`,
          {},
          token,
        );
        if (!active) return;
        setReports(data.reports);
        setReportTotal(data.total);
        if (data.pageSize) setPageSize(data.pageSize);
      }
      if (page === "members") {
        const params = new URLSearchParams();
        if (appliedQuery) params.set("q", appliedQuery);
        if (banned !== "all") params.set("banned", banned === "banned" ? "true" : "false");
        params.set("deleted", deletedFilter === "deleted" ? "true" : "false");
        params.set("page", String(listPage));
        const data = await api<{ total: number; pageSize?: number; users: Member[] }>(`/api/admin/users?${params}`, {}, token);
        if (!active) return;
        setMembers(data.users);
        setMemberTotal(data.total);
        if (data.pageSize) setPageSize(data.pageSize);
      }
      if (page === "matches") {
        const data = await api<{ total: number; pageSize?: number; matches: MatchRow[] }>(`/api/admin/matches?page=${listPage}`, {}, token);
        if (!active) return;
        setMatches(data.matches);
        setMatchTotal(data.total);
        if (data.pageSize) setPageSize(data.pageSize);
      }
      if (page === "blocks") {
        const data = await api<{ total: number; pageSize?: number; blocks: BlockRow[] }>(`/api/admin/blocks?page=${listPage}`, {}, token);
        if (!active) return;
        setBlocks(data.blocks);
        setBlockTotal(data.total);
        if (data.pageSize) setPageSize(data.pageSize);
      }
      if (page === "paid") {
        const data = await api<{ services: ServiceFlag[] }>("/api/admin/services", {}, token);
        if (!active) return;
        setServices(data.services);
      }
      if (!active) return;
      setStats(nextStats);
    };
    run()
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof ApiError ? caught.message : "Couldn't load this page.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, appliedQuery, banned, deletedFilter, status, tick, listPage, props.session.token]);

  function refresh() {
    setTick((value) => value + 1);
  }

  async function toggleService(service: ServiceFlag) {
    try {
      const result = await api<{ services: ServiceFlag[] }>("/api/admin/services", {
        method: "PATCH",
        body: JSON.stringify({ [service.id]: !service.requiresPayment }),
      }, props.session.token);
      setServices(result.services);
      showToast(service.requiresPayment ? `${service.label} is free for members.` : `${service.label} now requires payment.`);
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "The switch didn't save.");
    }
  }

  function applyMembers(event: FormEvent) {
    event.preventDefault();
    setListPage(1);
    setAppliedQuery(query.trim());
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Mark />
          <strong>mingleX</strong>
        </div>
        <nav className="menu">
          {menus.map((item) => (
            <button
              key={item.id}
              type="button"
              className={page === item.id ? "selected" : ""}
              onClick={() => {
                setListPage(1);
                setPage(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <h1>{pageTitle[page]}</h1>
          <div className="who">
            <span>{props.session.user.name || props.session.user.email}</span>
            <button type="button" onClick={props.onSignOut}>Sign out</button>
          </div>
        </header>
        <div className="content">
          {error && <p className="error">{error}</p>}
          {loading && <p className="muted">Loading…</p>}
          {!loading && page === "overview" && stats && (
            <>
              <Summary items={[
                ["Members", stats.users],
                ["Matches", stats.matches],
                ["Open reports", stats.openReports],
                ["Banned", stats.bannedUsers],
                ["Deleted", stats.deletedUsers],
              ]} />
              <Table
                columns={["When", "Reason", "Reported", "Status", ""]}
                rows={reports.map((report) => [
                  when(report.createdAt),
                  report.reason,
                  labelOf(report.reportedUser),
                  report.status,
                  <TextButton key={report.id} onClick={() => setModal({ kind: "report", report })}>Open</TextButton>,
                ])}
              />
              <Pager page={listPage} total={reportTotal} pageSize={pageSize} onPage={setListPage} />
            </>
          )}
          {!loading && page === "members" && (
            <>
              <form className="filters" onSubmit={applyMembers}>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or email" />
                <select value={deletedFilter} onChange={(event) => { setListPage(1); setDeletedFilter(event.target.value); }}>
                  <option value="active">Live accounts</option>
                  <option value="deleted">Deleted accounts</option>
                </select>
                <select value={banned} onChange={(event) => { setListPage(1); setBanned(event.target.value); }}>
                  <option value="all">All statuses</option>
                  <option value="active">Not banned</option>
                  <option value="banned">Banned</option>
                </select>
                <button className="primary" type="submit">Apply</button>
              </form>
              <Summary items={[
                ["In this view", memberTotal],
                ["Banned", stats?.bannedUsers ?? 0],
                ["Deleted kept for staff", stats?.deletedUsers ?? 0],
              ]} />
              <Table
                columns={["Name", "Email", "Age", "Status", "Joined", ""]}
                rows={members.map((member) => [
                  member.name || "—",
                  member.email ?? "—",
                  member.age ?? "—",
                  member.deletedAt ? "Deleted" : member.isBanned ? "Banned" : "Active",
                  when(member.createdAt),
                  <TextButton key={member.id} onClick={() => setModal({ kind: "member", member })}>Open</TextButton>,
                ])}
              />
              <Pager page={listPage} total={memberTotal} pageSize={pageSize} onPage={setListPage} />
            </>
          )}
          {!loading && page === "reports" && (
            <>
              <form className="filters" onSubmit={(event) => event.preventDefault()}>
                <select value={status} onChange={(event) => { setListPage(1); setStatus(event.target.value); }}>
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </form>
              <Summary items={[["In this view", reportTotal], ["Open in the app", stats?.openReports ?? 0]]} />
              <Table
                columns={["When", "Reason", "Reporter", "Reported", "Status", ""]}
                rows={reports.map((report) => [
                  when(report.createdAt),
                  report.reason,
                  labelOf(report.reporter),
                  labelOf(report.reportedUser),
                  report.status,
                  <TextButton key={report.id} onClick={() => setModal({ kind: "report", report })}>Open</TextButton>,
                ])}
              />
              <Pager page={listPage} total={reportTotal} pageSize={pageSize} onPage={setListPage} />
            </>
          )}
          {!loading && page === "matches" && (
            <>
              <Summary items={[["Matches", matchTotal]]} />
              <Table
                columns={["Person", "Person", "Matched", "Last message", ""]}
                rows={matches.map((match) => [
                  labelOf(match.userA),
                  labelOf(match.userB),
                  when(match.matchedAt),
                  when(match.lastMessageAt),
                  <TextButton key={match.id} onClick={() => setModal({ kind: "match", match })}>Open</TextButton>,
                ])}
              />
              <Pager page={listPage} total={matchTotal} pageSize={pageSize} onPage={setListPage} />
            </>
          )}
          {!loading && page === "blocks" && (
            <>
              <Summary items={[["Blocks", blockTotal]]} />
              <Table
                columns={["Blocker", "Blocked", "When", ""]}
                rows={blocks.map((block) => [
                  labelOf(block.blocker),
                  labelOf(block.blocked),
                  when(block.createdAt),
                  <TextButton key={block.id} onClick={() => setModal({ kind: "block", block })}>Open</TextButton>,
                ])}
              />
              <Pager page={listPage} total={blockTotal} pageSize={pageSize} onPage={setListPage} />
            </>
          )}
          {!loading && page === "paid" && (
            <>
              <p className="muted">Off means every member can use it. On means only members with paid access can use it. Every switch starts off.</p>
              <Summary items={[["Requires payment", services.filter((item) => item.requiresPayment).length], ["Free for everyone", services.filter((item) => !item.requiresPayment).length]]} />
              <Table
                columns={["Feature", "What it does", "Access", ""]}
                rows={services.map((service) => [
                  service.label,
                  service.detail,
                  service.requiresPayment ? "Paid" : "Free",
                  <TextButton key={service.id} onClick={() => void toggleService(service)}>
                    {service.requiresPayment ? "Make free" : "Require payment"}
                  </TextButton>,
                ])}
              />
            </>
          )}
        </div>
      </section>
      {modal && (
        <Modal title={modalTitle(modal)} onClose={() => setModal(null)}>
          {modal.kind === "member" && (
            <MemberDetail
              token={props.session.token}
              member={modal.member}
              onChanged={(member) => {
                setMembers((items) => items.map((item) => item.id === member.id ? member : item));
                setModal({ kind: "member", member });
                refresh();
              }}
            />
          )}
          {modal.kind === "report" && (
            <ReportDetail
              token={props.session.token}
              report={modal.report}
              onChanged={(report) => {
                setReports((items) => items.map((item) => item.id === report.id ? report : item));
                setModal({ kind: "report", report });
                refresh();
              }}
            />
          )}
          {modal.kind === "match" && <MatchDetail match={modal.match} />}
          {modal.kind === "block" && <BlockDetail block={modal.block} />}
        </Modal>
      )}
    </div>
  );
}

function modalTitle(modal: ModalState): string {
  if (modal.kind === "member") return modal.member.name || "Member";
  if (modal.kind === "report") return "Report";
  if (modal.kind === "match") return "Match";
  return "Block";
}

const habitLabels: Record<string, string> = { never: "Never", socially: "Socially", often: "Regularly" };
const workoutLabels: Record<string, string> = { never: "Never", sometimes: "Sometimes", often: "Often" };
const petLabels: Record<string, string> = { dog: "Dog", cat: "Cat", both: "Dog and cat", none: "No pets", other: "Other pets" };
const kidLabels: Record<string, string> = { want: "Want someday", have: "Have kids", dont_want: "Don't want", not_sure: "Not sure" };
const educationLabels: Record<string, string> = { high_school: "High school", college: "College", grad: "Graduate school" };
const lookingForLabels: Record<string, string> = {
  relationship: "A relationship",
  casual: "Something casual",
  friends: "New friends",
  not_sure: "Not sure yet",
};

function choiceLabel(code: string | null | undefined, labels: Record<string, string>): string {
  if (!code) return "—";
  return labels[code] ?? code;
}

function MemberDetail(props: { token: string; member: Member; onChanged: (member: Member) => void }) {
  const [reason, setReason] = useState(props.member.banReason);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; video: boolean; label: string } | null>(null);
  const member = props.member;

  async function grant(paidAccess: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: Member }>(`/api/admin/users/${member.id}/access`, {
        method: "PATCH",
        body: JSON.stringify({ paidAccess }),
      }, props.token);
      props.onChanged(result.user);
      showToast(paidAccess ? "Paid access granted." : "Paid access removed.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Paid access didn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function review(kind: "photo" | "video", value: "verified" | "none") {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: Member }>(`/api/admin/users/${member.id}/verification`, {
        method: "PATCH",
        body: JSON.stringify({ [kind]: value }),
      }, props.token);
      props.onChanged(result.user);
      showToast(value === "verified" ? "Check approved." : "Check rejected.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The check didn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function ban(banned: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: Member }>(`/api/admin/users/${member.id}/ban`, {
        method: "PATCH",
        body: JSON.stringify({ banned, reason: reason.trim() }),
      }, props.token);
      props.onChanged(result.user);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The ban didn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="media-block">
        <h3>Profile media</h3>
        {member.photos.length === 0 ? (
          <p className="muted">No photos or videos on this profile.</p>
        ) : (
          <div className="media-grid">
            {member.photos.map((item) => {
              const src = mediaUrl(item.url);
              const video = item.kind === "video";
              return (
                <button
                  key={item.url}
                  type="button"
                  className={`media-thumb${item.isPrimary ? " main" : ""}`}
                  onClick={() => setPreview({ url: src, video, label: item.isPrimary ? "Main" : video ? "Video" : "Photo" })}
                >
                  {video ? <video src={src} muted /> : <img src={src} alt="" />}
                  <span>{item.isPrimary ? "Main" : video ? "Video" : "Photo"}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="media-block">
        <h3>Verification submissions</h3>
        <p className="muted">
          Photo check: {member.photoCheck ?? "none"}
          {member.photoCheck === "verified" ? " ✓" : ""}. Video check: {member.videoCheck ?? "none"}
          {member.videoCheck === "verified" ? " ✓" : ""}.
        </p>
        <div className="media-grid">
          {member.verificationPhoto ? (
            <button
              type="button"
              className="media-thumb"
              onClick={() => setPreview({ url: mediaUrl(member.verificationPhoto!), video: false, label: "Photo check" })}
            >
              <img src={mediaUrl(member.verificationPhoto)} alt="" />
              <span>Photo check</span>
            </button>
          ) : (
            <p className="muted">No verification photo.</p>
          )}
          {member.verificationVideo ? (
            <button
              type="button"
              className="media-thumb"
              onClick={() => setPreview({ url: mediaUrl(member.verificationVideo!), video: true, label: "Video check" })}
            >
              <video src={mediaUrl(member.verificationVideo)} muted />
              <span>Video check</span>
            </button>
          ) : (
            <p className="muted">No verification video.</p>
          )}
        </div>
      </section>

      <dl>
        <dt>Email</dt><dd>{member.email ?? "—"}</dd>
        <dt>Phone</dt><dd>{member.phone ?? "—"}</dd>
        <dt>Providers</dt><dd>{(member.providers ?? []).join(", ") || "—"}</dd>
        <dt>Birthday</dt><dd>{member.birthDate ?? "—"}</dd>
        <dt>Age</dt><dd>{member.age ?? "—"}</dd>
        <dt>Gender</dt><dd>{member.gender || "—"}</dd>
        <dt>City</dt><dd>{member.city || "—"}</dd>
        <dt>Work</dt><dd>{member.jobTitle || "—"}</dd>
        <dt>Bio</dt><dd>{member.bio || "—"}</dd>
        <dt>Looking for</dt><dd>{choiceLabel(member.lookingFor, lookingForLabels)}</dd>
        <dt>Drinking</dt><dd>{choiceLabel(member.drinking, habitLabels)}</dd>
        <dt>Smoking</dt><dd>{choiceLabel(member.smoking, habitLabels)}</dd>
        <dt>Workout</dt><dd>{choiceLabel(member.workout, workoutLabels)}</dd>
        <dt>Pets</dt><dd>{choiceLabel(member.pets, petLabels)}</dd>
        <dt>Kids</dt><dd>{choiceLabel(member.kids, kidLabels)}</dd>
        <dt>Education</dt><dd>{choiceLabel(member.education, educationLabels)}</dd>
        <dt>Height</dt><dd>{member.heightCm ? `${member.heightCm} cm` : "—"}</dd>
        <dt>Interests</dt><dd>{member.interests.join(", ") || "—"}</dd>
        <dt>Shows</dt><dd>{member.interestedIn.join(", ") || "—"}</dd>
        <dt>Distance</dt><dd>{member.discoveryRadiusKm} km</dd>
        <dt>Ages</dt><dd>{member.discoveryMinAge}–{member.discoveryMaxAge}</dd>
        <dt>Paid access</dt><dd>{member.paidAccess ? "Yes" : "No"}</dd>
        <dt>Joined</dt><dd>{when(member.createdAt)}</dd>
        <dt>Last active</dt><dd>{when(member.lastActiveAt)}</dd>
        <dt>Deleted</dt><dd>{member.deletedAt ? when(member.deletedAt) : "No"}</dd>
        <dt>Delete reason</dt><dd>{member.deleteReason || "—"}</dd>
      </dl>
      {error && <p className="error">{error}</p>}
      {member.deletedAt ? (
        <p className="muted">This account deleted itself. It stays here for staff audit only and cannot sign in or appear in discovery.</p>
      ) : (
        <>
          <label>
            Ban reason
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          </label>
          <div className="actions">
            {member.isBanned ? (
              <button className="primary" type="button" disabled={busy} onClick={() => void ban(false)}>Unban</button>
            ) : (
              <button className="danger" type="button" disabled={busy} onClick={() => void ban(true)}>Ban from the apps</button>
            )}
            <button className="primary" type="button" disabled={busy} onClick={() => void review("photo", "verified")}>Approve photo ✓</button>
            <button type="button" disabled={busy} onClick={() => void review("photo", "none")}>Reject photo</button>
            <button className="primary" type="button" disabled={busy} onClick={() => void review("video", "verified")}>Approve video ✓</button>
            <button type="button" disabled={busy} onClick={() => void review("video", "none")}>Reject video</button>
            <button className="primary" type="button" disabled={busy} onClick={() => void grant(!member.paidAccess)}>
              {member.paidAccess ? "Remove paid access" : "Grant paid access"}
            </button>
          </div>
        </>
      )}
      {preview && (
        <div className="preview-layer" role="dialog" aria-modal="true">
          <button className="preview-backdrop" type="button" aria-label="Close preview" onClick={() => setPreview(null)} />
          <div className="preview-frame">
            <div className="preview-top">
              <strong>{preview.label}</strong>
              <button type="button" onClick={() => setPreview(null)}>Close</button>
            </div>
            {preview.video ? (
              <video src={preview.url} controls autoPlay playsInline />
            ) : (
              <img src={preview.url} alt={preview.label} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ReportDetail(props: { token: string; report: ReportRow; onChanged: (report: ReportRow) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setStatus(status: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/reports/${props.report.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }, props.token);
      props.onChanged({ ...props.report, status });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The status didn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function banReported() {
    if (!props.report.reportedUser) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/users/${props.report.reportedUser.id}/ban`, {
        method: "PATCH",
        body: JSON.stringify({ banned: true, reason: props.report.reason }),
      }, props.token);
      await setStatus("reviewing");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The ban didn't save.");
      setBusy(false);
    }
  }

  return (
    <>
      <dl>
        <dt>Reason</dt><dd>{props.report.reason}</dd>
        <dt>Details</dt><dd>{props.report.details || "—"}</dd>
        <dt>Reporter</dt><dd>{labelOf(props.report.reporter)}</dd>
        <dt>Reported</dt><dd>{labelOf(props.report.reportedUser)}</dd>
        <dt>Status</dt><dd>{props.report.status}</dd>
        <dt>When</dt><dd>{when(props.report.createdAt)}</dd>
      </dl>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="ghost" type="button" disabled={busy} onClick={() => void setStatus("reviewing")}>Mark reviewing</button>
        <button className="primary" type="button" disabled={busy} onClick={() => void setStatus("resolved")}>Resolve</button>
        <button className="ghost" type="button" disabled={busy} onClick={() => void setStatus("dismissed")}>Dismiss</button>
        <button className="danger" type="button" disabled={busy || !props.report.reportedUser} onClick={() => void banReported()}>Ban reported member</button>
      </div>
    </>
  );
}

function MatchDetail(props: { match: MatchRow }) {
  return (
    <dl>
      <dt>First person</dt><dd>{labelOf(props.match.userA)}{props.match.userA?.email ? ` · ${props.match.userA.email}` : ""}</dd>
      <dt>Second person</dt><dd>{labelOf(props.match.userB)}{props.match.userB?.email ? ` · ${props.match.userB.email}` : ""}</dd>
      <dt>Matched</dt><dd>{when(props.match.matchedAt)}</dd>
      <dt>Last message</dt><dd>{when(props.match.lastMessageAt)}</dd>
    </dl>
  );
}

function BlockDetail(props: { block: BlockRow }) {
  return (
    <dl>
      <dt>Blocker</dt><dd>{labelOf(props.block.blocker)}{props.block.blocker?.email ? ` · ${props.block.blocker.email}` : ""}</dd>
      <dt>Blocked</dt><dd>{labelOf(props.block.blocked)}{props.block.blocked?.email ? ` · ${props.block.blocked.email}` : ""}</dd>
      <dt>When</dt><dd>{when(props.block.createdAt)}</dd>
    </dl>
  );
}

function Pager(props: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(props.total / props.pageSize));
  const page = Math.min(props.page, pages);
  return (
    <div className="pager">
      <button type="button" disabled={page <= 1} onClick={() => props.onPage(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => props.onPage(page + 1)}>Next</button>
    </div>
  );
}

function Summary(props: { items: [string, number][] }) {
  return (
    <div className="summary">
      {props.items.map(([name, value]) => (
        <article key={name}>
          <span>{name}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function Table(props: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{props.columns.map((column) => <th key={column || "action"}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {props.rows.length === 0 && (
            <tr><td colSpan={props.columns.length}>Nothing to show.</td></tr>
          )}
          {props.rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TextButton(props: { onClick: () => void; children: ReactNode }) {
  return <button className="link" type="button" onClick={props.onClick}>{props.children}</button>;
}

function Modal(props: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  return (
    <div className="backdrop" onClick={props.onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={props.title} onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{props.title}</h2>
          <button type="button" onClick={props.onClose} aria-label="Close">×</button>
        </header>
        <div className="modal-body">{props.children}</div>
      </div>
    </div>
  );
}

function Mark() {
  return <img className="mark" src="/logo.png" alt="" width={42} height={42} />;
}
