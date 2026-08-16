import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  Plus,
  Trash2,
  Check,
  X,
  Type as TypeIcon,
  Eye,
  Loader2,
  ArrowLeft,
  Flag,
  ListChecks,
  Sparkles,
  Home,
  Pencil,
  Settings,
  KeyRound,
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/* Palette & constants                                                    */
/* ---------------------------------------------------------------------- */

const C = {
  navy: "#101A33",
  navyDeep: "#0B1326",
  navyLine: "#26355C",
  cream: "#F7F1E1",
  creamDim: "#EAE1CB",
  ink: "#1B2A4A",
  inkSoft: "#4A567A",
  amber: "#E8A33D",
  amberDeep: "#C97F1E",
  coral: "#E2607A",
  mint: "#5FB894",
  mutedCream: "#9AA6C4",
};

const STORAGE_KEY = "marcelina-words-v1";
const API_KEY_STORAGE = "marcelina-api-key-v1";
const MIN_WEIGHT = 1;
const MAX_WEIGHT = 50;
const INITIAL_WEIGHT = 10;

const OCR_PROMPT = `You are given a photo of a vocabulary list for someone learning English words, written in Polish and English (either handwritten or printed, in any layout - two columns, numbered lines, etc). Extract every Polish/English word pair you can read.

Respond with ONLY raw JSON, no markdown fences, no commentary, in exactly this format:
[{"pl":"polskie słowo","en":"english word"}]

Rules:
- "pl" must be the Polish word or phrase, "en" must be the English translation.
- If a line has several accepted English translations, join them in "en" separated by " / ".
- Skip headers, page numbers, dates, or anything that isn't an actual word pair.
- Fix obvious OCR letter mistakes using context, but don't invent words that aren't there.
- If you truly cannot read anything useful, return [].`;

/* ---------------------------------------------------------------------- */
/* Helpers                                                                */
/* ---------------------------------------------------------------------- */

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function newWord(pl, en) {
  return {
    id: genId(),
    pl: pl.trim(),
    en: en.trim(),
    weight: INITIAL_WEIGHT,
    hard: false,
    correctCount: 0,
    wrongCount: 0,
  };
}

function masteryOf(w) {
  const pct = 100 - ((w.weight - MIN_WEIGHT) / (MAX_WEIGHT - MIN_WEIGHT)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function masteryColor(pct) {
  if (pct >= 75) return C.mint;
  if (pct >= 40) return C.amber;
  return C.coral;
}

function selectionWeight(w) {
  return w.weight * (w.hard ? 1.6 : 1);
}

function pickWord(words, excludeId) {
  if (words.length === 0) return null;
  const pool = words.length > 1 ? words.filter((w) => w.id !== excludeId) : words;
  const total = pool.reduce((s, w) => s + selectionWeight(w), 0);
  let r = Math.random() * total;
  for (const w of pool) {
    r -= selectionWeight(w);
    if (r <= 0) return w;
  }
  return pool[pool.length - 1];
}

function updateWordStat(w, isCorrect) {
  if (isCorrect) {
    return {
      ...w,
      weight: Math.max(MIN_WEIGHT, +(w.weight * 0.55).toFixed(2)),
      correctCount: (w.correctCount || 0) + 1,
    };
  }
  return {
    ...w,
    weight: Math.min(MAX_WEIGHT, +(w.weight * 1.7 + 4).toFixed(2)),
    wrongCount: (w.wrongCount || 0) + 1,
  };
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku"));
    reader.readAsDataURL(file);
  });
}

/* ---------------------------------------------------------------------- */
/* FlapText — split-flap departure-board style text                       */
/* ---------------------------------------------------------------------- */

