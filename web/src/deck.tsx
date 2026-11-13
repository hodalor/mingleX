import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { api, ApiError, mediaUrl, uploadPhoto } from "./api";
import { LoveWait } from "./love";
import { MyProfile } from "./profile";
import { showToast } from "./toast";

type Photo = { url: string; isPrimary: boolean; kind?: "image" | "video" };

export type Profile = {
  id: string;
  name: string;
  age: number | null;
  bio: string;
  city: string;
  jobTitle: string;
  interests: string[];
  lookingFor?: string | null;
  drinking?: string | null;
  smoking?: string | null;
  workout?: string | null;
  pets?: string | null;
  education?: string | null;
  kids?: string | null;
  heightCm?: number | null;
  photos: Photo[];
  gender?: string;
  distanceKm?: number;
  phone?: string | null;
  verified?: boolean;
  videoVerified?: boolean;
};

type DiscoverResponse = {
  profiles: Profile[];
  profileIncomplete: boolean;
  locationRequired: boolean;
};

type Match = {
  id: string;
  otherUser: Profile;
  unread?: number;
  pending?: boolean;
};

type RequestPerson = Profile & { superLike?: boolean };

type Access = Record<string, boolean>;

type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  readAt: string | null;
};

type Tab = "deck" | "matches" | "chat" | "settings" | "profile";

type Opened =
  | { kind: "match"; match: Match }
  | { kind: "incoming" | "outgoing"; person: RequestPerson };

function primaryPhoto(profile: Profile): string | undefined {
  const url = profile.photos.find((photo) => photo.isPrimary)?.url ?? profile.photos[0]?.url;
  return mediaUrl(url);
}

function profileTitle(profile: Profile): string {
  return profile.age ? `${profile.name}, ${profile.age}` : profile.name;
}

