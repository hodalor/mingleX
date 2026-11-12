import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, mediaUrl, uploadPhoto } from "./api";
import { LoveWait } from "./love";
import { showToast } from "./toast";

type Photo = { url: string; isPrimary: boolean };

type Account = {
  name: string;
  age: number | null;
  email: string | null;
  phone: string | null;
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
  photos: Photo[];
  interestedIn: string[];
  providers: string[];
};

const hobbies = [
  "Hiking", "Cooking", "Travel", "Music", "Movies", "Reading", "Gym", "Yoga",
  "Art", "Gaming", "Dancing", "Photography", "Coffee", "Outdoors", "Sports",
  "Plants", "Markets", "Walking",
];

const groups = {
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
  gender: { woman: "Woman", man: "Man", nonbinary: "Nonbinary" },
};

const prefixes = ["+1", "+44", "+234", "+233", "+254", "+27", "+91", "+61", "+49", "+33", "+55"];

function blank(account: Account) {
  return {
    ...account,
    lookingFor: account.lookingFor ?? "",
    drinking: account.drinking ?? "",
    smoking: account.smoking ?? "",
    workout: account.workout ?? "",
    pets: account.pets ?? "",
    education: account.education ?? "",
    kids: account.kids ?? "",
    bio: account.bio ?? "",
    city: account.city ?? "",
    jobTitle: account.jobTitle ?? "",
    interests: account.interests ?? [],
    photos: account.photos ?? [],
    interestedIn: account.interestedIn?.length ? account.interestedIn : ["woman", "man", "nonbinary"],
  };
}