function FlapText({ text, size = "text-3xl", tileBg = C.ink, tileColor = C.cream, dense = false }) {
  const chars = text.split("");
  return (
    <span
      className="inline-flex flex-wrap justify-center"
      style={{ perspective: "500px" }}
      aria-label={text}
    >
      {chars.map((ch, i) => (
        <span
          key={i + ch + text.length}
          className={`flap-tile ${size} font-mono font-semibold`}
          style={{
            animationDelay: `${i * 30}ms`,
            backgroundColor: ch === " " ? "transparent" : tileBg,
            color: tileColor,
            padding: ch === " " ? "0 4px" : dense ? "0 4px" : "1px 7px",
            margin: "1.5px",
          }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/* Ticket card wrapper — travel-ticket motif                              */
/* ---------------------------------------------------------------------- */

function Ticket({ children, style = {} }) {
  return (
    <div
      className="relative rounded-2xl px-6 py-8 md:px-10 md:py-10 shadow-2xl"
      style={{
        backgroundColor: C.cream,
        backgroundImage:
          "repeating-linear-gradient(135deg, rgba(27,42,74,0.025) 0px, rgba(27,42,74,0.025) 2px, transparent 2px, transparent 14px)",
        border: `1px dashed ${C.inkSoft}55`,
        ...style,
      }}
    >
      <div
        className="absolute rounded-full"
        style={{ width: 22, height: 22, left: -11, top: "50%", marginTop: -11, backgroundColor: C.navy }}
      />
      <div
        className="absolute rounded-full"
        style={{ width: 22, height: 22, right: -11, top: "50%", marginTop: -11, backgroundColor: C.navy }}
      />
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Home Screen                                                            */
/* ---------------------------------------------------------------------- */

function HomeScreen({ words, onNav }) {
  const total = words.length;
  const avgMastery = total ? Math.round(words.reduce((s, w) => s + masteryOf(w), 0) / total) : 0;
  const hardCount = words.filter((w) => w.hard).length;
  const dueCount = words.filter((w) => w.weight > 15).length;

  return (
    <div className="relative flex flex-col items-center gap-8 pb-10">
      <button
        onClick={() => onNav("settings")}
        className="absolute top-5 right-5 p-2 rounded-lg"
        style={{ backgroundColor: C.navyDeep, border: `1px solid ${C.navyLine}` }}
        title="Ustawienia"
      >
        <Settings size={18} color={C.mutedCream} />
      </button>
      <div className="text-center pt-8">
        <div className="mb-1" style={{ color: C.amber, letterSpacing: "0.35em" }}>
          <span className="text-[11px] font-mono uppercase">Twój bilet do angielskiego</span>
        </div>
        <FlapText text="MARCELINA" size="text-3xl md:text-5xl" />
        <div className="h-2" />
        <FlapText text="EXPRESS" size="text-3xl md:text-5xl" tileBg={C.amberDeep} tileColor={C.navyDeep} />
      </div>

      {total === 0 ? (
        <Ticket style={{ maxWidth: 480, width: "100%" }}>
          <div className="text-center" style={{ color: C.ink }}>
            <Sparkles className="mx-auto mb-3" size={28} color={C.amberDeep} />
            <p className="font-semibold text-lg mb-1">Peron pusty — brak słówek</p>
            <p className="text-sm mb-5" style={{ color: C.inkSoft }}>
              Zrób zdjęcie listy słówek albo dodaj je ręcznie, żeby wsiąść do pociągu.
            </p>
            <button
              onClick={() => onNav("add")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow-md active:scale-95 transition-transform"
              style={{ backgroundColor: C.amber, color: C.navyDeep }}
            >
              <Plus size={18} /> Dodaj pierwsze słówka
            </button>
          </div>
        </Ticket>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 w-full max-w-md">
            <StatChip label="Słówka" value={total} />
            <StatChip label="Opanowanie" value={`${avgMastery}%`} color={masteryColor(avgMastery)} />
            <StatChip label="Trudne" value={hardCount} color={C.coral} />
          </div>
          {dueCount > 0 && (
            <p className="text-xs -mt-4" style={{ color: C.mutedCream }}>
              {dueCount} {dueCount === 1 ? "słówko czeka" : "słówek czeka"} na powtórkę
            </p>
          )}

          <div className="w-full max-w-md flex flex-col gap-3">
            <ModeButton
              icon={<Eye size={20} />}
              title="Tryb: Podgląd"
              subtitle="Zobacz słówko, sprawdź tłumaczenie"
              onClick={() => onNav("study-flip")}
              bg={C.amber}
              fg={C.navyDeep}
            />
            <ModeButton
              icon={<TypeIcon size={20} />}
              title="Tryb: Wpisywanie"
              subtitle="Wpisz tłumaczenie samodzielnie"
              onClick={() => onNav("study-type")}
              bg={C.mint}
              fg={C.navyDeep}
            />
          </div>

          <div className="w-full max-w-md flex gap-3">
            <SecondaryButton icon={<Plus size={17} />} label="Dodaj słówka" onClick={() => onNav("add")} />
            <SecondaryButton icon={<ListChecks size={17} />} label="Lista słówek" onClick={() => onNav("manage")} />
          </div>
        </>
      )}
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div
      className="rounded-xl px-3 py-3 text-center"
      style={{ backgroundColor: C.navyDeep, border: `1px solid ${C.navyLine}` }}
    >
      <div className="text-xl font-mono font-bold" style={{ color: color || C.cream }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: C.mutedCream }}>
        {label}
      </div>
    </div>
  );
}

function ModeButton({ icon, title, subtitle, onClick, bg, fg }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-5 py-4 shadow-md active:scale-[0.98] transition-transform text-left"
      style={{ backgroundColor: bg, color: fg }}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: 38, height: 38, backgroundColor: "rgba(16,26,51,0.15)" }}
      >
        {icon}
      </div>
      <div>
        <div className="font-bold leading-tight">{title}</div>
        <div className="text-xs opacity-80 leading-tight">{subtitle}</div>
      </div>
    </button>
  );
}

function SecondaryButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold active:scale-[0.98] transition-transform"
      style={{ backgroundColor: C.navyDeep, color: C.cream, border: `1px solid ${C.navyLine}` }}
    >
      {icon} {label}
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/* Add Screen                                                             */
/* ---------------------------------------------------------------------- */

function AddScreen({ words, setWords, onBack, apiKey, onNeedKey }) {
  const [tab, setTab] = useState("photo"); // photo | manual
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState(null); // array of {id, pl, en, include, dup}
  const [manualPl, setManualPl] = useState("");
  const [manualEn, setManualEn] = useState("");
  const [justAdded, setJustAdded] = useState([]);
  const fileInputRef = useRef(null);
  const plRef = useRef(null);

  const existingKeys = new Set(words.map((w) => w.pl.trim().toLowerCase()));

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!apiKey) {
      setError("Najpierw dodaj klucz API w Ustawieniach, żeby rozpoznawanie zdjęć zadziałało.");
      return;
    }
    setError("");
    setLoading(true);
    setReview(null);
    try {
      const base64 = await fileToBase64(file);
      const mediaType = file.type || "image/jpeg";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
                { type: "text", text: OCR_PROMPT },
              ],
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || "";
        throw new Error("api-error: " + msg);
      }
      const raw = (data.content || [])
        .map((b) => b.text || "")
        .join("\n")
        .trim();
      const cleaned = raw.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
      let parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed) && Array.isArray(parsed.words)) parsed = parsed.words;
      if (!Array.isArray(parsed)) throw new Error("bad shape");

      const rows = parsed
        .filter((p) => p && typeof p.pl === "string" && typeof p.en === "string" && p.pl.trim() && p.en.trim())
        .map((p) => ({
          id: genId(),
          pl: p.pl.trim(),
          en: p.en.trim(),
          include: !existingKeys.has(p.pl.trim().toLowerCase()),
          dup: existingKeys.has(p.pl.trim().toLowerCase()),
        }));

      if (rows.length === 0) {
        setError("Nie znaleziono słówek na zdjęciu. Spróbuj wyraźniejszego ujęcia albo dodaj słówka ręcznie.");
      } else {
        setReview(rows);
      }
    } catch (err) {
      const msg = String((err && err.message) || "");
      if (msg.includes("api-error") && (msg.includes("401") || msg.toLowerCase().includes("authentication") || msg.toLowerCase().includes("api key"))) {
        setError("Klucz API wygląda na nieprawidłowy. Sprawdź go w Ustawieniach.");
      } else {
        setError("Nie udało się odczytać zdjęcia. Spróbuj ponownie albo dodaj słówka ręcznie.");
      }
    } finally {
      setLoading(false);
    }
  }

  function updateReviewRow(id, field, value) {
    setReview((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function confirmImport() {
    const toAdd = review.filter((r) => r.include && r.pl.trim() && r.en.trim());
    setWords((prev) => [...prev, ...toAdd.map((r) => newWord(r.pl, r.en))]);
    setJustAdded(toAdd.map((r) => r.pl));
    setReview(null);
  }

  function addManual() {
    if (!manualPl.trim() || !manualEn.trim()) return;
    setWords((prev) => [...prev, newWord(manualPl, manualEn)]);
    setJustAdded((prev) => [manualPl.trim(), ...prev].slice(0, 6));
    setManualPl("");
    setManualEn("");
    plRef.current && plRef.current.focus();
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <TopBar title="Dodaj słówka" onBack={onBack} />

      <div className="flex gap-2 max-w-md w-full mx-auto">
        <TabButton active={tab === "photo"} onClick={() => setTab("photo")} label="Zdjęcie" icon={<Camera size={16} />} />
        <TabButton active={tab === "manual"} onClick={() => setTab("manual")} label="Ręcznie" icon={<Pencil size={16} />} />
      </div>

      {tab === "photo" && !review && (
        <Ticket style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
          <div className="text-center" style={{ color: C.ink }}>
            {loading ? (
              <>
                <Loader2 className="mx-auto mb-3 animate-spin" size={28} color={C.amberDeep} />
                <p className="font-semibold">Odczytywanie słówek ze zdjęcia…</p>
                <p className="text-sm mt-1" style={{ color: C.inkSoft }}>To może chwilę potrwać.</p>
              </>
            ) : !apiKey ? (
              <>
                <KeyRound className="mx-auto mb-3" size={28} color={C.amberDeep} />
                <p className="font-semibold text-lg mb-1">Potrzebny klucz API</p>
                <p className="text-sm mb-5" style={{ color: C.inkSoft }}>
                  Rozpoznawanie słówek ze zdjęcia korzysta z Claude API. Dodaj swój klucz w Ustawieniach, żeby
                  włączyć tę funkcję — albo dodawaj słówka ręcznie.
                </p>
                <button
                  onClick={onNeedKey}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow-md active:scale-95 transition-transform"
                  style={{ backgroundColor: C.amber, color: C.navyDeep }}
                >
                  <Settings size={18} /> Przejdź do ustawień
                </button>
              </>
            ) : (
              <>
                <Camera className="mx-auto mb-3" size={28} color={C.amberDeep} />
                <p className="font-semibold text-lg mb-1">Zrób zdjęcie listy słówek</p>
                <p className="text-sm mb-5" style={{ color: C.inkSoft }}>
                  Polskie i angielskie słowa zostaną automatycznie rozpoznane.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFile}
                />
                <button
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow-md active:scale-95 transition-transform"
                  style={{ backgroundColor: C.amber, color: C.navyDeep }}
                >
                  <Camera size={18} /> Zrób / wybierz zdjęcie
                </button>
                {error && (
                  <p className="text-sm mt-4" style={{ color: C.coral }}>
                    {error}
                  </p>
                )}
              </>
            )}
          </div>
        </Ticket>
      )}

      {tab === "photo" && review && (
        <div className="max-w-md w-full mx-auto flex flex-col gap-3">
          <p className="text-sm" style={{ color: C.mutedCream }}>
            Sprawdź rozpoznane słówka, odznacz to, czego nie chcesz dodać, potem popraw literówki jeśli trzeba.
          </p>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.navyLine}` }}>
            {review.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 px-3 py-2"
                style={{ backgroundColor: C.navyDeep, borderBottom: `1px solid ${C.navyLine}` }}
              >
                <input
                  type="checkbox"
                  checked={r.include}
                  onChange={(e) => updateReviewRow(r.id, "include", e.target.checked)}
                  className="w-4 h-4 shrink-0"
                />
                <input
                  value={r.pl}
                  onChange={(e) => updateReviewRow(r.id, "pl", e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none px-1 py-1 rounded"
                  style={{ color: C.cream }}
                />
                <span style={{ color: C.mutedCream }} className="text-xs">→</span>
                <input
                  value={r.en}
                  onChange={(e) => updateReviewRow(r.id, "en", e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none px-1 py-1 rounded"
                  style={{ color: C.amber }}
                />
                {r.dup && (
                  <span className="text-[10px] shrink-0" style={{ color: C.coral }}>
                    duplikat
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setReview(null)}
              className="flex-1 rounded-xl py-3 font-semibold"
              style={{ backgroundColor: C.navyDeep, color: C.cream, border: `1px solid ${C.navyLine}` }}
            >
              Anuluj
            </button>
            <button
              onClick={confirmImport}
              className="flex-1 rounded-xl py-3 font-semibold shadow-md active:scale-95 transition-transform"
              style={{ backgroundColor: C.mint, color: C.navyDeep }}
            >
              Dodaj {review.filter((r) => r.include).length} słówek
            </button>
          </div>
        </div>
      )}

      {tab === "manual" && (
        <div className="max-w-md w-full mx-auto flex flex-col gap-4">
          <Ticket>
            <div className="flex flex-col gap-3">
              <Field label="Polskie słowo">
                <input
                  ref={plRef}
                  value={manualPl}
                  onChange={(e) => setManualPl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addManual()}
                  placeholder="np. jabłko"
                  className="w-full rounded-lg px-3 py-2 outline-none text-base"
                  style={{ backgroundColor: "white", color: C.ink, border: `1px solid ${C.inkSoft}55` }}
                />
              </Field>
              <Field label="Angielskie tłumaczenie">
                <input
                  value={manualEn}
                  onChange={(e) => setManualEn(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addManual()}
                  placeholder="np. apple"
                  className="w-full rounded-lg px-3 py-2 outline-none text-base"
                  style={{ backgroundColor: "white", color: C.ink, border: `1px solid ${C.inkSoft}55` }}
                />
              </Field>
              <button
                onClick={addManual}
                disabled={!manualPl.trim() || !manualEn.trim()}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl py-3 font-semibold shadow-md active:scale-95 transition-transform disabled:opacity-40"
                style={{ backgroundColor: C.amber, color: C.navyDeep }}
              >
                <Plus size={18} /> Dodaj słówko
              </button>
            </div>
          </Ticket>
          {justAdded.length > 0 && (
            <p className="text-xs text-center" style={{ color: C.mutedCream }}>
              Dodano: {justAdded.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function TabButton({ active, onClick, label, icon }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
      style={{
        backgroundColor: active ? C.amber : C.navyDeep,
        color: active ? C.navyDeep : C.mutedCream,
        border: `1px solid ${active ? C.amber : C.navyLine}`,
      }}
    >
      {icon} {label}
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/* Manage Screen                                                          */
/* ---------------------------------------------------------------------- */

function ManageScreen({ words, setWords, onBack }) {
  const [query, setQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editPl, setEditPl] = useState("");
  const [editEn, setEditEn] = useState("");

  const filtered = words
    .filter((w) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return w.pl.toLowerCase().includes(q) || w.en.toLowerCase().includes(q);
    })
    .sort((a, b) => a.pl.localeCompare(b.pl, "pl"));

  function toggleHard(id) {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, hard: !w.hard } : w)));
  }

  function deleteWord(id) {
    setWords((prev) => prev.filter((w) => w.id !== id));
    setConfirmDeleteId(null);
  }

  function startEdit(w) {
    setEditingId(w.id);
    setEditPl(w.pl);
    setEditEn(w.en);
  }

  function saveEdit(id) {
    if (!editPl.trim() || !editEn.trim()) return;
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, pl: editPl.trim(), en: editEn.trim() } : w)));
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      <TopBar title="Lista słówek" onBack={onBack} />

      <div className="max-w-lg w-full mx-auto flex flex-col gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj słówka…"
          className="w-full rounded-xl px-4 py-2.5 outline-none text-sm"
          style={{ backgroundColor: C.navyDeep, color: C.cream, border: `1px solid ${C.navyLine}` }}
        />

        {words.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: C.mutedCream }}>
            Lista jest pusta. Dodaj słówka, żeby zobaczyć je tutaj.
          </p>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.navyLine}` }}>
            {filtered.map((w) => {
              const m = masteryOf(w);
              const isEditing = editingId === w.id;
              return (
                <div
                  key={w.id}
                  className="px-3 py-2.5"
                  style={{ backgroundColor: C.navyDeep, borderBottom: `1px solid ${C.navyLine}` }}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editPl}
                        onChange={(e) => setEditPl(e.target.value)}
                        className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none px-1 py-1 rounded"
                        style={{ color: C.cream, border: `1px solid ${C.navyLine}` }}
                      />
                      <input
                        value={editEn}
                        onChange={(e) => setEditEn(e.target.value)}
                        className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none px-1 py-1 rounded"
                        style={{ color: C.amber, border: `1px solid ${C.navyLine}` }}
                      />
                      <button onClick={() => saveEdit(w.id)} className="p-1.5 rounded-lg" style={{ backgroundColor: C.mint }}>
                        <Check size={14} color={C.navyDeep} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg" style={{ backgroundColor: C.navyLine }}>
                        <X size={14} color={C.cream} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button className="flex-1 min-w-0 text-left" onClick={() => startEdit(w)}>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: C.cream }}>
                            {w.pl}
                          </span>
                          <span style={{ color: C.mutedCream }} className="text-xs">→</span>
                          <span className="text-sm" style={{ color: C.amber }}>
                            {w.en}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full w-full max-w-[160px]" style={{ backgroundColor: "#1c2745" }}>
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${m}%`, backgroundColor: masteryColor(m) }}
                          />
                        </div>
                      </button>

                      <button
                        onClick={() => toggleHard(w.id)}
                        className="p-2 rounded-lg shrink-0"
                        style={{ backgroundColor: w.hard ? `${C.coral}33` : "transparent" }}
                        title="Oznacz jako trudne"
                      >
                        <Flag size={16} color={w.hard ? C.coral : C.mutedCream} fill={w.hard ? C.coral : "none"} />
                      </button>

                      {confirmDeleteId === w.id ? (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => deleteWord(w.id)} className="p-2 rounded-lg" style={{ backgroundColor: C.coral }}>
                            <Check size={14} color="white" />
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="p-2 rounded-lg" style={{ backgroundColor: C.navyLine }}>
                            <X size={14} color={C.cream} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(w.id)} className="p-2 rounded-lg shrink-0">
                          <Trash2 size={16} color={C.mutedCream} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {words.length > 0 && (
          <div className="pt-4 text-center">
            {confirmResetAll ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm" style={{ color: C.coral }}>Usunąć wszystkie {words.length} słówek?</span>
                <button
                  onClick={() => {
                    setWords([]);
                    setConfirmResetAll(false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: C.coral, color: "white" }}
                >
                  Tak, usuń
                </button>
                <button
                  onClick={() => setConfirmResetAll(false)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: C.navyLine, color: C.cream }}
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmResetAll(true)} className="text-xs" style={{ color: C.mutedCream }}>
                Usuń wszystkie słówka
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Settings Screen                                                        */
/* ---------------------------------------------------------------------- */

function SettingsScreen({ apiKey, setApiKey, onBack }) {
  const [value, setValue] = useState(apiKey || "");
  const [saved, setSaved] = useState(false);

  function save() {
    const trimmed = value.trim();
    setApiKey(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function clearKey() {
    setValue("");
    setApiKey("");
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <TopBar title="Ustawienia" onBack={onBack} />
      <div className="max-w-md w-full mx-auto flex flex-col gap-4">
        <Ticket>
          <div className="flex flex-col gap-3" style={{ color: C.ink }}>
            <div className="flex items-center gap-2">
              <KeyRound size={18} color={C.amberDeep} />
              <p className="font-semibold">Klucz API Anthropic</p>
            </div>
            <p className="text-sm" style={{ color: C.inkSoft }}>
              Potrzebny tylko do rozpoznawania słówek ze zdjęcia. Klucz zapisuje się wyłącznie w przeglądarce na
              tym urządzeniu — nigdzie indziej nie jest wysyłany poza bezpośrednie zapytania do Anthropic.
            </p>
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full rounded-lg px-3 py-2 outline-none text-sm font-mono"
              style={{ backgroundColor: "white", color: C.ink, border: `1px solid ${C.inkSoft}55` }}
            />
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={!value.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 font-semibold shadow-md active:scale-95 transition-transform disabled:opacity-40"
                style={{ backgroundColor: C.amber, color: C.navyDeep }}
              >
                <Check size={16} /> {saved ? "Zapisano!" : "Zapisz klucz"}
              </button>
              {apiKey && (
                <button
                  onClick={clearKey}
                  className="px-4 rounded-xl font-semibold"
                  style={{ backgroundColor: C.navyLine, color: C.cream }}
                >
                  Usuń
                </button>
              )}
            </div>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline text-center"
              style={{ color: C.inkSoft }}
            >
              Wygeneruj klucz na console.anthropic.com
            </a>
          </div>
        </Ticket>
        <p className="text-xs text-center" style={{ color: C.mutedCream }}>
          Zdjęcia są wysyłane bezpośrednio z przeglądarki do Anthropic w celu odczytania słówek — nie trafiają
          nigdzie indziej. Rozpoznawanie zdjęć zużywa niewielką część limitu Twojego klucza API.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Study Screen                                                           */
/* ---------------------------------------------------------------------- */

function StudyScreen({ words, setWords, mode, onExit }) {
  const [currentId, setCurrentId] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [phase, setPhase] = useState("answer"); // answer | result
  const [feedback, setFeedback] = useState(null); // {correct, correctAnswer}
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });
  const inputRef = useRef(null);

  const pickNext = useCallback(
    (excludeId) => {
      const w = pickWord(words, excludeId);
      setCurrentId(w ? w.id : null);
      setFlipped(false);
      setTypedAnswer("");
      setPhase("answer");
      setFeedback(null);
    },
    [words]
  );

  useEffect(() => {
    pickNext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "type" && phase === "answer" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode, phase, currentId]);

  const current = words.find((w) => w.id === currentId) || null;

  function recordAnswer(isCorrect) {
    setWords((prev) => prev.map((w) => (w.id === currentId ? updateWordStat(w, isCorrect) : w)));
    setStats((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), wrong: s.wrong + (isCorrect ? 0 : 1) }));
  }

  function handleFlipAnswer(isCorrect) {
    recordAnswer(isCorrect);
    setTimeout(() => pickNext(currentId), 300);
  }

  function handleTypeSubmit() {
    if (!current) return;
    const accepted = current.en
      .split("/")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const typed = typedAnswer.trim().toLowerCase();
    const isCorrect = accepted.includes(typed);
    recordAnswer(isCorrect);
    setFeedback({ correct: isCorrect, correctAnswer: current.en });
    setPhase("result");
  }

  if (words.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <TopBar title={mode === "flip" ? "Tryb: Podgląd" : "Tryb: Wpisywanie"} onBack={onExit} />
        <p className="text-center text-sm" style={{ color: C.mutedCream }}>
          Brak słówek do nauki. Wróć i dodaj kilka.
        </p>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <TopBar title={mode === "flip" ? "Tryb: Podgląd" : "Tryb: Wpisywanie"} onBack={onExit} />

      <div className="flex items-center justify-center gap-4 text-sm font-mono">
        <span style={{ color: C.mint }}>✓ {stats.correct}</span>
        <span style={{ color: C.coral }}>✗ {stats.wrong}</span>
      </div>

      <div className="max-w-md w-full mx-auto">
        <Ticket>
          {current.hard && (
            <Flag className="absolute top-3 right-3" size={16} color={C.coral} fill={C.coral} />
          )}
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-widest mb-3" style={{ color: C.inkSoft }}>
              Słówko
            </div>
            <FlapText key={"pl-" + current.id} text={current.pl.toUpperCase()} size="text-2xl md:text-4xl" />

            {mode === "flip" && flipped && (
              <>
                <div className="my-5 border-t" style={{ borderStyle: "dashed", borderColor: `${C.inkSoft}55` }} />
                <div className="text-[11px] uppercase tracking-widest mb-3" style={{ color: C.inkSoft }}>
                  Tłumaczenie
                </div>
                <FlapText
                  key={"en-" + current.id}
                  text={current.en.toUpperCase()}
                  size="text-xl md:text-3xl"
                  tileBg={C.mint}
                  tileColor={C.navyDeep}
                />
              </>
            )}

            {mode === "type" && phase === "result" && (
              <>
                <div className="my-5 border-t" style={{ borderStyle: "dashed", borderColor: `${C.inkSoft}55` }} />
                <div className="text-[11px] uppercase tracking-widest mb-3" style={{ color: C.inkSoft }}>
                  Poprawna odpowiedź
                </div>
                <FlapText
                  key={"ans-" + current.id}
                  text={current.en.toUpperCase()}
                  size="text-xl md:text-3xl"
                  tileBg={feedback && feedback.correct ? C.mint : C.coral}
                  tileColor={C.navyDeep}
                />
              </>
            )}
          </div>
        </Ticket>
      </div>

      <div className="max-w-md w-full mx-auto flex flex-col gap-3">
        {mode === "flip" && !flipped && (
          <button
            onClick={() => setFlipped(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold shadow-md active:scale-95 transition-transform"
            style={{ backgroundColor: C.amber, color: C.navyDeep }}
          >
            <Eye size={18} /> Pokaż tłumaczenie
          </button>
        )}

        {mode === "flip" && flipped && (
          <div className="flex gap-3">
            <button
              onClick={() => handleFlipAnswer(false)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold shadow-md active:scale-95 transition-transform"
              style={{ backgroundColor: C.coral, color: "white" }}
            >
              <X size={18} /> Nie umiałam/em
            </button>
            <button
              onClick={() => handleFlipAnswer(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold shadow-md active:scale-95 transition-transform"
              style={{ backgroundColor: C.mint, color: C.navyDeep }}
            >
              <Check size={18} /> Umiałam/em
            </button>
          </div>
        )}

        {mode === "type" && phase === "answer" && (
          <div className="flex flex-col gap-3">
            <input
              ref={inputRef}
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTypeSubmit()}
              placeholder="Wpisz angielskie słowo…"
              className="w-full rounded-xl px-4 py-3.5 outline-none text-base text-center font-mono"
              style={{ backgroundColor: C.cream, color: C.ink, border: `2px solid ${C.navyLine}` }}
            />
            <button
              onClick={handleTypeSubmit}
              disabled={!typedAnswer.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold shadow-md active:scale-95 transition-transform disabled:opacity-40"
              style={{ backgroundColor: C.amber, color: C.navyDeep }}
            >
              Sprawdź
            </button>
          </div>
        )}

        {mode === "type" && phase === "result" && (
          <div className="flex flex-col gap-3">
            <p
              className="text-center font-semibold"
              style={{ color: feedback && feedback.correct ? C.mint : C.coral }}
            >
              {feedback && feedback.correct ? "Dobrze! 🎉" : "Prawie — spróbuj zapamiętać tę formę."}
            </p>
            <button
              onClick={() => pickNext(currentId)}
              className="inline-flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold shadow-md active:scale-95 transition-transform"
              style={{ backgroundColor: C.mint, color: C.navyDeep }}
            >
              Dalej
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Shared bits                                                            */
/* ---------------------------------------------------------------------- */

function TopBar({ title, onBack }) {
  return (
    <div className="flex items-center gap-3 max-w-lg w-full mx-auto pt-2">
      <button
        onClick={onBack}
        className="p-2 rounded-lg shrink-0"
        style={{ backgroundColor: C.navyDeep, border: `1px solid ${C.navyLine}` }}
      >
        <ArrowLeft size={18} color={C.cream} />
      </button>
      <h1 className="font-bold text-lg" style={{ color: C.cream }}>
        {title}
      </h1>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Root App                                                               */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [words, setWords] = useState([]);
  const [apiKey, setApiKeyState] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState("home"); // home | add | manage | settings | study-flip | study-type

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setWords(parsed);
      }
      const key = localStorage.getItem(API_KEY_STORAGE);
      if (key) setApiKeyState(key);
    } catch (e) {
      // no saved data yet — start fresh
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    } catch (e) {
      console.error("Nie udało się zapisać słówek", e);
    }
  }, [words, loaded]);

  function setApiKey(key) {
    setApiKeyState(key);
    try {
      if (key) localStorage.setItem(API_KEY_STORAGE, key);
      else localStorage.removeItem(API_KEY_STORAGE);
    } catch (e) {
      console.error("Nie udało się zapisać klucza", e);
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: C.navy }}>
      <style>{`
        @keyframes flapIn {
          0% { transform: rotateX(-100deg); opacity: 0; }
          55% { transform: rotateX(18deg); opacity: 1; }
          100% { transform: rotateX(0deg); opacity: 1; }
        }
        .flap-tile {
          display: inline-block;
          border-radius: 4px;
          line-height: 1.35;
          transform-origin: 50% 50%;
          animation: flapIn 420ms cubic-bezier(.2,.8,.2,1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .flap-tile { animation: none !important; }
        }
      `}</style>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {!loaded ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin" size={28} color={C.amber} />
          </div>
        ) : screen === "home" ? (
          <HomeScreen words={words} onNav={setScreen} />
        ) : screen === "add" ? (
          <AddScreen
            words={words}
            setWords={setWords}
            onBack={() => setScreen("home")}
            apiKey={apiKey}
            onNeedKey={() => setScreen("settings")}
          />
        ) : screen === "manage" ? (
          <ManageScreen words={words} setWords={setWords} onBack={() => setScreen("home")} />
        ) : screen === "settings" ? (
          <SettingsScreen apiKey={apiKey} setApiKey={setApiKey} onBack={() => setScreen("home")} />
        ) : screen === "study-flip" ? (
          <StudyScreen words={words} setWords={setWords} mode="flip" onExit={() => setScreen("home")} />
        ) : screen === "study-type" ? (
          <StudyScreen words={words} setWords={setWords} mode="type" onExit={() => setScreen("home")} />
        ) : null}
      </div>
    </div>
  );
}