export function DeckApp(props: { token: string; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("deck");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [incomplete, setIncomplete] = useState(false);
  const [locationRequired, setLocationRequired] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [incoming, setIncoming] = useState<RequestPerson[]>([]);
  const [outgoing, setOutgoing] = useState<RequestPerson[]>([]);
  const [incomingLocked, setIncomingLocked] = useState(false);
  const [peopleTab, setPeopleTab] = useState<"matches" | "incoming" | "outgoing">("matches");
  const [menuOpen, setMenuOpen] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [access, setAccess] = useState<Access>({});
  const [showPlusNote, setShowPlusNote] = useState(false);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [celebration, setCelebration] = useState<Match | null>(null);
  const [hello, setHello] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [safety, setSafety] = useState<Profile | null>(null);
  const [safetyStep, setSafetyStep] = useState<"menu" | "report">("menu");
  const [reason, setReason] = useState<"harassment" | "fake" | "spam" | "underage" | "other">("harassment");
  const [details, setDetails] = useState("");
  const [cardPhoto, setCardPhoto] = useState(0);

  async function loadDeck() {
    const data = await api<DiscoverResponse>("/api/discover?limit=20", {}, props.token);
    setIncomplete(data.profileIncomplete);
    setLocationRequired(data.locationRequired);
    setProfiles(data.profiles);
  }

  async function loadMatches() {
    const [data, requests, features] = await Promise.all([
      api<{ matches: Match[] }>("/api/matches", {}, props.token),
      api<{ incoming: RequestPerson[]; outgoing: RequestPerson[]; incomingLocked: boolean }>("/api/requests", {}, props.token),
      api<{ access: Access; showPlusNote: boolean }>("/api/features", {}, props.token),
    ]);
    setMatches(data.matches);
    setIncoming(requests.incoming);
    setOutgoing(requests.outgoing);
    setIncomingLocked(requests.incomingLocked);
    setAccess(features.access);
    setShowPlusNote(features.showPlusNote);
  }

  async function reload() {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadDeck(), loadMatches()]);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Couldn't load the deck.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // Reload when the signed-in account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.token]);

  const current = profiles[0];
  const deckPhotos = current
    ? [...current.photos.filter((item) => item.isPrimary), ...current.photos.filter((item) => !item.isPrimary)]
    : [];
  const shownPhoto = deckPhotos[cardPhoto] ?? deckPhotos[0];

  useEffect(() => {
    setCardPhoto(0);
  }, [current?.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (tab !== "deck" || !current || celebration || busy) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft") void swipe("pass");
      if (event.key === "ArrowRight") void swipe("like");
      if (event.key === "ArrowUp") void swipe("super");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function swipe(direction: "like" | "pass" | "super") {
    if (!current || busy) return;
    const card = current;
    setBusy(true);
    setError("");
    setProfiles((items) => items.slice(1));
    try {
      const result = await api<{ match: Match | null }>("/api/swipes", {
        method: "POST",
        body: JSON.stringify({ toUserId: card.id, direction }),
      }, props.token);
      if (result.match && !result.match.pending) {
        setCelebration(result.match);
        setMatches((items) => [result.match as Match, ...items.filter((item) => item.id !== result.match?.id)]);
        showToast(`You matched with ${result.match.otherUser.name}.`);
      } else if (direction === "like") {
        showToast("Like sent. They can accept it from Requests.");
      } else if (direction === "super") {
        showToast("Super Like sent.");
      }
    } catch (caught) {
      setProfiles((items) => [card, ...items]);
      const message = caught instanceof ApiError ? caught.message : "That swipe didn't save.";
      setError(message);
      showToast(message);
    } finally {
      setBusy(false);
    }
  }

  async function removePerson(profile: Profile, request: () => Promise<void>) {
    setBusy(true);
    setError("");
    setProfiles((items) => items.filter((item) => item.id !== profile.id));
    setMatches((items) => items.filter((item) => item.otherUser.id !== profile.id));
    if (activeMatch?.otherUser.id === profile.id) {
      setActiveMatch(null);
      setTab("matches");
    }
    setSafety(null);
    try {
      await request();
    } catch (caught) {
      setProfiles((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
      setError(caught instanceof ApiError ? caught.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  function openSafety(profile: Profile) {
    setReason("harassment");
    setDetails("");
    setSafetyStep("menu");
    setSafety(profile);
  }

  const reasons = [
    ["harassment", "Harassment"],
    ["fake", "Fake profile"],
    ["spam", "Spam"],
    ["underage", "Under 18"],
    ["other", "Something else"],
  ] as const;

  async function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await uploadPhoto(file, props.token);
      await loadDeck();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That photo didn't upload.");
    } finally {
      setBusy(false);
    }
  }

  function shareLocation() {
    if (!navigator.geolocation) {
      setError("This browser can't share a location.");
      return;
    }
    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void api("/api/me", {
          method: "PATCH",
          body: JSON.stringify({
            location: { lng: position.coords.longitude, lat: position.coords.latitude },
          }),
        }, props.token)
          .then(() => loadDeck())
          .catch((caught: unknown) => {
            setError(caught instanceof ApiError ? caught.message : "Location didn't save.");
          })
          .finally(() => setBusy(false));
      },
      () => {
        setBusy(false);
        setError("Location stays off until you allow it. You can still swipe.");
      },
    );
  }

  async function sendHello(event: FormEvent) {
    event.preventDefault();
    if (!celebration || !hello.trim()) return;
    setBusy(true);
    try {
      await api(`/api/matches/${celebration.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: hello.trim() }),
      }, props.token);
      setHello("");
      setActiveMatch(celebration);
      setCelebration(null);
      setTab("chat");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The message didn't send.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(userId: string, direction: "like" | "pass") {
    setBusy(true);
    try {
      const result = await api<{ match: Match | null }>("/api/swipes", {
        method: "POST",
        body: JSON.stringify({ toUserId: userId, direction }),
      }, props.token);
      if (result.match && !result.match.pending) showToast(`You matched with ${result.match.otherUser.name}.`);
      else showToast(direction === "like" ? "Like sent." : "Passed.");
      await loadMatches();
      return true;
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "That didn't save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function openThread(userId: string) {
    setBusy(true);
    try {
      const result = await api<{ match: Match }>(`/api/requests/${userId}/thread`, { method: "POST" }, props.token);
      setActiveMatch(result.match);
      setTab("chat");
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "That chat isn't open.");
    } finally {
      setBusy(false);
    }
  }

  async function rewind() {
    setBusy(true);
    try {
      const result = await api<{ profile: Profile | null }>("/api/swipes/rewind", { method: "POST" }, props.token);
      if (result.profile) setProfiles((items) => [result.profile as Profile, ...items.filter((item) => item.id !== result.profile?.id)]);
      showToast("Last swipe undone.");
      await loadMatches();
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "Nothing to undo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="deck">
      {busy && <LoveWait />}
      <header className="deck-top">
        <strong>mingleX</strong>
        <div className="account-menu">
          <button type="button" className="text-btn" aria-label="Account" onClick={() => setMenuOpen((open) => !open)}>···</button>
          {menuOpen && (
            <>
              <button className="menu-backdrop" type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
              <div className="account-pop">
                <button type="button" onClick={() => { setMenuOpen(false); setOpened(null); setTab("profile"); }}>My profile</button>
                <button type="button" onClick={props.onSignOut}>Sign out</button>
              </div>
            </>
          )}
        </div>
      </header>
      <div className="deck-body">
      {error && (
        <div className="stack">
          <p className="error">{error}</p>
          <button className="auth-btn outline" type="button" onClick={() => void reload()}>Try again</button>
        </div>
      )}
      {loading && <p className="home-copy">Loading the deck…</p>}
      {!loading && tab === "deck" && incomplete && (
        <form className="stack">
          <h1 className="form-title">Add a photo</h1>
          <p className="home-copy">People only see you after your first photo. JPEG, PNG, or WEBP up to 5 MB, or one MP4, WEBM, or MOV video up to 25 MB.</p>
          <label className="file-pick">
            Choose a photo or video
            <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={(event) => void onPhotoSelected(event)} disabled={busy} />
          </label>
        </form>
      )}
      {!loading && tab === "deck" && !incomplete && current && (
        <>
          <article className="deck-card" style={shownPhoto && shownPhoto.kind !== "video" ? { backgroundImage: `url("${mediaUrl(shownPhoto.url)}")` } : undefined}>
            {shownPhoto?.kind === "video" && <video className="deck-video" src={mediaUrl(shownPhoto.url)} playsInline autoPlay muted loop />}
            {deckPhotos.length > 1 && (
              <div className="photo-bars" aria-hidden="true">
                {deckPhotos.map((item, index) => <span key={item.url} className={index === cardPhoto ? "on" : ""} />)}
              </div>
            )}
            {deckPhotos.length > 1 && (
              <>
                <button className="card-zone left" type="button" aria-label="Previous photo" onClick={() => setCardPhoto((index) => Math.max(0, index - 1))} />
                <button className="card-zone right" type="button" aria-label="Next photo" onClick={() => setCardPhoto((index) => Math.min(deckPhotos.length - 1, index + 1))} />
              </>
            )}
            <button className="card-menu" type="button" disabled={busy} onClick={() => openSafety(current)} aria-label="Report or block">···</button>
            <div className="deck-meta">
              <h2>{profileTitle(current)}{current.verified ? " · Verified" : ""}{current.videoVerified ? " · Video" : ""}</h2>
              <p>
                {[current.jobTitle, current.city, current.distanceKm !== undefined ? `${current.distanceKm} km away` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {current.bio && <p>{current.bio}</p>}
              {profileFacts(current).length > 0 && (
                <div className="chips">
                  {profileFacts(current).map((fact) => <span key={fact}>{fact}</span>)}
                </div>
              )}
              {current.interests.length > 0 && (
                <div className="chips">
                  {current.interests.map((interest) => <span key={interest}>{interest}</span>)}
                </div>
              )}
            </div>
          </article>
          {showPlusNote && <p className="home-copy">mingleX Plus keeps this note off the deck.</p>}
          <div className="deck-actions">
            <button className="round pass" type="button" disabled={busy} onClick={() => void swipe("pass")} aria-label="Pass">✕</button>
            <button className="round like" type="button" disabled={busy} onClick={() => void swipe("super")} aria-label="Super Like">★</button>
            <button className="round like" type="button" disabled={busy} onClick={() => void swipe("like")} aria-label="Like">♥</button>
          </div>
          <button className="text-btn" type="button" disabled={busy} onClick={() => void rewind()}>Rewind</button>
          {locationRequired && current.distanceKm === undefined && (
            <button className="auth-btn outline" type="button" disabled={busy} onClick={shareLocation}>
              Use my location
            </button>
          )}
        </>
      )}
      {!loading && tab === "deck" && !incomplete && !current && !error && (
        <div className="stack">
          <h1 className="form-title">You're caught up</h1>
          <p className="home-copy">No new people in your deck. Check back after more members join.</p>
          <button className="auth-btn outline" type="button" onClick={() => void reload()}>Refresh</button>
        </div>
      )}
      {!loading && tab === "matches" && !opened && (
        <div className="stack">
          <h1 className="form-title">People</h1>
          <div className="segment">
            <button type="button" className={peopleTab === "matches" ? "selected" : ""} onClick={() => setPeopleTab("matches")}>Matches</button>
            <button type="button" className={peopleTab === "incoming" ? "selected" : ""} onClick={() => setPeopleTab("incoming")}>Requests</button>
            <button type="button" className={peopleTab === "outgoing" ? "selected" : ""} onClick={() => setPeopleTab("outgoing")}>Sent</button>
          </div>
          {peopleTab === "matches" && matches.length === 0 && <p className="home-copy">When you both say yes, the match shows up here.</p>}
          {peopleTab === "matches" && (
            <div className="people-grid">
              {matches.map((match) => (
                <button key={match.id} className="people-card" type="button" style={{ backgroundImage: `url("${primaryPhoto(match.otherUser) ?? ""}")` }} onClick={() => setOpened({ kind: "match", match })}>
                  <span>{profileTitle(match.otherUser)}</span>
                  {(match.unread ?? 0) > 0 && <strong className="unread">{match.unread}</strong>}
                </button>
              ))}
            </div>
          )}
          {peopleTab === "incoming" && incomingLocked && <p className="home-copy">See who likes you is a paid feature.</p>}
          {peopleTab === "incoming" && !incomingLocked && incoming.length === 0 && <p className="home-copy">No one is waiting on your answer.</p>}
          {peopleTab === "incoming" && !incomingLocked && (
            <div className="people-grid">
              {incoming.map((person) => (
                <button key={person.id} className="people-card" type="button" style={{ backgroundImage: `url("${primaryPhoto(person) ?? ""}")` }} onClick={() => setOpened({ kind: "incoming", person })}>
                  <span>{profileTitle(person)}{person.superLike ? " · Super Like" : ""}</span>
                </button>
              ))}
            </div>
          )}
          {peopleTab === "outgoing" && outgoing.length === 0 && <p className="home-copy">Likes you send show here until they answer.</p>}
          {peopleTab === "outgoing" && (
            <div className="people-grid">
              {outgoing.map((person) => (
                <button key={person.id} className="people-card" type="button" style={{ backgroundImage: `url("${primaryPhoto(person) ?? ""}")` }} onClick={() => setOpened({ kind: "outgoing", person })}>
                  <span>{profileTitle(person)} · Waiting</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!loading && tab === "matches" && opened && (
        <PersonDetail
          opened={opened}
          onBack={() => setOpened(null)}
          onMessage={() => {
            if (opened.kind === "match") {
              if (access.matchChat === false) {
                showToast("Chat with matches is a paid feature.");
                return;
              }
              setActiveMatch(opened.match);
              setTab("chat");
              return;
            }
            void openThread(opened.person.id);
          }}
          onDecide={(direction) => {
            if (opened.kind === "match") return;
            void decide(opened.person.id, direction).then((saved) => {
              if (saved) setOpened(null);
            });
          }}
        />
      )}
      {!loading && tab === "chat" && activeMatch && (
        <Chat
          token={props.token}
          match={activeMatch}
          onBack={() => {
            setTab("matches");
            void loadMatches();
          }}
          onSafety={() => openSafety(activeMatch.otherUser)}
          onLeave={() => {
            showToast(activeMatch.pending ? "Request removed." : "You left the match.");
            setActiveMatch(null);
            setTab("matches");
            void loadMatches();
          }}
        />
      )}
      {tab === "settings" && (
        <div className="settings">
          <DiscoverySettings token={props.token} onSaved={() => void loadDeck()} />
          <PlusCheckout token={props.token} />
          <AboutYou token={props.token} />
        </div>
      )}
      {tab === "profile" && <MyProfile token={props.token} />}
      </div>
      <nav className="tabbar">
        <button type="button" className={tab === "deck" ? "selected" : ""} onClick={() => { setOpened(null); setTab("deck"); }}>Discover</button>
        <button type="button" className={tab === "matches" || tab === "chat" ? "selected" : ""} onClick={() => {
          if (tab === "chat") void loadMatches();
          setOpened(null);
          setTab("matches");
        }}>Matches</button>
        <button type="button" className={tab === "settings" ? "selected" : ""} onClick={() => { setOpened(null); setTab("settings"); }}>Settings</button>
      </nav>
      {safety && (
        <div className="safety-layer">
          <form
            className="safety-sheet"
            onSubmit={(event) => {
              event.preventDefault();
              if (safetyStep !== "report") return;
              const profile = safety;
              void removePerson(profile, () =>
                api("/api/reports", {
                  method: "POST",
                  body: JSON.stringify({
                    reportedUserId: profile.id,
                    reason,
                    details: details.trim() || undefined,
                  }),
                }, props.token),
              );
            }}
          >
            <h2>{safetyStep === "menu" ? safety.name : `Report ${safety.name}`}</h2>
            {safetyStep === "menu" ? (
              <>
                <p className="home-copy">Blocking hides you from each other. A report also goes to mingleX staff.</p>
                <button
                  className="submit"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const profile = safety;
                    void removePerson(profile, () =>
                      api("/api/blocks", {
                        method: "POST",
                        body: JSON.stringify({ userId: profile.id }),
                      }, props.token),
                    );
                  }}
                >
                  Block
                </button>
                <button className="auth-btn outline" type="button" onClick={() => setSafetyStep("report")}>Report</button>
              </>
            ) : (
              <>
                <div className="choices">
                  {reasons.map(([value, label]) => (
                    <button
                      key={value}
                      className={reason === value ? "choice selected" : "choice"}
                      type="button"
                      onClick={() => setReason(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  value={details}
                  placeholder="Add a detail, if you want"
                  onChange={(event) => setDetails(event.target.value)}
                />
                <button className="submit" type="submit" disabled={busy}>Send report</button>
              </>
            )}
            <button className="text-btn" type="button" onClick={() => setSafety(null)}>Cancel</button>
          </form>
        </div>
      )}
      {celebration && (
        <div className="match-layer">
          <p className="eyebrow">It's a match</p>
          <h2>You and {celebration.otherUser.name} liked each other.</h2>
          <form className="stack" onSubmit={(event) => void sendHello(event)}>
            <input
              value={hello}
              placeholder={`Say hello to ${celebration.otherUser.name}`}
              onChange={(event) => setHello(event.target.value)}
            />
            <button className="submit" type="submit" disabled={busy || !hello.trim()}>Send</button>
            <button
              className="auth-btn outline"
              type="button"
              onClick={() => {
                setCelebration(null);
                setHello("");
              }}
            >
              Keep swiping
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function PlusCheckout(props: { token: string }) {
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const result = await api<{ authorizationUrl: string }>("/api/billing/checkout", { method: "POST" }, props.token);
      window.location.assign(result.authorizationUrl);
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "Checkout could not start.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <h2>mingleX Plus</h2>
      <p className="home-copy">One payment turns on the features this house has marked as paid. Checkout stays closed until the Paystack keys are in place.</p>
      <button className="submit" type="button" disabled={busy} onClick={() => void start()}>Get mingleX Plus</button>
    </section>
  );
}

function DiscoverySettings(props: { token: string; onSaved: () => void }) {
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [radius, setRadius] = useState(100);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(80);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ user: { interestedIn: string[]; discoveryRadiusKm: number; discoveryMinAge: number; discoveryMaxAge: number } }>("/api/me", {}, props.token)
      .then((data) => {
        if (!active) return;
        setInterestedIn(data.user.interestedIn);
        setRadius(data.user.discoveryRadiusKm);
        setMinAge(data.user.discoveryMinAge);
        setMaxAge(data.user.discoveryMaxAge);
        setReady(true);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof ApiError ? caught.message : "Couldn't load settings.");
      });
    return () => {
      active = false;
    };
  }, [props.token]);

  function toggleInterest(value: string) {
    setSaved(false);
    setInterestedIn((current) => {
      if (current.includes(value)) {
        return current.length === 1 ? current : current.filter((item) => item !== value);
      }
      return [...current, value];
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({
          interestedIn,
          discoveryRadiusKm: radius,
          discoveryMinAge: minAge,
          discoveryMaxAge: maxAge,
        }),
      }, props.token);
      setSaved(true);
      props.onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Settings didn't save.");
    } finally {
      setBusy(false);
    }
  }

  const choices = [
    ["woman", "Women"],
    ["man", "Men"],
    ["nonbinary", "Nonbinary"],
  ] as const;

  return (
    <form className="settings-form" onSubmit={(event) => void save(event)}>
      <h1 className="form-title">Discovery</h1>
      <p className="home-copy">Choose who shows up in your deck.</p>
      {error && <p className="error">{error}</p>}
      {!ready && !error && <p className="home-copy">Loading settings…</p>}
      {ready && (
        <>
          <div className="stack">
            <span>Show me</span>
            <div className="choices">
              {choices.map(([value, label]) => (
                <button
                  key={value}
                  className={interestedIn.includes(value) ? "choice selected" : "choice"}
                  type="button"
                  onClick={() => toggleInterest(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="range-row">
            Within {radius} km
            <input
              type="range"
              min={1}
              max={500}
              value={radius}
              onChange={(event) => {
                setSaved(false);
                setRadius(Number(event.target.value));
              }}
            />
          </label>
          <label className="range-row">
            Youngest {minAge}
            <input
              type="range"
              min={18}
              max={100}
              value={minAge}
              onChange={(event) => {
                const next = Number(event.target.value);
                setSaved(false);
                setMinAge(next);
                if (next > maxAge) setMaxAge(next);
              }}
            />
          </label>
          <label className="range-row">
            Oldest {maxAge}
            <input
              type="range"
              min={18}
              max={100}
              value={maxAge}
              onChange={(event) => {
                const next = Number(event.target.value);
                setSaved(false);
                setMaxAge(next);
                if (next < minAge) setMinAge(next);
              }}
            />
          </label>
          <button className="submit" type="submit" disabled={busy}>Save</button>
          <button
            className="auth-btn outline"
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              api("/api/me/boost", { method: "POST" }, props.token)
                .then(() => showToast("You're boosted for 30 minutes."))
                .catch((caught: unknown) => showToast(caught instanceof ApiError ? caught.message : "Boost didn't start."))
                .finally(() => setBusy(false));
            }}
          >
            Boost my profile
          </button>
          {saved && <p className="home-copy">Saved. The deck uses this now.</p>}
        </>
      )}
    </form>
  );
}

const hobbies = [
  "Hiking", "Cooking", "Travel", "Music", "Movies", "Reading", "Gym", "Yoga",
  "Art", "Gaming", "Dancing", "Photography", "Coffee", "Outdoors", "Sports",
  "Plants", "Markets", "Walking",
];

const aboutChoices = {
  lookingFor: [["relationship", "A relationship"], ["casual", "Something casual"], ["friends", "New friends"], ["not_sure", "Not sure yet"]],
  drinking: [["never", "Never"], ["socially", "Socially"], ["often", "Regularly"]],
  smoking: [["never", "Never"], ["socially", "Socially"], ["often", "Regularly"]],
  workout: [["never", "Never"], ["sometimes", "Sometimes"], ["often", "Often"]],
  pets: [["dog", "Dog"], ["cat", "Cat"], ["both", "Dog and cat"], ["none", "No pets"], ["other", "Other pets"]],
  education: [["high_school", "High school"], ["college", "College"], ["grad", "Graduate school"]],
  kids: [["want", "Want someday"], ["have", "Have kids"], ["dont_want", "Don't want"], ["not_sure", "Not sure"]],
} as const;

const factLabels: Record<string, Record<string, string>> = {
  lookingFor: { relationship: "Relationship", casual: "Casual", friends: "New friends", not_sure: "Figuring it out" },
  drinking: { never: "Doesn't drink", socially: "Drinks socially", often: "Drinks often" },
  smoking: { never: "Doesn't smoke", socially: "Smokes socially", often: "Smokes often" },
  workout: { never: "No workouts", sometimes: "Works out sometimes", often: "Works out often" },
  pets: { dog: "Dog", cat: "Cat", both: "Dog and cat", none: "No pets", other: "Other pets" },
  education: { high_school: "High school", college: "College", grad: "Graduate school" },
  kids: { want: "Wants kids", have: "Has kids", dont_want: "Doesn't want kids", not_sure: "Kids, not sure" },
};

function profileFacts(profile: Profile): string[] {
  const facts: string[] = [];
  for (const key of ["lookingFor", "drinking", "smoking", "workout", "pets", "education", "kids"] as const) {
    const code = profile[key];
    const label = code ? factLabels[key]?.[code] : undefined;
    if (label) facts.push(label);
  }
  if (typeof profile.heightCm === "number") facts.push(`${profile.heightCm} cm`);
  return facts;
}

type AboutState = {
  bio: string;
  jobTitle: string;
  interests: string[];
  lookingFor: string;
  drinking: string;
  smoking: string;
  workout: string;
  pets: string;
  education: string;
  kids: string;
  heightCm: number | null;
};

function AboutYou(props: { token: string }) {
  const [about, setAbout] = useState<AboutState | null>(null);
  const [height, setHeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ user: AboutState }>("/api/me", {}, props.token)
      .then((data) => {
        if (!active) return;
        setAbout({
          bio: data.user.bio ?? "",
          jobTitle: data.user.jobTitle ?? "",
          interests: data.user.interests ?? [],
          lookingFor: data.user.lookingFor ?? "",
          drinking: data.user.drinking ?? "",
          smoking: data.user.smoking ?? "",
          workout: data.user.workout ?? "",
          pets: data.user.pets ?? "",
          education: data.user.education ?? "",
          kids: data.user.kids ?? "",
          heightCm: data.user.heightCm,
        });
        setHeight(data.user.heightCm ? String(data.user.heightCm) : "");
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof ApiError ? caught.message : "Couldn't load your profile.");
      });
    return () => {
      active = false;
    };
  }, [props.token]);

  function patch(partial: Partial<AboutState>) {
    setSaved(false);
    setAbout((current) => current ? { ...current, ...partial } : current);
  }

  function toggleHobby(hobby: string) {
    if (!about) return;
    setSaved(false);
    const selected = about.interests.includes(hobby);
    const interests = selected
      ? about.interests.filter((item) => item !== hobby)
      : about.interests.length >= 8 ? about.interests : [...about.interests, hobby];
    patch({ interests });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!about) return;
    const trimmedHeight = height.trim();
    const heightCm = trimmedHeight === "" ? null : Number(trimmedHeight);
    if (heightCm !== null && (!Number.isInteger(heightCm) || heightCm < 140 || heightCm > 220)) {
      setError("Height should be between 140 and 220 cm.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({
          bio: about.bio,
          jobTitle: about.jobTitle,
          interests: about.interests,
          lookingFor: about.lookingFor || null,
          drinking: about.drinking || null,
          smoking: about.smoking || null,
          workout: about.workout || null,
          pets: about.pets || null,
          education: about.education || null,
          kids: about.kids || null,
          heightCm,
        }),
      }, props.token);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Your profile didn't save.");
    } finally {
      setBusy(false);
    }
  }

  const extras = (about?.interests ?? []).filter((hobby) => !hobbies.includes(hobby));

  return (
    <form className="settings-form" onSubmit={(event) => void save(event)}>
      <h1 className="form-title">About you</h1>
      <p className="home-copy">These show on your card. Leave any of them blank.</p>
      {error && <p className="error">{error}</p>}
      {!about && !error && <p className="home-copy">Loading your profile…</p>}
      {about && (
        <>
          <label>
            Work
            <input value={about.jobTitle} maxLength={60} onChange={(event) => patch({ jobTitle: event.target.value })} />
          </label>
          <label>
            Bio
            <textarea value={about.bio} maxLength={500} rows={3} onChange={(event) => patch({ bio: event.target.value })} />
          </label>
          <ChoiceGroup label="Looking for" value={about.lookingFor} options={aboutChoices.lookingFor} onChange={(lookingFor) => patch({ lookingFor })} />
          <ChoiceGroup label="Drinking" value={about.drinking} options={aboutChoices.drinking} onChange={(drinking) => patch({ drinking })} />
          <ChoiceGroup label="Smoking" value={about.smoking} options={aboutChoices.smoking} onChange={(smoking) => patch({ smoking })} />
          <ChoiceGroup label="Workout" value={about.workout} options={aboutChoices.workout} onChange={(workout) => patch({ workout })} />
          <ChoiceGroup label="Pets" value={about.pets} options={aboutChoices.pets} onChange={(pets) => patch({ pets })} />
          <ChoiceGroup label="Kids" value={about.kids} options={aboutChoices.kids} onChange={(kids) => patch({ kids })} />
          <ChoiceGroup label="Education" value={about.education} options={aboutChoices.education} onChange={(education) => patch({ education })} />
          <label>
            Height in cm
            <input
              inputMode="numeric"
              value={height}
              placeholder="Optional"
              onChange={(event) => {
                setSaved(false);
                setHeight(event.target.value);
              }}
            />
          </label>
          <div className="stack">
            <span>Hobbies</span>
            <div className="choices">
              {[...hobbies, ...extras].map((hobby) => (
                <button
                  key={hobby}
                  className={about.interests.includes(hobby) ? "choice selected" : "choice"}
                  type="button"
                  onClick={() => toggleHobby(hobby)}
                >
                  {hobby}
                </button>
              ))}
            </div>
          </div>
          <button className="submit" type="submit" disabled={busy}>Save about you</button>
          {saved && <p className="home-copy">Saved. People can see this on your card.</p>}
        </>
      )}
    </form>
  );
}

function ChoiceGroup(props: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="stack">
      <span>{props.label}</span>
      <div className="choices">
        {props.options.map(([value, label]) => (
          <button
            key={value}
            className={props.value === value ? "choice selected" : "choice"}
            type="button"
            onClick={() => props.onChange(props.value === value ? "" : value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PersonDetail(props: {
  opened: Opened;
  onBack: () => void;
  onMessage: () => void;
  onDecide: (direction: "like" | "pass") => void;
}) {
  const person = props.opened.kind === "match" ? props.opened.match.otherUser : props.opened.person;
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = person.photos[photoIndex] ?? person.photos[0];
  const place = [person.city, person.distanceKm !== undefined ? `${person.distanceKm} km away` : ""].filter(Boolean).join(" · ");
  const gender = person.gender === "woman" ? "Woman" : person.gender === "man" ? "Man" : person.gender === "nonbinary" ? "Nonbinary" : "";
  const facts = [...profileFacts(person), ...person.interests];
  return (
    <div className="stack">
      <button className="back" type="button" onClick={props.onBack} aria-label="Back">‹</button>
      <article className="deck-card person-card" style={photo && photo.kind !== "video" ? { backgroundImage: `url("${mediaUrl(photo.url)}")` } : undefined}>
        {photo?.kind === "video" && <video className="deck-video" src={mediaUrl(photo.url)} playsInline controls />}
        <div className="deck-meta">
          <h2>{profileTitle(person)}</h2>
        </div>
      </article>
      {person.photos.length > 1 && (
        <div className="photo-picks">
          {person.photos.map((item, index) => (
            <button key={item.url} type="button" className={index === photoIndex ? "selected" : ""} onClick={() => setPhotoIndex(index)}>
              <img src={mediaUrl(item.url)} alt="" />
            </button>
          ))}
        </div>
      )}
      <section className="detail-sheet">
        <h2>{profileTitle(person)}</h2>
        <p>{[person.jobTitle, place || "No city saved", gender].filter(Boolean).join(" · ")}</p>
        <p>{person.phone ? `Phone ${person.phone}` : "No phone number on this profile"}</p>
        {person.bio ? <p>{person.bio}</p> : <p>No bio yet.</p>}
        {facts.length > 0 && <div className="detail-facts">{facts.map((fact) => <span key={fact}>{fact}</span>)}</div>}
      </section>
      <button className="submit" type="button" onClick={props.onMessage}>Message</button>
      {props.opened.kind === "incoming" && (
        <div className="pair">
          <button className="auth-btn outline" type="button" onClick={() => props.onDecide("pass")}>Pass</button>
          <button className="submit" type="button" onClick={() => props.onDecide("like")}>Accept</button>
        </div>
      )}
      {props.opened.kind === "outgoing" && (
        <button className="auth-btn outline" type="button" onClick={() => props.onDecide("pass")}>Cancel request</button>
      )}
    </div>
  );
}

function messageWasSeen(messages: ChatMessage[], otherUserId: string): boolean {
  const last = messages.at(-1);
  return Boolean(last && last.senderId !== otherUserId && last.readAt);
}

function Chat(props: { token: string; match: Match; onBack: () => void; onSafety: () => void; onLeave: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  async function leave() {
    setLeaving(true);
    try {
      await api(`/api/matches/${props.match.id}`, { method: "DELETE" }, props.token);
      props.onLeave();
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "The match is still there.");
      setLeaving(false);
    }
  }

  useEffect(() => {
    let active = true;
    let loaded = false;
    async function load() {
      try {
        const data = await api<{ messages: ChatMessage[] }>(`/api/matches/${props.match.id}/messages`, {}, props.token);
        if (!active) return;
        loaded = true;
        setMessages(data.messages);
      } catch (caught) {
        if (active && !loaded) setError(caught instanceof ApiError ? caught.message : "Couldn't load messages.");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [props.match.id, props.token]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    try {
      const result = await api<{ message: ChatMessage }>(`/api/matches/${props.match.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: body }),
      }, props.token);
      setMessages((items) => [...items, result.message]);
    } catch (caught) {
      setText(body);
      setError(caught instanceof ApiError ? caught.message : "The message didn't send.");
    }
  }

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  return (
    <div className="stack chat">
      <div className="chat-head">
        <button className="back" type="button" onClick={props.onBack} aria-label="Back">‹</button>
        <h1 className="form-title">{props.match.otherUser.name}</h1>
        <button className="text-btn" type="button" onClick={props.onSafety}>Report or block</button>
        <button className="text-btn" type="button" disabled={leaving} onClick={() => void leave()}>
          {props.match.pending ? "Cancel chat" : "Unmatch"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="messages" ref={scroller}>
        {messages.map((message) => (
          <p key={message.id} className={message.senderId === props.match.otherUser.id ? "theirs" : "mine"}>{message.text}</p>
        ))}
        {messages.length === 0 && <p className="home-copy">Say the first hello.</p>}
        {messageWasSeen(messages, props.match.otherUser.id) && <p className="seen">Seen</p>}
      </div>
      <form className="composer" onSubmit={(event) => void send(event)}>
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Message" />
        <button className="submit" type="submit">Send</button>
      </form>
    </div>
  );
}