export function MyProfile(props: { token: string }) {
  const [account, setAccount] = useState<ReturnType<typeof blank> | null>(null);
  const [height, setHeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [prefix, setPrefix] = useState("+1");
  const [national, setNational] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ user: Account }>("/api/me", {}, props.token)
      .then((data) => {
        if (!active) return;
        setAccount(blank(data.user));
        setHeight(data.user.heightCm ? String(data.user.heightCm) : "");
      })
      .catch((caught: unknown) => {
        showToast(caught instanceof ApiError ? caught.message : "Couldn't load your profile.");
      });
    return () => {
      active = false;
    };
  }, [props.token]);

  function patch(partial: Partial<NonNullable<typeof account>>) {
    setAccount((current) => current ? { ...current, ...partial } : current);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!account) return;
    const trimmed = height.trim();
    const heightCm = trimmed === "" ? null : Number(trimmed);
    if (heightCm !== null && (!Number.isInteger(heightCm) || heightCm < 140 || heightCm > 220)) {
      showToast("Height should be between 140 and 220 cm.");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ user: Account }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: account.name,
          bio: account.bio,
          jobTitle: account.jobTitle,
          city: account.city,
          gender: account.gender,
          interestedIn: account.interestedIn,
          interests: account.interests,
          lookingFor: account.lookingFor || null,
          drinking: account.drinking || null,
          smoking: account.smoking || null,
          workout: account.workout || null,
          pets: account.pets || null,
          education: account.education || null,
          kids: account.kids || null,
          heightCm,
        }),
      }, props.token);
      setAccount(blank(result.user));
      showToast("Profile saved.");
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "Your profile didn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const result = await uploadPhoto(file, props.token);
      const me = await api<{ user: Account }>("/api/me", {}, props.token);
      setAccount(blank(me.user));
      void result;
      showToast("Photo added.");
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "That photo didn't upload.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(url: string) {
    setBusy(true);
    try {
      const result = await api<{ user: Account }>("/api/me/photos", {
        method: "DELETE",
        body: JSON.stringify({ url }),
      }, props.token);
      setAccount(blank(result.user));
      showToast("Photo removed.");
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "That photo stayed.");
    } finally {
      setBusy(false);
    }
  }

  async function makeMain(url: string) {
    if (!account) return;
    setBusy(true);
    try {
      const photos = account.photos.map((photo) => ({ url: photo.url, isPrimary: photo.url === url }));
      const result = await api<{ user: Account }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ photos }),
      }, props.token);
      setAccount(blank(result.user));
      showToast("Main photo updated.");
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "The main photo didn't change.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPhone(event: FormEvent) {
    event.preventDefault();
    const digits = national.replace(/\D/g, "").replace(/^0+/, "");
    setBusy(true);
    try {
      const result = await api<{ devCode?: string }>("/api/me/phone/send", {
        method: "POST",
        body: JSON.stringify({ phone: `${prefix}${digits}` }),
      }, props.token);
      setPhoneSent(true);
      setDevCode(result.devCode ?? "");
      showToast(result.devCode ? "Code ready on this screen." : "Code sent.");
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "That number didn't send.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhone(event: FormEvent) {
    event.preventDefault();
    const digits = national.replace(/\D/g, "").replace(/^0+/, "");
    setBusy(true);
    try {
      const result = await api<{ user: Account }>("/api/me/phone/verify", {
        method: "POST",
        body: JSON.stringify({ phone: `${prefix}${digits}`, code: phoneCode }),
      }, props.token);
      setAccount(blank(result.user));
      setPhoneSent(false);
      setPhoneCode("");
      setNational("");
      setDevCode("");
      showToast("Phone number saved.");
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhone() {
    setBusy(true);
    try {
      const result = await api<{ user: Account }>("/api/me/phone", { method: "DELETE" }, props.token);
      setAccount(blank(result.user));
      showToast("Phone number removed.");
    } catch (caught) {
      showToast(caught instanceof ApiError ? caught.message : "The number is still on the account.");
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return <p className="home-copy">Loading your profile…</p>;
  }

  const main = account.photos.find((photo) => photo.isPrimary) ?? account.photos[0];
  const facts = (Object.keys(factLabels) as (keyof typeof factLabels)[])
    .map((key) => {
      const code = key === "gender" ? account.gender : account[key as "lookingFor"];
      return code ? factLabels[key]?.[code] : undefined;
    })
    .filter((fact): fact is string => Boolean(fact));
  if (account.heightCm) facts.push(`${account.heightCm} cm`);

  return (
    <form className="stack profile-page" onSubmit={(event) => void save(event)}>
      {busy && <LoveWait />}
      <h1 className="form-title">My profile</h1>
      <article className="deck-card profile-preview" style={{ backgroundImage: main ? `url("${mediaUrl(main.url) ?? ""}")` : undefined }}>
        <div className="deck-meta">
          <h2>{account.age ? `${account.name}, ${account.age}` : account.name || "Your name"}</h2>
          <p>{[account.jobTitle, account.city].filter(Boolean).join(" · ") || "Add a job or city"}</p>
          {account.bio && <p>{account.bio}</p>}
          {facts.length > 0 && <div className="chips">{facts.map((fact) => <span key={fact}>{fact}</span>)}</div>}
        </div>
      </article>
      <div className="photo-grid">
        {account.photos.map((photo) => (
          <div className="photo-tile" key={photo.url}>
            <img src={mediaUrl(photo.url)} alt="" />
            <button type="button" onClick={() => void makeMain(photo.url)}>{photo.isPrimary ? "Main" : "Make main"}</button>
            <button type="button" onClick={() => void removePhoto(photo.url)}>Remove</button>
          </div>
        ))}
        {account.photos.length < 6 && (
          <label className="photo-add">
            Add photo
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void addPhoto(event.target.files?.[0])} />
          </label>
        )}
      </div>
      <label>Name<input maxLength={40} required value={account.name} onChange={(event) => patch({ name: event.target.value })} /></label>
      <label>Job<input maxLength={60} value={account.jobTitle} onChange={(event) => patch({ jobTitle: event.target.value })} /></label>
      <label>City<input maxLength={80} value={account.city} onChange={(event) => patch({ city: event.target.value })} /></label>
      <label>Bio<textarea maxLength={500} rows={4} value={account.bio} onChange={(event) => patch({ bio: event.target.value })} /></label>
      <div className="stack">
        <span>I am</span>
        <div className="choices">
          {[["woman", "Woman"], ["man", "Man"], ["nonbinary", "Nonbinary"]].map(([value, label]) => (
            <button key={value} className={account.gender === value ? "choice selected" : "choice"} type="button" onClick={() => patch({ gender: value })}>{label}</button>
          ))}
        </div>
      </div>
      <div className="stack">
        <span>Show me</span>
        <div className="choices">
          {[["woman", "Women"], ["man", "Men"], ["nonbinary", "Nonbinary people"]].map(([value, label]) => (
            <button
              key={value}
              className={account.interestedIn.includes(value) ? "choice selected" : "choice"}
              type="button"
              onClick={() => {
                const selected = account.interestedIn.includes(value);
                const next = selected ? account.interestedIn.filter((item) => item !== value) : [...account.interestedIn, value];
                if (next.length > 0) patch({ interestedIn: next });
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {(Object.keys(groups) as (keyof typeof groups)[]).map((key) => (
        <div className="stack" key={key}>
          <span>{key === "lookingFor" ? "Looking for" : key[0]!.toUpperCase() + key.slice(1)}</span>
          <div className="choices">
            {groups[key].map(([value, label]) => (
              <button
                key={value}
                className={account[key] === value ? "choice selected" : "choice"}
                type="button"
                onClick={() => patch({ [key]: account[key] === value ? "" : value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <label>Height in cm<input inputMode="numeric" value={height} onChange={(event) => setHeight(event.target.value)} placeholder="Optional" /></label>
      <div className="stack">
        <span>Hobbies</span>
        <div className="choices">
          {hobbies.map((hobby) => (
            <button
              key={hobby}
              className={account.interests.includes(hobby) ? "choice selected" : "choice"}
              type="button"
              onClick={() => {
                const selected = account.interests.includes(hobby);
                patch({
                  interests: selected
                    ? account.interests.filter((item) => item !== hobby)
                    : account.interests.length >= 8 ? account.interests : [...account.interests, hobby],
                });
              }}
            >
              {hobby}
            </button>
          ))}
        </div>
      </div>
      <button className="submit" type="submit" disabled={busy}>Save profile</button>
      <div className="stack phone-box">
        <h2>Phone</h2>
        <p className="home-copy">{account.phone ? account.phone : "No phone number yet."}</p>
        {account.phone && (
          <button className="auth-btn outline" type="button" disabled={busy} onClick={() => void removePhone()}>Remove phone</button>
        )}
        <div className="phone-row">
          <select aria-label="Country code" value={prefix} onChange={(event) => setPrefix(event.target.value)}>
            {prefixes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input inputMode="tel" placeholder="New number" value={national} onChange={(event) => setNational(event.target.value)} />
        </div>
        <button className="auth-btn outline" type="button" disabled={busy || national.trim() === ""} onClick={(event) => void sendPhone(event)}>Send code</button>
        {phoneSent && (
          <>
            {devCode && <p className="dev-code">Development code: {devCode}</p>}
            <input inputMode="numeric" placeholder="6-digit code" value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} />
            <button className="submit" type="button" disabled={busy} onClick={(event) => void verifyPhone(event)}>Save number</button>
          </>
        )}
      </div>
      <p className="home-copy">Email: {account.email ?? "No email on this account"}</p>
    </form>
  );
}
