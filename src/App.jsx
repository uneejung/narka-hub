import { supabase } from "./supabase.js";
import { useState, useRef, useEffect } from "react";

// ── Google 로그인 & 접근 제어 ─────────────────────────────────
function useAuth() {
  const [user, setUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) checkAccess(session.user);
      else setAuthLoaded(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) checkAccess(session.user);
      else { setUser(null); setAuthLoaded(true); setAccessDenied(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkAccess(u) {
    const { data } = await supabase.from("narka_allowed_emails").select("*").eq("email", u.email).single();
    if (data) { setUser({ ...u, name: data.name, role: data.role }); setAccessDenied(false); }
    else { setAccessDenied(true); setUser(null); await supabase.auth.signOut(); }
    setAuthLoaded(true);
  }

  const signIn = () => supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin }
  });
  const signOut = () => supabase.auth.signOut();

  return { user, authLoaded, accessDenied, signIn, signOut };
}

function LoginScreen({ onSignIn, accessDenied }) {
  return (
    <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm text-center">
        <p className="font-black text-2xl tracking-tighter mb-1">NARKA</p>
        <p className="text-xs text-gray-400 mb-8">Creative Hub</p>
        {accessDenied ? (
          <div className="mb-6 p-3 bg-red-50 rounded-xl">
            <p className="text-sm text-red-500 font-semibold">접근 권한이 없습니다</p>
            <p className="text-xs text-red-400 mt-1">관리자에게 이메일 등록을 요청하세요</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-8">팀원만 접근 가능합니다</p>
        )}
        <button onClick={onSignIn}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A353" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
          Google 계정으로 로그인
        </button>
      </div>
    </div>
  );
}

// ── 초기 데이터 ──────────────────────────────────────────────
const INIT_PRODUCTS = [
  { id: "p1", name: "슈퍼픽스 헤어마스카라", tag: "MAIN", usps: [{ id: "u1", label: "강력 고정력", copies: [{ id: "c1", text: "하루종일 무너지지 않는 스타일" }] }] },
  { id: "p2", name: "프레시세범 헤어마스카라&미스트", tag: "MAIN", usps: [{ id: "u1", label: "두피 세범 케어", copies: [{ id: "c1", text: "기름진 두피, 하루만에 리셋" }] }] },
  { id: "p3", name: "헤어 밀크", tag: "SUB", usps: [{ id: "u1", label: "손상 케어", copies: [{ id: "c1", text: "끊어지기 직전 모발을 살리는" }] }] },
  { id: "p4", name: "샴푸 (신규)", tag: "SUB", usps: [{ id: "u1", label: "두피 세정", copies: [{ id: "c1", text: "막힌 모공을 뚫는 딥클렌징" }] }] },
];

const DELETE_PASSWORD = "0303";
function genId() { return `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

// ── Supabase 헬퍼 ─────────────────────────────────────────────
async function sbGet(table, def) {
  try {
    const { data, error } = await supabase.from(table).select("*").eq("id", "singleton").single();
    if (error || !data) return def;
    return JSON.parse(data.value);
  } catch { return def; }
}
async function sbSet(table, value) {
  try { await supabase.from(table).upsert({ id: "singleton", value: JSON.stringify(value) }); } catch {}
}

// ── 앱 상태 ───────────────────────────────────────────────────
function useAppState() {
  const [products, setProductsRaw] = useState(INIT_PRODUCTS);
  const [assets, setAssetsRaw] = useState([]);
  const [meetings, setMeetingsRaw] = useState([]);
  const [references, setReferencesRaw] = useState([]);
  const [csvRows, setCsvRowsRaw] = useState([]);
  const [csvLoaded, setCsvLoaded] = useState(false);

  useEffect(() => {
    // Supabase에서 META RAW 로드
    async function loadCsv() {
      try {
        const { data } = await supabase.from("narka_meta_rows").select("value").eq("id", "singleton").single();
        if (data?.value) setCsvRowsRaw(JSON.parse(data.value));
      } catch(e) { console.warn("META RAW 로드 실패:", e); }
      setCsvLoaded(true);
    }
    loadCsv();
  }, []);
  const [creators, setCreatorsRaw] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const [p, a, m, r, cr] = await Promise.all([
        sbGet("narka_products", INIT_PRODUCTS),
        sbGet("narka_assets", []),
        sbGet("narka_meetings", []),
        sbGet("narka_references", []),
        sbGet("narka_creators", []),
      ]);
      setProductsRaw(p); setAssetsRaw(a); setMeetingsRaw(m); setReferencesRaw(r); setCreatorsRaw(cr);
      setLoaded(true);
    }
    load();
    const channel = supabase.channel("narka_sync")
      .on("postgres_changes", { event: "*", schema: "public" }, async () => {
        const [p, a, m, r, cr] = await Promise.all([
          sbGet("narka_products", INIT_PRODUCTS), sbGet("narka_assets", []),
          sbGet("narka_meetings", []), sbGet("narka_references", []),
          sbGet("narka_creators", []),
        ]);
        setProductsRaw(p); setAssetsRaw(a); setMeetingsRaw(m); setReferencesRaw(r); setCreatorsRaw(cr);
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const mk = (setter, table) => (v) => setter(prev => {
    const next = typeof v === "function" ? v(prev) : v;
    sbSet(table, next); return next;
  });

  // META RAW는 Supabase에 저장 (팀 공유)
  const setCsvRows = (v) => setCsvRowsRaw(prev => {
    const next = typeof v === "function" ? v(prev) : v;
    try {
      supabase.from("narka_meta_rows").upsert({ id: "singleton", value: JSON.stringify(next) }).then(() => {});
    } catch(e) { console.warn("META RAW 저장 실패:", e); }
    return next;
  });

  return {
    products, setProducts: mk(setProductsRaw, "narka_products"),
    assets, setAssets: mk(setAssetsRaw, "narka_assets"),
    meetings, setMeetings: mk(setMeetingsRaw, "narka_meetings"),
    references, setReferences: mk(setReferencesRaw, "narka_references"),
    csvRows, setCsvRows,
    creators, setCreators: mk(setCreatorsRaw, "narka_creators"),
    loaded,
  };
}

// ── UI 기초 ───────────────────────────────────────────────────
function Pill({ children, color = "gray", className = "" }) {
  const map = { gray: "bg-gray-100 text-gray-600", indigo: "bg-indigo-100 text-indigo-700", emerald: "bg-emerald-100 text-emerald-700", red: "bg-red-100 text-red-600", amber: "bg-amber-100 text-amber-700", purple: "bg-purple-100 text-purple-700", blue: "bg-blue-100 text-blue-700" };
  return <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${map[color]||map.gray} ${className}`}>{children}</span>;
}
function Modal({ onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto`}>{children}</div>
    </div>
  );
}
function TF({ value, onChange, placeholder, className = "" }) {
  return <input className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 ${className}`} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />;
}
function TA({ value, onChange, placeholder, rows = 3 }) {
  return <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/20" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} />;
}
function Label({ children }) { return <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{children}</p>; }
function Divider() { return <div className="border-t border-gray-100 my-4" />; }

// ── 비밀번호 확인 ─────────────────────────────────────────────
function PasswordConfirm({ onConfirm, onCancel, message = "삭제하려면 비밀번호를 입력하세요" }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  return (
    <Modal onClose={onCancel}>
      <div className="p-6">
        <p className="font-bold text-sm mb-1">⚠️ {message}</p>
        <p className="text-xs text-gray-400 mb-4">이 작업은 되돌릴 수 없습니다</p>
        <TF value={pw} onChange={setPw} placeholder="비밀번호 입력" />
        {err && <p className="text-xs text-red-500 mt-1">비밀번호가 틀렸습니다</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500">취소</button>
          <button onClick={() => { if (pw === DELETE_PASSWORD) onConfirm(); else setErr(true); }} className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-semibold">삭제</button>
        </div>
      </div>
    </Modal>
  );
}

// ── 연/월 필터 ────────────────────────────────────────────────
function YearMonthFilter({ value, onChange }) {
  const years = ["2026", "2027", "2028"];
  const months = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const [selYear, setSelYear] = useState(value?.split("-")[0] || "");
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={() => { setSelYear(""); onChange("all"); }} className={`text-xs px-3 py-1 rounded-full border transition ${value === "all" ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>전체</button>
      {years.map(y => (
        <div key={y} className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setSelYear(selYear === y ? "" : y)} className={`text-xs px-3 py-1 rounded-full border transition ${selYear === y ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-500"}`}>{y}년</button>
          {selYear === y && months.map(m => (
            <button key={m} onClick={() => onChange(`${y}-${m}`)} className={`text-xs px-2 py-1 rounded-full border transition ${value === `${y}-${m}` ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{m}월</button>
          ))}
        </div>
      ))}
    </div>
  );
}
function matchYM(dateStr, filter) {
  if (filter === "all" || !dateStr) return true;
  return dateStr.startsWith(filter);
}

// ── CSV 파싱 ──────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  // BOM 제거
  const cleanText = text.replace(/^\uFEFF/, "");
  const lines = cleanText.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line).map(v => v.replace(/^"|"$/g, "").trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] !== undefined ? vals[i] : ""; });
    return obj;
  });
}

const META_KEYS = {
  "광고 이름": "adName",
  "캠페인 이름": "campaign",
  "roas(광고 지출 대비 수익률)": "roas",
  "roas (광고 지출 대비 수익률)": "roas",
  "노출": "impressions",
  "클릭(전체)": "clicks",
  "ctr(전체)": "ctr",
  "cpm": "cpm",
  "cpc(전체)": "cpc",
  "지출 금액 (krw)": "spend",
  "지출 금액(krw)": "spend",
  "소진 금액 (krw)": "spend",
  "구매": "convCount",
  "구매 전환값": "convValue",
  "앱 내 구매웹사이트 구매 전환값": "convValue",
  "구매 roas": "roas",
};

// CTR은 이미 소수점(%) 값으로 저장되어 있음 - 추가 변환 불필요

function cleanNum(v) {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v).trim();
  if (s === "-" || s === "—" || s === "") return "";
  // 쉼표, %, 공백, 통화기호 전부 제거
  return s.replace(/[%,\s₩$]/g, "");
}

// CSV 헤더 → 내부 키 매핑 (원본 대소문자 + 소문자 둘 다 커버)
const CSV_HEADER_MAP = {
  "보고 시작": "startDate",
  "보고 종료": "endDate",
  "광고 이름": "adName",
  "구매 ROAS(광고 지출 대비 수익률)": "roas",
  "구매 roas(광고 지출 대비 수익률)": "roas",
  "CTR(전체)": "ctr",
  "ctr(전체)": "ctr",
  "CPC(전체) (KRW)": "cpc",
  "cpc(전체) (krw)": "cpc",
  "CPM(1,000회 노출당 비용) (KRW)": "cpm",
  "cpm(1,000회 노출당 비용) (krw)": "cpm",
  "지출 금액 (KRW)": "spend",
  "지출 금액 (krw)": "spend",
  "구매 전환값": "convValue",
  "웹사이트 구매 전환값": "convValue",
};

function normRow(row) {
  const out = {};
  Object.entries(row).forEach(([k, v]) => {
    const kTrim = k.trim();
    const kl = kTrim.toLowerCase();
    // 정확한 매핑 (원본 헤더 또는 소문자 둘 다 시도)
    const exact = CSV_HEADER_MAP[kTrim] || CSV_HEADER_MAP[kl];
    if (exact) {
      if (!out[exact] || out[exact] === "") out[exact] = cleanNum(v);
      return;
    }
    // Fallback 부분 매핑
    if (kl.includes("광고 이름")) { if (!out.adName) out.adName = v.trim(); }
    else if (kl.includes("roas")) { if (!out.roas) out.roas = cleanNum(v); }
    else if (kl === "ctr(전체)" || kl.includes("ctr")) { if (!out.ctr) out.ctr = cleanNum(v); }
    else if (kl.includes("cpm")) { if (!out.cpm) out.cpm = cleanNum(v); }
    else if (kl.includes("cpc")) { if (!out.cpc) out.cpc = cleanNum(v); }
    else if (kl.includes("지출")) { if (!out.spend) out.spend = cleanNum(v); }
    else if (kl.includes("전환값")) { if (!out.convValue) out.convValue = cleanNum(v); }
    else if (kl.includes("보고 시작")) { if (!out.startDate) out.startDate = v.trim(); }
    else if (kl.includes("보고 종료")) { if (!out.endDate) out.endDate = v.trim(); }
  });
  if (!out.adName) out.adName = "";
  return out;
}

function getLiveStatus(endDate) {
  if (!endDate) return "unknown";
  const today = new Date().toISOString().slice(0, 10);
  const end = endDate.slice(0, 10);
  if (end >= today) return "live";
  return "ended";
}

function getAssetMetrics(assetTitle, csvRows, dateFrom, dateTo) {
  if (!assetTitle || !csvRows.length) return null;
  // [ ] 안 텍스트 추출
  const bracket = assetTitle.match(/\[([^\]]+)\]/);
  if (!bracket) return null;
  const key = bracket[1]; // 원본 대소문자 유지

  // 날짜 기본값: 최근 7일
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  const fromStr = dateFrom || defaultFrom.toISOString().slice(0, 10);
  const toStr = dateTo || today.toISOString().slice(0, 10);

  const matched = csvRows.filter(r => {
    const adName = r.adName || "";
    // 광고명의 [ ] 안 텍스트 추출 후 완전 일치
    const adBracket = adName.match(/\[([^\]]+)\]/);
    if (!adBracket) return false;
    if (adBracket[1] !== key) return false;
    // 날짜 필터
    const rowDate = (r.startDate || "").slice(0, 10);
    if (rowDate < fromStr || rowDate > toStr) return false;
    return true;
  });

  if (!matched.length) return null;
  const sum = (k) => matched.reduce((a, r) => a + (parseFloat(r[k]) || 0), 0);
  const avg = (k) => matched.length ? sum(k) / matched.length : 0;
  const totalSpend = sum("spend");
  const totalConv = sum("convValue");
  const avgRoasRaw = avg("roas");
  const roasDisplay = avgRoasRaw > 0 ? `${Math.round(avgRoasRaw)}%` : "—";
  const ctrRaw = avg("ctr");
  const ctrDisplay = ctrRaw > 0 ? `${(ctrRaw / 100).toFixed(2)}%` : "—";
  const cpmVal = avg("cpm");
  const cpcVal = avg("cpc");
  return {
    roas: roasDisplay,
    spend: totalSpend ? `₩${Math.round(totalSpend).toLocaleString()}` : "—",
    convValue: totalConv ? `₩${Math.round(totalConv).toLocaleString()}` : "—",
    convRate: "—",
    ctr: ctrDisplay,
    cpm: cpmVal ? `₩${Math.round(cpmVal).toLocaleString()}` : "—",
    cpc: cpcVal ? `₩${Math.round(cpcVal).toLocaleString()}` : "—",
    _roas: avgRoasRaw || 0,
    _ctr: ctrRaw / 100,
    _cpc: cpcVal,
    _spend: totalSpend,
    _convValue: totalConv,
    _convRate: 0,
    matchCount: matched.length,
  };
}

// ── TAB 1: 제품X편익 (USP 설정) ──────────────────────────────
function ProductUSPTab({ products, setProducts }) {
  const [activePid, setActivePid] = useState(products[0]?.id || "");
  const [editPid, setEditPid] = useState(null);
  const [editPname, setEditPname] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const prod = products.find(p => p.id === activePid);
  const upd = (fn) => setProducts(prev => prev.map(p => p.id === activePid ? fn(p) : p));

  const addProd = (tag) => {
    const np = { id: genId(), name: `새 품목 (${tag})`, tag, usps: [] };
    setProducts(prev => [...prev, np]);
    setActivePid(np.id);
  };
  const renameProd = (id, name) => setProducts(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  const deleteProd = (id) => { setProducts(prev => prev.filter(p => p.id !== id)); setActivePid(products[0]?.id || ""); };

  const addUsp = () => upd(p => ({ ...p, usps: [...p.usps, { id: genId(), label: "", copies: [] }] }));
  const editUsp = (uid, label) => upd(p => ({ ...p, usps: p.usps.map(u => u.id === uid ? { ...u, label } : u) }));
  const deleteUsp = (uid) => upd(p => ({ ...p, usps: p.usps.filter(u => u.id !== uid) }));
  const addCopy = (uid) => upd(p => ({ ...p, usps: p.usps.map(u => u.id === uid ? { ...u, copies: [...u.copies, { id: genId(), text: "" }] } : u) }));
  const editCopy = (uid, cid, text) => upd(p => ({ ...p, usps: p.usps.map(u => u.id === uid ? { ...u, copies: u.copies.map(c => c.id === cid ? { ...c, text } : c) } : u) }));
  const deleteCopy = (uid, cid) => upd(p => ({ ...p, usps: p.usps.map(u => u.id === uid ? { ...u, copies: u.copies.filter(c => c.id !== cid) } : u) }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">품목 · 편익 · 카피를 3단계로 설정하세요</p>
        <div className="flex gap-2">
          <button onClick={() => addProd("MAIN")} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full">+ MAIN 품목</button>
          <button onClick={() => addProd("SUB")} className="text-xs bg-gray-700 text-white px-3 py-1.5 rounded-full">+ SUB 품목</button>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mb-5">
        {products.map(p => (
          <div key={p.id} className="flex items-center">
            {editPid === p.id ? (
              <input autoFocus className="text-xs border border-gray-300 rounded-full px-3 py-1.5 w-36 focus:outline-none"
                value={editPname} onChange={e => setEditPname(e.target.value)}
                onBlur={() => { renameProd(p.id, editPname); setEditPid(null); }}
                onKeyDown={e => e.key === "Enter" && (renameProd(p.id, editPname), setEditPid(null))} />
            ) : (
              <button onClick={() => setActivePid(p.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${activePid === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-600"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${p.tag === "MAIN" ? "bg-indigo-400" : "bg-gray-400"}`} />
                {p.name}
                {activePid === p.id && <>
                  <span onClick={e => { e.stopPropagation(); setEditPid(p.id); setEditPname(p.name); }} className="opacity-50 hover:opacity-100 cursor-pointer ml-1">✏️</span>
                  <span onClick={e => { e.stopPropagation(); setDeleteTarget(p.id); }} className="opacity-50 hover:opacity-100 cursor-pointer text-red-400">×</span>
                </>}
              </button>
            )}
          </div>
        ))}
      </div>
      {prod ? (
        <div className="space-y-4">
          {prod.usps.map(u => (
            <div key={u.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                <input className="flex-1 font-semibold text-sm border-0 border-b border-dashed border-gray-200 px-1 py-0.5 focus:outline-none focus:border-black"
                  value={u.label} onChange={e => editUsp(u.id, e.target.value)} placeholder="핵심편익 이름" />
                <button onClick={() => addCopy(u.id)} className="text-xs text-indigo-600 hover:underline whitespace-nowrap">+ 카피 추가</button>
                <button onClick={() => setDeleteTarget({ type: "usp", uid: u.id })} className="text-gray-300 hover:text-red-400 text-lg">×</button>
              </div>
              <div className="space-y-2 pl-4">
                {u.copies.map((c, ci) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-300 w-4 flex-shrink-0">{ci + 1}</span>
                    <input className="flex-1 text-sm border border-gray-100 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10"
                      value={c.text} onChange={e => editCopy(u.id, c.id, e.target.value)} placeholder="카피 텍스트" />
                    <button onClick={() => setDeleteTarget({ type: "copy", uid: u.id, cid: c.id })} className="text-gray-300 hover:text-red-400 text-base">×</button>
                  </div>
                ))}
                {u.copies.length === 0 && <p className="text-xs text-gray-300 italic">카피를 추가해보세요</p>}
              </div>
            </div>
          ))}
          <button onClick={addUsp} className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-xs text-gray-400 hover:border-gray-400 transition">+ 편익(USP) 추가</button>
        </div>
      ) : <p className="text-sm text-gray-400 text-center py-16">품목을 선택하거나 추가하세요</p>}

      {deleteTarget && (
        <PasswordConfirm
          onConfirm={() => {
            if (typeof deleteTarget === "string") deleteProd(deleteTarget);
            else if (deleteTarget.type === "usp") deleteUsp(deleteTarget.uid);
            else if (deleteTarget.type === "copy") deleteCopy(deleteTarget.uid, deleteTarget.cid);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ── TAB 2: Contents Dashboard (USP 맵) ───────────────────────
function WinningOverviewTab({ products, assets, csvRows }) {
  const winningAssets = assets.filter(a => a.isWinning);
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0, 10);
  const byProduct = {};
  products.forEach(p => { byProduct[p.id] = []; });
  winningAssets.forEach(a => { if (byProduct[a.productId]) byProduct[a.productId].push(a); });

  return (
    <div>
      <div className="mb-5">
        <p className="text-sm font-semibold text-gray-800 mb-0.5">🏆 위닝 소재 전체</p>
        <p className="text-xs text-gray-400">품목별 위닝 소재를 모아봅니다</p>
      </div>
      {winningAssets.length === 0 ? (
        <div className="text-center py-24 text-gray-300"><p className="text-5xl mb-4">🏆</p><p className="text-sm">소재 아카이브에서 위닝 소재를 체크해주세요</p></div>
      ) : (
        <div className="space-y-6">
          {products.map(p => {
            const items = byProduct[p.id] || [];
            if (items.length === 0) return null;
            return (
              <div key={p.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${p.tag === "MAIN" ? "bg-indigo-400" : "bg-gray-400"}`} />
                  <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                  <span className="text-xs text-amber-500 font-medium">{items.length}개</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {items.map(a => (
                    <div key={a.id} className="rounded-xl overflow-hidden border border-amber-200 bg-white shadow-sm">
                      {(() => { const m = getAssetMetrics(a.title, csvRows, weekAgo, today); return (
                      a.thumbUrl ? (
                        <div className="relative cursor-pointer" style={{ aspectRatio: "4/5" }} onClick={() => a.videoUrl && window.open(a.videoUrl, "_blank")}>
                          <img src={a.thumbUrl} alt="" className="w-full h-full object-cover" />
                          {a.videoUrl && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><div className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center"><span className="text-xs ml-0.5">▶</span></div></div>}
                          {m?.roas && m.roas !== "—" && <span className="absolute top-1 left-1 text-xs font-bold px-1.5 py-0.5 rounded bg-amber-400 text-white leading-tight">{m.roas}</span>}
                          <span className="absolute top-1 right-1 text-sm">🏆</span>
                        </div>
                      ) : (
                        <div className="bg-amber-50 flex items-center justify-center" style={{ aspectRatio: "4/5" }}>
                          <span className="text-2xl">🏆</span>
                        </div>
                      )); })()}
                      <div className="p-2">
                        <p className="text-xs font-semibold text-gray-700 truncate">{a.title || "(제목 없음)"}</p>
                        {a.mainCopy && <p className="text-xs text-indigo-500 truncate mt-0.5">💬 {a.mainCopy}</p>}
                        {a.insight && <p className="text-xs text-gray-400 truncate mt-0.5">📝 {a.insight}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ContentsDashboardTab({ products, assets, csvRows }) {
  const [activeView, setActiveView] = useState("winning");
  const [activePid, setActivePid] = useState(products[0]?.id || "");
  const prod = products.find(p => p.id === activePid);

  const grouped = {};
  prod.usps.forEach(u => { grouped[u.id] = []; });
  // USP 없는 소재도 'none' 버킷에
  grouped["__none__"] = [];
  assets.filter(a => a.productId === activePid).forEach(a => {
    if (a.uspId && grouped[a.uspId]) grouped[a.uspId].push(a);
    else grouped["__none__"].push(a);
  });

  const totalAssets = assets.filter(a => a.productId === activePid).length;
  const coveredUsps = prod.usps.filter(u => (grouped[u.id] || []).length > 0).length;

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-5">
        <button onClick={() => setActiveView("winning")}
          className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${activeView === "winning" ? "bg-amber-400 text-white border-amber-400" : "border-gray-200 text-gray-500"}`}>
          🏆 위닝 전체
        </button>
        {products.map(p => (
          <button key={p.id} onClick={() => { setActiveView("product"); setActivePid(p.id); }}
            className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${activeView === "product" && activePid === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.tag === "MAIN" ? "bg-indigo-400" : "bg-gray-400"}`} />
            {p.name}
          </button>
        ))}
      </div>
      {activeView === "winning" ? <WinningOverviewTab products={products} assets={assets} csvRows={csvRows} /> : (
      <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm"><p className="text-2xl font-black">{prod.usps.length}</p><p className="text-xs text-gray-400 mt-0.5">전체 편익 꼭지</p></div>
        <div className="bg-white border border-indigo-100 rounded-xl p-4 text-center shadow-sm"><p className="text-2xl font-black text-indigo-600">{coveredUsps}</p><p className="text-xs text-gray-400 mt-0.5">소재 있는 꼭지</p></div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm"><p className="text-2xl font-black">{totalAssets}</p><p className="text-xs text-gray-400 mt-0.5">이 품목 소재 수</p></div>
      </div>
      {prod.usps.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-16">제품X편익 탭에서 편익 꼭지를 먼저 추가하세요</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {grouped["__none__"]?.length > 0 && (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-4 shadow-sm md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-gray-300" />
                <p className="text-sm font-semibold text-gray-500">USP 미분류 소재</p>
                <span className="text-xs text-gray-400">{grouped["__none__"].length}개</span>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {grouped["__none__"].map(a => (
                  <div key={a.id} className="rounded-xl overflow-hidden border border-gray-100">
                    {a.thumbUrl ? (
                      <div className="relative cursor-pointer" style={{ aspectRatio: "4/5" }} onClick={() => a.videoUrl && window.open(a.videoUrl, "_blank")}>
                        <img src={a.thumbUrl} alt="" className="w-full h-full object-cover" />
                        {a.videoUrl && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><div className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center"><span className="text-xs ml-0.5">▶</span></div></div>}
                      </div>
                    ) : (
                      <div className="bg-gray-50 flex items-center justify-center" style={{ aspectRatio: "4/5" }}>
                        <span className="text-xl text-gray-200">🎬</span>
                      </div>
                    )}
                    <div className="p-1.5"><p className="text-xs text-gray-600 truncate">{a.title || "(제목없음)"}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {prod.usps.map(u => {
            const items = grouped[u.id] || [];
            return (
              <div key={u.id} className={`bg-white border rounded-xl p-4 shadow-sm ${items.length === 0 ? "border-dashed border-gray-200" : "border-gray-100"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${items.length > 0 ? "bg-indigo-400" : "bg-gray-200"}`} />
                    <p className="text-sm font-semibold text-gray-800">{u.label}</p>
                  </div>
                  <span className="text-xs text-gray-400">{items.length}개</span>
                </div>
                {u.copies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {u.copies.map(c => <span key={c.id} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">{c.text}</span>)}
                  </div>
                )}
                {items.length === 0 ? <p className="text-xs text-gray-300 italic">아직 소재 없음</p> : (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {items.map(a => {
                      const copyText = u.copies.find(c => c.id === a.copyId)?.text;
                      return (
                        <div key={a.id} className={`rounded-xl overflow-hidden border ${a.isWinning ? "border-amber-300" : a.result === "best" ? "border-emerald-300" : a.result === "worst" ? "border-red-200" : "border-gray-100"}`}>
                          {a.thumbUrl ? (
                            <div className="relative cursor-pointer" style={{ aspectRatio: "4/5" }} onClick={() => a.videoUrl && window.open(a.videoUrl, "_blank")}>
                              <img src={a.thumbUrl} alt="" className="w-full h-full object-cover" />
                              {a.videoUrl && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><div className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center"><span className="text-xs ml-0.5">▶</span></div></div>}
                              {a.isWinning && <span className="absolute top-1 right-1 text-sm">🏆</span>}
                            </div>
                          ) : (
                            <div className="bg-gray-50 flex items-center justify-center" style={{ aspectRatio: "4/5" }}>
                              <span className="text-2xl text-gray-200">🎬</span>
                            </div>
                          )}
                          <div className="p-2">
                            <p className="text-xs font-semibold text-gray-700 truncate">{a.title || "(제목 없음)"}</p>
                            {a.mainCopy && <p className="text-xs text-indigo-500 truncate mt-0.5">💬 {a.mainCopy}</p>}
                            {copyText && <p className="text-xs text-gray-400 truncate mt-0.5">📝 {copyText}</p>}
                            <p className="text-xs text-gray-400 mt-0.5">{a.status === "ON" ? "🟢 ON" : "⚫ OFF"}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
      )}
    </div>
  );
}

// ── TAB 3: narka archive (소재 아카이브) ─────────────────────
function AssetForm({ asset, products, onSave, onClose }) {
  const [form, setForm] = useState(asset || {
    id: genId(), productId: products[0]?.id || "", uspId: "", copyId: "",
    title: "", mainCopy: "", painpoint: "", benefit: "",
    result: "none", isWinning: false, status: "ON",
    insight: "", nextDev: "",
    thumbUrl: "", videoUrl: "",
    setupDate: new Date().toISOString().slice(0, 10),
  });
  const set = k => v => setForm(f => ({ ...f, [k]: v }));
  const selProd = products.find(p => p.id === form.productId);
  const selUsp = selProd?.usps.find(u => u.id === form.uspId);

  const handleThumb = e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => set("thumbUrl")(ev.target.result);
    r.readAsDataURL(file);
  };
  const handlePaste = e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        const r = new FileReader();
        r.onload = ev => set("thumbUrl")(ev.target.result);
        r.readAsDataURL(file);
        break;
      }
    }
  };

  return (
    <Modal onClose={onClose} wide>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-base">소재 {asset ? "수정" : "등록"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="space-y-4">
          <div>
            <Label>품목</Label>
            <div className="flex flex-wrap gap-2">
              {products.map(p => (
                <button key={p.id} onClick={() => { set("productId")(p.id); set("uspId")(""); set("copyId")(""); }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1 ${form.productId === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-600"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.tag === "MAIN" ? "bg-indigo-400" : "bg-gray-400"}`} />{p.name}
                </button>
              ))}
            </div>
          </div>
          {selProd?.usps.length > 0 && (
            <div>
              <Label>편익 (USP)</Label>
              <div className="flex flex-wrap gap-2">
                {selProd.usps.map(u => (
                  <button key={u.id} onClick={() => { set("uspId")(u.id); set("copyId")(""); }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${form.uspId === u.id ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-600"}`}>
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selUsp?.copies.length > 0 && (
            <div>
              <Label>적용 카피</Label>
              <div className="flex flex-wrap gap-2">
                {selUsp.copies.map(c => (
                  <button key={c.id} onClick={() => set("copyId")(c.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${form.copyId === c.id ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-600"}`}>
                    {c.text}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Divider />
          <div>
            <Label>소재 제목 (광고명과 동일하게, [ ] 안에 키워드)</Label>
            <TF value={form.title} onChange={set("title")} placeholder="ex. [세범_정수리샷]_v3" />
            <p className="text-xs text-gray-400 mt-1">[ ] 안의 키워드로 META RAW 성과를 자동 매칭합니다</p>
          </div>
          <div>
            <Label>메인 카피</Label>
            <TF value={form.mainCopy || ""} onChange={set("mainCopy")} placeholder="ex. 하루종일 무너지지 않는 스타일" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>페인포인트</Label><TA value={form.painpoint} onChange={set("painpoint")} placeholder="소비자 불편" rows={2} /></div>
            <div><Label>소구 편익</Label><TA value={form.benefit} onChange={set("benefit")} placeholder="전달하는 이점" rows={2} /></div>
          </div>
          <Divider />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>대표 이미지 (캡처본)</Label>
              {form.thumbUrl ? (
                <div className="relative group cursor-pointer" style={{ aspectRatio: "4/5", maxHeight: 220 }}
                  onPaste={handlePaste} tabIndex={0} onClick={() => set("thumbUrl")("")}>
                  <img src={form.thumbUrl} alt="" className="w-full h-full object-cover rounded-xl border border-gray-200" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 rounded-xl flex flex-col items-center justify-center gap-1">
                    <span className="text-white text-xs">클릭하여 제거</span>
                    <span className="text-white/70 text-xs">Ctrl+V로 교체</span>
                  </div>
                </div>
              ) : (
                <div onPaste={handlePaste} tabIndex={0}
                  className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-xs text-gray-400 hover:border-indigo-300 transition gap-2 cursor-text"
                  style={{ aspectRatio: "4/5", maxHeight: 220 }}>
                  <span className="text-2xl">📋</span>
                  <span>Ctrl+V 붙여넣기</span>
                  <span className="text-gray-300">이미지 복사 후 클릭 → Ctrl+V</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <Label>Dropbox / Drive 링크</Label>
                <TF value={form.videoUrl} onChange={set("videoUrl")} placeholder="https://dropbox.com/..." />
                <p className="text-xs text-gray-400 mt-1">이미지 클릭 시 링크로 이동</p>
              </div>
              <div>
                <Label>최초 세팅 날짜</Label>
                <input type="date" value={form.setupDate} onChange={e => set("setupDate")(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            </div>
          </div>
          <Divider />
          <div className="flex flex-wrap gap-4">
            <div>
              <Label>라이브 상태</Label>
              <div className="flex gap-2">
                {["ON", "OFF"].map(s => (
                  <button key={s} onClick={() => set("status")(s)}
                    className={`text-xs px-4 py-1.5 rounded-full border transition font-semibold ${form.status === s ? (s === "ON" ? "bg-emerald-500 text-white border-emerald-500" : "bg-gray-700 text-white border-gray-700") : "border-gray-200 text-gray-500"}`}>
                    {s === "ON" ? "🟢 ON" : "⚫ OFF"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>결과 분류</Label>
              <div className="flex gap-2">
                {[{ v: "none", l: "미분류" }, { v: "best", l: "✅ BEST" }, { v: "worst", l: "❌ WORST" }].map(r => (
                  <button key={r.v} onClick={() => set("result")(r.v)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${form.result === r.v ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{r.l}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => set("isWinning")(!form.isWinning)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${form.isWinning ? "bg-amber-400 text-white border-amber-400" : "border-gray-200 text-gray-600"}`}>
              🏆 위닝 소재
            </button>
          </div>
          <div><Label>분석 메모</Label><TA value={form.insight} onChange={set("insight")} placeholder="왜 잘됐나 / 왜 안됐나" rows={2} /></div>
          <div><Label>추가 개발 방향</Label><TF value={form.nextDev} onChange={set("nextDev")} placeholder="다음 변주 포인트" /></div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500">취소</button>
          <button onClick={() => { onSave(form); onClose(); }} className="flex-1 bg-black text-white rounded-xl py-2.5 text-sm font-semibold">저장</button>
        </div>
      </div>
    </Modal>
  );
}

function AssetCard({ asset, products, csvRows, perfFrom = null, perfTo = null, onClick }) {
  const prod = products.find(p => p.id === asset.productId);
  const usp = prod?.usps.find(u => u.id === asset.uspId);
  const metrics = getAssetMetrics(asset.title, csvRows, perfFrom, perfTo);
  const borderClass = asset.isWinning ? "border-amber-300" : asset.result === "best" ? "border-emerald-300" : asset.result === "worst" ? "border-red-200" : "border-gray-100";

  return (
    <div className={`bg-white border ${borderClass} rounded-xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer`} onClick={onClick}>
      {asset.thumbUrl ? (
        <div className="relative" style={{ aspectRatio: "4/5" }} onClick={e => { if (asset.videoUrl) { e.stopPropagation(); window.open(asset.videoUrl, "_blank"); } }}>
          <img src={asset.thumbUrl} alt="" className="w-full h-full object-cover" />
          {asset.videoUrl && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><div className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center"><span className="text-sm ml-0.5">▶</span></div></div>}
          {asset.isWinning && <span className="absolute top-2 right-2 text-base">🏆</span>}
          <span className={`absolute top-2 left-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${asset.status === "ON" ? "bg-emerald-500 text-white" : "bg-gray-700 text-white"}`}>{asset.status || "ON"}</span>
        </div>
      ) : (
        <div className="bg-gray-50 flex items-center justify-center relative" style={{ aspectRatio: "4/5" }}>
          <span className="text-3xl text-gray-200">🎬</span>
          <span className={`absolute top-2 left-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${asset.status === "ON" ? "bg-emerald-500 text-white" : "bg-gray-700 text-white"}`}>{asset.status || "ON"}</span>
        </div>
      )}
      <div className="p-3">
        <p className="text-xs font-semibold text-gray-800 leading-snug mb-1 truncate">{asset.title || "(제목 없음)"}</p>
        {asset.mainCopy && <p className="text-xs text-indigo-500 truncate mb-1">💬 {asset.mainCopy}</p>}
        <div className="flex flex-wrap gap-1 mb-1">
          {prod && <Pill color={prod.tag === "MAIN" ? "indigo" : "gray"}>{prod.name}</Pill>}
          {asset.result === "best" && <Pill color="emerald">BEST</Pill>}
          {asset.result === "worst" && <Pill color="red">WORST</Pill>}
        </div>
        {asset.setupDate && <p className="text-xs text-gray-400">세팅: {asset.setupDate}</p>}
        {metrics ? (
          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
            {[["ROAS", metrics.roas], ["CTR", metrics.ctr], ["CPM", metrics.cpm], ["CPC", metrics.cpc], ["지출", metrics.spend], ["전환값", metrics.convValue], ["전환율", metrics.convRate]].map(([k, v]) => (
              <p key={k} className="text-xs text-gray-500"><span className="text-gray-400">{k} </span>{v}</p>
            ))}
          </div>
        ) : <p className="text-xs text-gray-300 mt-1">성과 데이터 없음</p>}
      </div>
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "roas_desc", label: "ROAS 높은 순", key: "_roas", dir: -1 },
  { value: "ctr_desc", label: "CTR 높은 순", key: "_ctr", dir: -1 },
  { value: "cpc_asc", label: "CPC 낮은 순", key: "_cpc", dir: 1 },
  { value: "convRate_desc", label: "전환율 높은 순", key: "_convRate", dir: -1 },
  { value: "spend_desc", label: "지출 높은 순", key: "_spend", dir: -1 },
  { value: "convValue_desc", label: "전환값 높은 순", key: "_convValue", dir: -1 },
];

function NarkaArchiveTab({ assets, setAssets, products, csvRows }) {
  const [ymFilter, setYmFilter] = useState("all");
  const [filterProd, setFilterProd] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterResult, setFilterResult] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  // 성과 날짜 필터 (기본: 최근 7일)
  const [perfFrom, setPerfFrom] = useState(() => new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0, 10));
  const [perfTo, setPerfTo] = useState(() => new Date().toISOString().slice(0, 10));
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0, 10);

  const handleSave = a => setAssets(prev => { const e = prev.find(x => x.id === a.id); return e ? prev.map(x => x.id === a.id ? a : x) : [...prev, a]; });
  const handleDelete = id => setAssets(prev => prev.filter(a => a.id !== id));

  let filtered = assets.filter(a =>
    matchYM(a.setupDate || a.date, ymFilter) &&
    (filterProd === "all" || a.productId === filterProd) &&
    (filterResult === "all" || a.result === filterResult) &&
    (filterStatus === "all" || a.status === filterStatus)
  );

  if (sortBy) {
    const opt = SORT_OPTIONS.find(o => o.value === sortBy);
    if (opt) filtered = [...filtered].sort((a, b) => {
      const ma = getAssetMetrics(a.title, csvRows, perfFrom, perfTo);
      const mb = getAssetMetrics(b.title, csvRows, perfFrom, perfTo);
      const va = ma?.[opt.key] || 0;
      const vb = mb?.[opt.key] || 0;
      return (va - vb) * opt.dir;
    });
  }

  return (
    <div>
      <div className="space-y-3 mb-5">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-8 pt-1">월</span>
          <YearMonthFilter value={ymFilter} onChange={setYmFilter} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-8">품목</span>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilterProd("all")} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterProd === "all" ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>전체</button>
            {products.map(p => <button key={p.id} onClick={() => setFilterProd(p.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterProd === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p.name}</button>)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-8">결과</span>
          <div className="flex gap-1">
            {[["all","전체"],["best","BEST"],["worst","WORST"]].map(([v,l]) => <button key={v} onClick={() => setFilterResult(v)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterResult === v ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{l}</button>)}
          </div>
          <div className="flex gap-1 ml-2">
            {[["all","전체"],["ON","🟢 ON"],["OFF","⚫ OFF"]].map(([v,l]) => <button key={v} onClick={() => setFilterStatus(v)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterStatus === v ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{l}</button>)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-8">정렬</span>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setSortBy("")} className={`text-xs px-2.5 py-1 rounded-full border transition ${sortBy === "" ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>기본</button>
            {SORT_OPTIONS.map(o => <button key={o.value} onClick={() => setSortBy(o.value)} className={`text-xs px-2.5 py-1 rounded-full border transition ${sortBy === o.value ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{o.label}</button>)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-8">성과</span>
          <input type="date" value={perfFrom} onChange={e => setPerfFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none" />
          <span className="text-xs text-gray-400">~</span>
          <input type="date" value={perfTo} onChange={e => setPerfTo(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none" />
          <button onClick={() => { setPerfFrom(weekAgo); setPerfTo(today); }} className="text-xs text-gray-400 hover:text-gray-600 underline">최근 7일</button>
        </div>
      </div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400">{filtered.length}개 소재</p>
          <button onClick={() => { setSelectMode(v => !v); setSelected(new Set()); }}
            className={`text-xs px-3 py-1 rounded-full border transition ${selectMode ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500"}`}>
            {selectMode ? "선택 취소" : "선택 삭제"}
          </button>
          {selectMode && selected.size > 0 && (
            <button onClick={() => setDeleteTarget("multi")}
              className="text-xs px-3 py-1 rounded-full bg-red-500 text-white">
              {selected.size}개 삭제
            </button>
          )}
          {selectMode && (
            <button onClick={() => setSelected(new Set(filtered.map(a => a.id)))}
              className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-500">
              전체 선택
            </button>
          )}
        </div>
        <button onClick={() => { setEditAsset(null); setShowForm(true); }} className="bg-black text-white text-xs px-4 py-2 rounded-full hover:bg-gray-800">+ 소재 추가</button>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-300"><p className="text-4xl mb-3">🎬</p><p className="text-sm">소재를 추가해보세요</p></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(a => (
            <div key={a.id} className="relative group">
              {selectMode && (
                <div className="absolute top-2 left-2 z-20 cursor-pointer"
                  onClick={e => { e.stopPropagation(); setSelected(prev => { const n = new Set(prev); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; }); }}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selected.has(a.id) ? "bg-indigo-600 border-indigo-600" : "bg-white border-gray-300"}`}>
                    {selected.has(a.id) && <span className="text-white text-xs">✓</span>}
                  </div>
                </div>
              )}
              <div className={selected.has(a.id) ? "ring-2 ring-indigo-500 rounded-xl" : ""}>
                <AssetCard asset={a} products={products} csvRows={csvRows} perfFrom={perfFrom} perfTo={perfTo}
                  onClick={() => { if (selectMode) { setSelected(prev => { const n = new Set(prev); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; }); } else { setEditAsset(a); setShowForm(true); } }} />
              </div>
              {!selectMode && (
                <button onClick={e => { e.stopPropagation(); setDeleteTarget(a.id); }}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center z-10">
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {showForm && <AssetForm asset={editAsset} products={products} onSave={handleSave} onClose={() => { setShowForm(false); setEditAsset(null); }} />}
      {deleteTarget && (
        <PasswordConfirm
          message={deleteTarget === "multi" ? `${selected.size}개 소재를 삭제하시겠습니까?` : "삭제하려면 비밀번호를 입력하세요"}
          onConfirm={() => {
            if (deleteTarget === "multi") {
              setAssets(prev => prev.filter(a => !selected.has(a.id)));
              setSelected(new Set());
              setSelectMode(false);
            } else {
              handleDelete(deleteTarget);
            }
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ── TAB 4: Developer (주간 회의) ──────────────────────────────
function AssetPicker({ assets, products, csvRows, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [filterPid, setFilterPid] = useState("all");
  const filtered = assets.filter(a =>
    (filterPid === "all" || a.productId === filterPid) &&
    (!search || a.title?.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <Modal onClose={onClose}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-sm">소재 선택</h3><button onClick={onClose} className="text-gray-400 hover:text-black text-xl">✕</button></div>
        <TF value={search} onChange={setSearch} placeholder="소재명 검색..." className="mb-3" />
        <div className="flex gap-1.5 flex-wrap mb-3">
          <button onClick={() => setFilterPid("all")} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterPid === "all" ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>전체</button>
          {products.map(p => <button key={p.id} onClick={() => setFilterPid(p.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterPid === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p.name}</button>)}
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {filtered.map(a => {
            const prod = products.find(p => p.id === a.productId);
            const metrics = getAssetMetrics(a.title, csvRows, null, null);
            return (
              <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-gray-300 cursor-pointer transition" onClick={() => { onSelect(a); onClose(); }}>
                {a.thumbUrl ? <img src={a.thumbUrl} alt="" className="w-10 h-16 object-cover rounded-lg flex-shrink-0" /> : <div className="w-10 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><span className="text-lg">🎬</span></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{a.title || "(제목 없음)"}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {prod && <Pill color={prod.tag === "MAIN" ? "indigo" : "gray"}>{prod.name}</Pill>}
                    {a.result === "best" && <Pill color="emerald">BEST</Pill>}
                    {a.result === "worst" && <Pill color="red">WORST</Pill>}
                    {a.isWinning && <Pill color="amber">🏆위닝</Pill>}
                  </div>
                  {metrics && <p className="text-xs text-gray-400 mt-0.5">ROAS {metrics.roas} · CTR {metrics.ctr}</p>}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">소재가 없습니다</p>}
        </div>
      </div>
    </Modal>
  );
}

function SelectedAssetRow({ assetId, memo, assets, products, csvRows, onMemoChange, onRemove }) {
  const a = assets.find(x => x.id === assetId);
  const prod = a ? products.find(p => p.id === a.productId) : null;
  const metrics = a ? getAssetMetrics(a.title, csvRows, null, null) : null;
  if (!a) return null;
  return (
    <div className="border border-gray-100 rounded-xl p-3 mb-2 bg-white">
      <div className="flex items-start gap-3 mb-2">
        {a.thumbUrl ? <img src={a.thumbUrl} alt="" className="w-10 h-16 object-cover rounded-lg flex-shrink-0" onClick={() => a.videoUrl && window.open(a.videoUrl, "_blank")} style={{ cursor: a.videoUrl ? "pointer" : "default" }} /> : <div className="w-10 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><span className="text-xl">🎬</span></div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{a.title || "(제목 없음)"}</p>
          <div className="flex gap-1 flex-wrap mt-0.5">
            {prod && <Pill color="indigo">{prod.name}</Pill>}
            {a.result === "best" && <Pill color="emerald">BEST</Pill>}
            {a.result === "worst" && <Pill color="red">WORST</Pill>}
          </div>
          {metrics && (
            <div className="flex gap-3 mt-1">
              {[["ROAS",metrics.roas],["CTR",metrics.ctr],["지출",metrics.spend]].map(([k,v]) => <span key={k} className="text-xs text-gray-500"><span className="text-gray-400">{k} </span>{v}</span>)}
            </div>
          )}
        </div>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0">×</button>
      </div>
      <TA value={memo} onChange={onMemoChange} placeholder="운영 성과 및 BEST/WORST 분석 이유" rows={2} />
    </div>
  );
}

function DeveloperTab({ meetings, setMeetings, products, assets, csvRows }) {
  const blank = () => ({
    id: genId(), date: new Date().toISOString().slice(0, 10),
    meetingNote: "", newAssetComment: "",
    uspCheck: {}, uspNotes: {},
    byProduct: {},
    contentsPDNote: "", contentsPDBest: [], contentsPDWorst: [],
  });
  const [activeIdx, setActiveIdx] = useState(0);
  const [draft, setDraft] = useState(null);
  const [activePid, setActivePid] = useState(products[0]?.id || "");
  const [pickerFor, setPickerFor] = useState(null);
  const [showCal, setShowCal] = useState(false);

  const form = draft || meetings[activeIdx];
  const upd = v => setDraft(v);
  const save = () => { if (draft) { setMeetings(prev => prev.map((m, i) => i === activeIdx ? draft : m)); setDraft(null); } };

  const getBP = pid => form?.byProduct?.[pid] || { bestItems: [], worstItems: [], nextDev: "" };
  const setBP = (pid, field, val) => upd({ ...form, byProduct: { ...form.byProduct, [pid]: { ...getBP(pid), [field]: val } } });
  const addAsset = (pid, type, id) => {
    const bp = getBP(pid);
    const field = type === "best" ? "bestItems" : "worstItems";
    if (bp[field].find(x => x.assetId === id)) return;
    setBP(pid, field, [...bp[field], { assetId: id, memo: "" }]);
  };
  const updMemo = (pid, type, id, memo) => {
    const bp = getBP(pid); const field = type === "best" ? "bestItems" : "worstItems";
    setBP(pid, field, bp[field].map(x => x.assetId === id ? { ...x, memo } : x));
  };
  const remAsset = (pid, type, id) => {
    const bp = getBP(pid); const field = type === "best" ? "bestItems" : "worstItems";
    setBP(pid, field, bp[field].filter(x => x.assetId !== id));
  };

  const getUC = (pid, uid) => form?.uspCheck?.[pid]?.[uid] || "none";
  const setUC = (pid, uid, val) => upd({ ...form, uspCheck: { ...form.uspCheck, [pid]: { ...(form.uspCheck?.[pid] || {}), [uid]: val } } });
  const getUN = (pid, uid) => form?.uspNotes?.[pid]?.[uid] || "";
  const setUN = (pid, uid, val) => upd({ ...form, uspNotes: { ...form.uspNotes, [pid]: { ...(form.uspNotes?.[pid] || {}), [uid]: val } } });

  // 최근 7일 신규 소재
  const recentAssets = (() => {
    if (!form?.date) return [];
    const base = new Date(form.date);
    const week = new Date(base); week.setDate(week.getDate() - 7);
    return assets.filter(a => {
      const d = new Date(a.setupDate || a.date || "");
      return d >= week && d <= base;
    });
  })();

  if (!form && meetings.length === 0) return (
    <div className="text-center py-20">
      <p className="text-sm text-gray-400 mb-3">아직 회의 기록이 없어요</p>
      <button onClick={() => { const m = blank(); setMeetings(prev => [m, ...prev]); setActiveIdx(0); }} className="bg-black text-white text-sm px-5 py-2 rounded-full">+ 첫 회의 시작</button>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        <button onClick={() => { const m = blank(); setMeetings(prev => [m, ...prev]); setActiveIdx(0); setDraft(null); }} className="bg-black text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0">+ 새 회의</button>
        {meetings.map((m, i) => <button key={m.id} onClick={() => { setActiveIdx(i); setDraft(null); }} className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 transition ${activeIdx === i ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{m.date}</button>)}
      </div>
      {form && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <input type="date" value={form.date} onChange={e => upd({ ...form, date: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
            {draft && <button onClick={save} className="bg-emerald-500 text-white text-xs px-4 py-1.5 rounded-full font-medium">저장하기</button>}
          </div>

          {/* Meeting Note */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <p className="font-bold text-sm mb-3">📝 Meeting Note</p>
            <p className="text-xs text-gray-400 mb-2">회의 내용, 링크, 이미지(붙여넣기) 등 자유롭게 기록하세요</p>
            <div contentEditable suppressContentEditableWarning
              className="min-h-32 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              onBlur={e => upd({ ...form, meetingNote: e.currentTarget.innerHTML })}
              dangerouslySetInnerHTML={{ __html: form.meetingNote || "" }}
              onPaste={e => {
                const items = e.clipboardData.items;
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.indexOf("image") !== -1) {
                    e.preventDefault();
                    const file = items[i].getAsFile();
                    const reader = new FileReader();
                    reader.onload = ev => {
                      document.execCommand("insertImage", false, ev.target.result);
                      upd({ ...form, meetingNote: e.currentTarget.innerHTML });
                    };
                    reader.readAsDataURL(file);
                  }
                }
              }}
            />
          </div>

          {/* 지난주 신규 소재 */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <p className="font-bold text-sm mb-1">📊 지난 주 신규 소재 투입 결과</p>
            <p className="text-xs text-gray-400 mb-3">회의일 기준 최근 7일 내 최초 세팅된 소재</p>
            {recentAssets.length === 0 ? (
              <p className="text-xs text-gray-300 py-4 text-center">최근 7일 내 등록된 소재가 없습니다</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                {recentAssets.map(a => {
                  const metrics = getAssetMetrics(a.title, csvRows, null, null);
                  return (
                    <div key={a.id} className="border border-gray-100 rounded-xl p-2">
                      {a.thumbUrl && <img src={a.thumbUrl} alt="" className="w-full h-20 object-cover rounded-lg mb-1" />}
                      <p className="text-xs font-semibold truncate">{a.title}</p>
                      <p className="text-xs text-gray-400">세팅: {a.setupDate}</p>
                      {metrics && <p className="text-xs text-indigo-500">ROAS {metrics.roas} · CTR {metrics.ctr}</p>}
                    </div>
                  );
                })}
              </div>
            )}
            <TA value={form.newAssetComment || ""} onChange={v => upd({ ...form, newAssetComment: v })} placeholder="코멘트를 남겨주세요" rows={2} />
          </div>

          {/* Next Action */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <p className="font-bold text-sm mb-4">🎯 품목별 Next Action</p>
            <div className="flex gap-2 flex-wrap mb-4">{products.map(p => <button key={p.id} onClick={() => setActivePid(p.id)} className={`text-xs px-3 py-1 rounded-full border transition ${activePid === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p.name}</button>)}</div>
            {(() => {
              const prod = products.find(p => p.id === activePid);
              if (!prod || prod.usps.length === 0) return <p className="text-xs text-gray-400">제품X편익 탭에서 편익을 먼저 추가하세요</p>;
              // 이 회의록에서만 숨긴 USP 목록 (제품X편익에는 영향 없음)
              const hiddenUsps = form?.hiddenUsps?.[activePid] || [];
              const visibleUsps = prod.usps.filter(u => !hiddenUsps.includes(u.id));
              const hideUsp = (uid) => {
                const current = form?.hiddenUsps?.[activePid] || [];
                upd({ ...form, hiddenUsps: { ...(form.hiddenUsps || {}), [activePid]: [...current, uid] } });
              };
              return (
                <div className="space-y-3">
                  {hiddenUsps.length > 0 && (
                    <button onClick={() => upd({ ...form, hiddenUsps: { ...(form.hiddenUsps || {}), [activePid]: [] } })}
                      className="text-xs text-gray-400 hover:text-gray-600 underline">
                      숨긴 편익 {hiddenUsps.length}개 복원
                    </button>
                  )}
                  {visibleUsps.map(u => (
                    <div key={u.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-gray-700">{u.label}</span>
                        <div className="flex gap-1 ml-auto flex-wrap">
                          {["none","진행중","완료","미개발"].map(s => (
                            <button key={s} onClick={() => setUC(activePid, u.id, s)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition ${getUC(activePid, u.id) === s ? "bg-black text-white border-black" : "border-gray-200 text-gray-400"}`}>
                              {s === "none" ? "—" : s}
                            </button>
                          ))}
                          <button onClick={() => hideUsp(u.id)} className="text-gray-300 hover:text-red-400 text-sm ml-1" title="이 회의록에서만 숨기기">×</button>
                        </div>
                      </div>
                      {u.copies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {u.copies.map(c => {
                            const hiddenCopies = form?.hiddenCopies?.[activePid]?.[u.id] || [];
                            if (hiddenCopies.includes(c.id)) return null;
                            return (
                              <div key={c.id} className="flex items-center gap-1 bg-white border border-gray-100 rounded px-2 py-0.5">
                                <span className="text-xs text-gray-500">{c.text}</span>
                                <button onClick={() => {
                                  const curr = form?.hiddenCopies?.[activePid]?.[u.id] || [];
                                  upd({ ...form, hiddenCopies: { ...(form.hiddenCopies || {}), [activePid]: { ...(form.hiddenCopies?.[activePid] || {}), [u.id]: [...curr, c.id] } } });
                                }} className="text-gray-300 hover:text-red-400 text-xs leading-none">×</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <input className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                        value={getUN(activePid, u.id)} onChange={e => setUN(activePid, u.id, e.target.value)}
                        placeholder="Next Action 메모" />
                    </div>
                  ))}
                  {visibleUsps.length === 0 && <p className="text-xs text-gray-400 text-center py-4">모든 편익이 숨겨졌습니다. 위 복원 버튼을 눌러주세요</p>}
                </div>
              );
            })()}
          </div>

          {/* Performance (기획자) */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 shadow-sm">
            <p className="font-bold text-sm mb-1">📊 Performance</p>
            <p className="text-xs text-gray-400 mb-4">품목별 BEST/WORST 소재를 선택하고 분석 메모를 남기세요 (여기서 삭제해도 제품X편익에 영향 없음)</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {products.filter(p => !(form?.hiddenPerfProducts || []).includes(p.id)).map(p => (
                <div key={p.id} className="flex items-center gap-0.5">
                  <button onClick={() => setActivePid(p.id)} className={`text-xs px-3 py-1 rounded-full border transition ${activePid === p.id ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500"}`}>{p.name}</button>
                  <button onClick={() => upd({ ...form, hiddenPerfProducts: [...(form.hiddenPerfProducts || []), p.id] })} className="text-gray-300 hover:text-red-400 text-sm">×</button>
                </div>
              ))}
              {(form?.hiddenPerfProducts || []).length > 0 && (
                <button onClick={() => upd({ ...form, hiddenPerfProducts: [] })} className="text-xs text-gray-400 hover:text-gray-600 underline">복원</button>
              )}
            </div>
            {(() => {
              const bp = getBP(activePid);
              return (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-emerald-600">✅ BEST 소재</p>
                      <button onClick={() => setPickerFor({ pid: activePid, type: "best" })} className="text-xs text-blue-500 hover:underline">+ 소재 선택</button>
                    </div>
                    {(bp.bestItems || []).map(item => <SelectedAssetRow key={item.assetId} assetId={item.assetId} memo={item.memo} assets={assets} products={products} csvRows={csvRows} onMemoChange={v => updMemo(activePid, "best", item.assetId, v)} onRemove={() => remAsset(activePid, "best", item.assetId)} />)}
                    {!(bp.bestItems || []).length && <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">소재를 선택해주세요</p>}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-red-500">❌ WORST 소재</p>
                      <button onClick={() => setPickerFor({ pid: activePid, type: "worst" })} className="text-xs text-blue-500 hover:underline">+ 소재 선택</button>
                    </div>
                    {(bp.worstItems || []).map(item => <SelectedAssetRow key={item.assetId} assetId={item.assetId} memo={item.memo} assets={assets} products={products} csvRows={csvRows} onMemoChange={v => updMemo(activePid, "worst", item.assetId, v)} onRemove={() => remAsset(activePid, "worst", item.assetId)} />)}
                    {!(bp.worstItems || []).length && <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">소재를 선택해주세요</p>}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-600 mb-1.5">→ 위닝 소재 외 추가 개발 방향</p>
                    <TA value={bp.nextDev || ""} onChange={v => setBP(activePid, "nextDev", v)} placeholder="다음 개발할 꼭지 / 변주 아이디어" rows={2} />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Contents PD (제작자) */}
          <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-5 shadow-sm">
            <p className="font-bold text-sm mb-1">🎨 Contents PD</p>
            <p className="text-xs text-gray-400 mb-4">기존 라이브된 소재에서 개선이 필요한 사항에 대해 회고하고, 새롭게 시도할 소재에 대한 레퍼런스를 미리 준비하세요 (여기서 삭제해도 제품X편익에 영향 없음)</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {products.filter(p => !(form?.hiddenPDProducts || []).includes(p.id)).map(p => (
                <div key={p.id} className="flex items-center gap-0.5">
                  <button onClick={() => setActivePid(p.id)} className={`text-xs px-3 py-1 rounded-full border transition ${activePid === p.id ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-500"}`}>{p.name}</button>
                  <button onClick={() => upd({ ...form, hiddenPDProducts: [...(form.hiddenPDProducts || []), p.id] })} className="text-gray-300 hover:text-red-400 text-sm">×</button>
                </div>
              ))}
              {(form?.hiddenPDProducts || []).length > 0 && (
                <button onClick={() => upd({ ...form, hiddenPDProducts: [] })} className="text-xs text-gray-400 hover:text-gray-600 underline">복원</button>
              )}
            </div>
            {(() => {
              const bp = getBP(activePid);
              return (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-emerald-600">✅ BEST 소재</p>
                      <button onClick={() => setPickerFor({ pid: activePid, type: "pdBest" })} className="text-xs text-purple-500 hover:underline">+ 소재 선택</button>
                    </div>
                    {(form?.contentsPDBest || []).map(item => <SelectedAssetRow key={item.assetId} assetId={item.assetId} memo={item.memo} assets={assets} products={products} csvRows={csvRows} onMemoChange={v => upd({ ...form, contentsPDBest: form.contentsPDBest.map(x => x.assetId === item.assetId ? { ...x, memo: v } : x) })} onRemove={() => upd({ ...form, contentsPDBest: form.contentsPDBest.filter(x => x.assetId !== item.assetId) })} />)}
                    {!(form?.contentsPDBest || []).length && <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">소재를 선택해주세요</p>}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-red-500">❌ WORST 소재</p>
                      <button onClick={() => setPickerFor({ pid: activePid, type: "pdWorst" })} className="text-xs text-purple-500 hover:underline">+ 소재 선택</button>
                    </div>
                    {(form?.contentsPDWorst || []).map(item => <SelectedAssetRow key={item.assetId} assetId={item.assetId} memo={item.memo} assets={assets} products={products} csvRows={csvRows} onMemoChange={v => upd({ ...form, contentsPDWorst: form.contentsPDWorst.map(x => x.assetId === item.assetId ? { ...x, memo: v } : x) })} onRemove={() => upd({ ...form, contentsPDWorst: form.contentsPDWorst.filter(x => x.assetId !== item.assetId) })} />)}
                    {!(form?.contentsPDWorst || []).length && <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">소재를 선택해주세요</p>}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">📋 자유 메모 (이미지 붙여넣기 가능)</p>
                    <div contentEditable suppressContentEditableWarning
                      className="min-h-24 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white"
                      onBlur={e => upd({ ...form, contentsPDNote: e.currentTarget.innerHTML })}
                      dangerouslySetInnerHTML={{ __html: form.contentsPDNote || "" }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          {draft && (
            <div className="flex gap-2 pb-6">
              <button onClick={() => setDraft(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500">되돌리기</button>
              <button onClick={save} className="flex-1 bg-black text-white rounded-xl py-2.5 text-sm font-semibold">저장</button>
            </div>
          )}
        </div>
      )}
      {pickerFor && (
        <AssetPicker assets={assets} products={products} csvRows={csvRows}
          onSelect={a => {
            if (pickerFor.type === "best") addAsset(pickerFor.pid, "best", a.id);
            else if (pickerFor.type === "worst") addAsset(pickerFor.pid, "worst", a.id);
            else if (pickerFor.type === "pdBest") upd({ ...form, contentsPDBest: [...(form.contentsPDBest || []), { assetId: a.id, memo: "" }] });
            else if (pickerFor.type === "pdWorst") upd({ ...form, contentsPDWorst: [...(form.contentsPDWorst || []), { assetId: a.id, memo: "" }] });
          }}
          onClose={() => setPickerFor(null)} />
      )}
    </div>
  );
}


// ── 원본 데이터 테이블 (정렬 + 전체 보기) ────────────────────
const RAW_COLS = [
  { key: "live", label: "라이브", sortKey: "endDate" },
  { key: "startDate", label: "시작일" },
  { key: "endDate", label: "종료일" },
  { key: "adName", label: "광고명" },
  { key: "roas", label: "ROAS", num: true },
  { key: "ctr", label: "CTR", num: true },
  { key: "cpc", label: "CPC", num: true },
  { key: "cpm", label: "CPM", num: true },
  { key: "spend", label: "지출", num: true },
  { key: "convValue", label: "매출", num: true },
];

function RawDataTable({ filtered }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const [showAll, setShowAll] = useState(false);
  const PAGE = 30;
  const dateFiltered = filtered;

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sorted = [...dateFiltered].sort((a, b) => {
    if (!sortCol) return 0;
    const col = RAW_COLS.find(c => c.key === sortCol);
    const sk = col?.sortKey || sortCol;
    const va = parseFloat(a[sk]) || 0;
    const vb = parseFloat(b[sk]) || 0;
    if (col?.num || col?.sortKey) return sortDir === "desc" ? vb - va : va - vb;
    return sortDir === "desc"
      ? String(b[sk] || "").localeCompare(String(a[sk] || ""))
      : String(a[sk] || "").localeCompare(String(b[sk] || ""));
  });

  const displayed = showAll ? sorted : sorted.slice(0, PAGE);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500">전체 원본 데이터 ({dateFiltered.length}행)</p>
        {dateFiltered.length > PAGE && (
          <button onClick={() => setShowAll(v => !v)} className="text-xs text-indigo-500 hover:underline">
            {showAll ? "접기 ▲" : `전체 보기 (${filtered.length}행) ▼`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              {RAW_COLS.map(col => (
                <th key={col.key}
                  className="text-left py-2 pr-4 text-gray-400 font-medium whitespace-nowrap cursor-pointer hover:text-gray-700 select-none"
                  onClick={() => handleSort(col.key)}>
                  {col.label}
                  {sortCol === col.key ? (sortDir === "desc" ? " ↓" : " ↑") : " ↕"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((r, i) => {
              const live = getLiveStatus(r.endDate);
              return (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4">
                    <span title={live === "live" ? "라이브 중" : "종료"}>
                      {live === "live" ? "🟢" : "⚫"}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{r.startDate ? r.startDate.slice(0,10) : "—"}</td>
                  <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{r.endDate ? r.endDate.slice(0,10) : "—"}</td>
                  <td className="py-2 pr-4 max-w-[200px] truncate text-gray-700">{r.adName || "—"}</td>
                  <td className="py-2 pr-4 font-semibold text-emerald-600">{r.roas ? `${Math.round(parseFloat(r.roas))}%` : "—"}</td>
                  <td className="py-2 pr-4">{r.ctr ? `${(parseFloat(r.ctr)/100).toFixed(2)}%` : "—"}</td>
                  <td className="py-2 pr-4">{r.cpc ? `₩${Math.round(parseFloat(r.cpc)).toLocaleString()}` : "—"}</td>
                  <td className="py-2 pr-4">{r.cpm ? `₩${Math.round(parseFloat(r.cpm)).toLocaleString()}` : "—"}</td>
                  <td className="py-2 pr-4">{r.spend ? `₩${Math.round(parseFloat(r.spend)).toLocaleString()}` : "—"}</td>
                  <td className="py-2 pr-4">{r.convValue ? `₩${Math.round(parseFloat(r.convValue)).toLocaleString()}` : "—"}</td>
                </tr>
              );
            })}
            {displayed.length === 0 && (
              <tr><td colSpan={10} className="py-8 text-center text-gray-300">데이터가 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!showAll && dateFiltered.length > PAGE && (
        <button onClick={() => setShowAll(true)} className="w-full mt-3 py-2 text-xs text-indigo-500 hover:bg-indigo-50 rounded-lg transition">
          + {dateFiltered.length - PAGE}행 더 보기 ▼
        </button>
      )}
    </div>
  );
}

// ── TAB 5: META RAW ───────────────────────────────────────────
function MetaRawTab({ csvRows, setCsvRows, assets, setAssets, products }) {
  const [filterProd, setFilterProd] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [metaDatePreset, setMetaDatePreset] = useState("last_7d");
  const [metaLoading, setMetaLoading] = useState(false);

  const fetchMetaAPI = async () => {
    setMetaLoading(true);
    try {
      const res = await fetch(`/api/meta?date_preset=${metaDatePreset}`);
      const json = await res.json();
      if (json.error) { alert("메타 연동 오류: " + json.error); return; }
      setCsvRows(json.rows || []);
    } catch (e) {
      alert("메타 연동 실패: " + e.message);
    } finally {
      setMetaLoading(false);
    }
  };

  const csvAddRef = useRef();
  const csvReplaceRef = useRef();

  const handleCSV = (mode) => (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      const rawRows = parseCSV(ev.target.result);
      if (rawRows.length > 0) {
        console.log("CSV 헤더:", Object.keys(rawRows[0]));
        console.log("첫번째 행:", rawRows[0]);
      }
      const newRows = rawRows.map(normRow);
      if (newRows.length > 0) {
        console.log("매핑 후 첫번째 행:", newRows[0]);
      }
      if (mode === "add") {
        setCsvRows(prev => [...prev, ...newRows]);
      } else {
        setCsvRows(newRows);
      }
    };
    r.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const matchedRows = csvRows
    .filter(row => (parseFloat(row.spend) || 0) >= 0) // 필터 해제 - 전체 표시
    .map(row => {
      const adNameLower = (row.adName || "").toLowerCase();
      // 1. 소재 아카이브에서 제목 매칭
      const asset = assets.find(a => {
        const bracket = a.title?.match(/\[([^\]]+)\]/);
        const key = bracket ? bracket[1].toLowerCase() : (a.title || "").toLowerCase();
        return key && adNameLower.includes(key);
      });
      if (asset) return { ...row, assetId: asset.id, productId: asset.productId };
      // 2. 품목명 키워드로 productId 추정 (광고명 전체에서 품목명 검색)
      const matchedProd = products.find(p => {
        const pname = p.name.toLowerCase();
        // 광고명 전체에서 품목명 또는 주요 키워드 포함 여부 확인
        if (adNameLower.includes(pname)) return true;
        // 품목명 단어별로 검색 (2글자 이상)
        const words = pname.split(/\s+/).filter(w => w.length >= 2);
        return words.some(w => adNameLower.includes(w));
      });
      return { ...row, assetId: null, productId: matchedProd?.id || null };
    });

  const filtered = matchedRows.filter(r => {
    if (filterProd !== "all" && r.productId !== filterProd) return false;
    if (dateFrom && r.startDate && r.startDate.slice(0,10) < dateFrom) return false;
    if (dateTo && r.endDate && r.endDate.slice(0,10) > dateTo) return false;
    return true;
  });
  const sum = k => filtered.reduce((a, r) => { const v = parseFloat(String(r[k] || "0").replace(/[%,\s]/g,"")) || 0; return a + v; }, 0);
  const avg = k => filtered.length ? sum(k) / filtered.length : 0;
  const totalSpend = sum("spend");
  const totalConv = sum("convValue");
  const allRoas = filtered.map(r => parseFloat(String(r.roas||"").replace(/%/g,"")) || 0).filter(v => v > 0);
  const avgRoas = allRoas.length > 0 ? `${Math.round(allRoas.reduce((a,b)=>a+b,0)/allRoas.length)}%` : "—";
  const allCtr = filtered.map(r => parseFloat(String(r.ctr||"").replace(/%/g,"")) || 0).filter(v => v > 0);
  const avgCtrDisplay = allCtr.length > 0 ? `${(allCtr.reduce((a,b)=>a+b,0)/allCtr.length/100).toFixed(2)}%` : "—";



  return (
    <div>
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-sm mb-0.5">메타 광고 데이터</p>
            <p className="text-xs text-gray-400">🔄 메타 자동 연동 또는 CSV 업로드. [ ] 키워드로 소재 자동 매칭.</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-gray-400">기간</span>
              {[["last_7d","7일"],["last_14d","14일"],["last_30d","30일"],["last_90d","90일"]].map(([v,l]) => (
                <button key={v} onClick={() => setMetaDatePreset(v)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${metaDatePreset === v ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {csvRows.length > 0 && (
              <span className="text-xs text-emerald-600 font-medium">{csvRows.length}행</span>
            )}
            <input type="file" accept=".csv" ref={csvAddRef} onChange={handleCSV("add")} className="hidden" />
            <input type="file" accept=".csv" ref={csvReplaceRef} onChange={handleCSV("replace")} className="hidden" />
            <button onClick={fetchMetaAPI} disabled={metaLoading}
              className={`text-xs px-4 py-2 rounded-full font-semibold transition ${metaLoading ? "bg-gray-300 text-gray-500" : "bg-emerald-500 text-white hover:bg-emerald-600"}`}>
              {metaLoading ? "불러오는 중..." : "🔄 메타 자동 연동"}
            </button>
            <button onClick={() => csvAddRef.current.click()} className="bg-indigo-600 text-white text-xs px-4 py-2 rounded-full hover:bg-indigo-700">+ CSV 추가</button>
            <button onClick={() => csvReplaceRef.current.click()} className="bg-black text-white text-xs px-4 py-2 rounded-full hover:bg-gray-800">CSV 교체</button>
            {csvRows.length > 0 && (
              <button onClick={() => setCsvRows([])} className="text-xs px-3 py-2 rounded-full border border-red-200 text-red-400 hover:bg-red-50">초기화</button>
            )}
          </div>
        </div>
      </div>

      {csvRows.length === 0 ? (
        <div className="text-center py-24 text-gray-300"><p className="text-5xl mb-4">📊</p><p className="text-sm font-medium">CSV를 업로드하면 광고 성과가 표시됩니다</p></div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-xs text-gray-400">품목</span>
            <button onClick={() => setFilterProd("all")} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterProd === "all" ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>전체</button>
            {products.map(p => <button key={p.id} onClick={() => setFilterProd(p.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterProd === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p.name}</button>)}
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="text-xs text-gray-400">기간</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none" />
            <span className="text-xs text-gray-400">~</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none" />
            {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-gray-400 hover:text-gray-600 underline">초기화</button>}
          </div>

          {(() => {
            const totalConvValue = sum("convValue");
            const summaryCards = [
              ["통합 ROAS", avgRoas, "green"],
              ["총 소진 예산", totalSpend ? `₩${Math.round(totalSpend).toLocaleString()}` : "—", "blue"],
              ["전환 매출", totalConvValue ? `₩${Math.round(totalConvValue).toLocaleString()}` : "—", "purple"],
              ["평균 CTR", avgCtrDisplay, "amber"],
              ["평균 CPM", avg("cpm") ? `₩${Math.round(avg("cpm")).toLocaleString()}` : "—", "gray"],
            ];
            return (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                {summaryCards.map(([l, v, c]) => (
                  <div key={l} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <p className="text-xs text-gray-400 mb-1">{l}</p>
                    <p className={`text-xl font-black ${c === "green" ? "text-emerald-600" : c === "blue" ? "text-blue-600" : c === "purple" ? "text-purple-600" : c === "amber" ? "text-amber-600" : "text-gray-800"}`}>{v}</p>
                  </div>
                ))}
              </div>
            );
          })()}
          {(() => {
            // 미매칭 소재 중 [ ] 키워드 있는 것만 추출 (중복 제거)
            const seen = new Set();
            const unmatched = matchedRows.filter(r => {
              if (r.assetId) return false;
              const b = (r.adName||"").match(/\[([^\]]+)\]/);
              if (!b) return false;
              if (seen.has(b[1])) return false;
              seen.add(b[1]);
              return true;
            });
            if (!unmatched.length) return null;
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm mb-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-amber-700">📥 아카이브 미등록 소재 ({unmatched.length}개)</p>
                  <button onClick={() => {
                    unmatched.forEach(r => {
                      const b = (r.adName||"").match(/\[([^\]]+)\]/);
                      const title = b ? `[${b[1]}]` : r.adName;
                      const matchedProd = products.find(p => {
                        const pname = p.name.toLowerCase();
                        return (r.adName||"").toLowerCase().includes(pname) ||
                          pname.split(" ").some(w => w.length >= 2 && (r.adName||"").toLowerCase().includes(w));
                      });
                      const newAsset = {
                        id: `id_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
                        productId: matchedProd?.id || products[0]?.id || "",
                        uspId: "", copyId: "", title,
                        painpoint: "", benefit: "", result: "none",
                        isWinning: false, status: "ON", insight: "", nextDev: "",
                        thumbUrl: "", videoUrl: "",
                        setupDate: new Date().toISOString().slice(0, 10),
                      };
                      setAssets(prev => prev.find(a => a.title === title) ? prev : [...prev, newAsset]);
                    });
                    alert(`${unmatched.length}개 소재를 narka archive에 추가했습니다!`);
                  }} className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-full hover:bg-amber-600">
                    + 전체 아카이브에 추가
                  </button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {unmatched.map((r, i) => {
                    const b = (r.adName||"").match(/\[([^\]]+)\]/);
                    return (
                      <div key={i} className="flex items-center justify-between text-xs py-1 px-2 bg-white rounded-lg">
                        <span className="text-gray-700 truncate">{b ? `[${b[1]}]` : r.adName}</span>
                        <button onClick={() => {
                          const title = b ? `[${b[1]}]` : r.adName;
                          if (assets.find(a => a.title === title)) { alert("이미 등록된 소재입니다"); return; }
                          const matchedProd = products.find(p => {
                            const pname = p.name.toLowerCase();
                            return (r.adName||"").toLowerCase().includes(pname);
                          });
                          setAssets(prev => [...prev, {
                            id: `id_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
                            productId: matchedProd?.id || products[0]?.id || "",
                            uspId: "", copyId: "", title,
                            painpoint: "", benefit: "", result: "none",
                            isWinning: false, status: "ON", insight: "", nextDev: "",
                            thumbUrl: "", videoUrl: "",
                            setupDate: new Date().toISOString().slice(0, 10),
                          }]);
                          alert(`[${b?.[1]}] 소재를 추가했습니다`);
                        }} className="text-xs text-indigo-500 hover:underline ml-2 flex-shrink-0">추가</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <RawDataTable filtered={filtered} />
        </>
      )}
    </div>
  );
}

// ── TAB 6: Reference ─────────────────────────────────────────
const INIT_COUNTRIES = [{ id: "kr", name: "한국" }, { id: "us", name: "미국" }, { id: "jp", name: "일본" }];
const INIT_REF_CATS = [{ id: "haircare", name: "헤어케어" }, { id: "styling", name: "헤어 스타일링" }, { id: "beauty", name: "뷰티" }];
const INIT_BRANDS = [{ id: "anove", name: "어노브" }, { id: "lilyeve", name: "릴리이브" }];

function ReferenceTab({ references, setReferences }) {
  const [countries, setCountries] = useState(INIT_COUNTRIES);
  const [cats, setCats] = useState(INIT_REF_CATS);
  const [brands, setBrands] = useState(INIT_BRANDS);
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editRef, setEditRef] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addingTag, setAddingTag] = useState(null);
  const [newTagName, setNewTagName] = useState("");

  const filtered = references.filter(r =>
    (filterCountry === "all" || r.country === filterCountry) &&
    (filterCat === "all" || r.category === filterCat) &&
    (filterBrand === "all" || r.brand === filterBrand)
  );

  const handleSave = r => setReferences(prev => { const e = prev.find(x => x.id === r.id); return e ? prev.map(x => x.id === r.id ? r : x) : [...prev, r]; });

  const addTag = (type) => {
    if (!newTagName.trim()) return;
    const item = { id: genId(), name: newTagName.trim() };
    if (type === "country") setCountries(p => [...p, item]);
    else if (type === "cat") setCats(p => [...p, item]);
    else setBrands(p => [...p, item]);
    setNewTagName(""); setAddingTag(null);
  };

  const FilterRow = ({ label, type, items, value, onChange }) => (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400 w-12">{label}</span>
      <button onClick={() => onChange("all")} className={`text-xs px-2.5 py-1 rounded-full border transition ${value === "all" ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>전체</button>
      {items.map(it => (
        <div key={it.id} className="flex items-center gap-0.5">
          <button onClick={() => onChange(it.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${value === it.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{it.name}</button>
          <button onClick={() => setDeleteTarget({ type, id: it.id })} className="text-gray-300 hover:text-red-400 text-xs">×</button>
        </div>
      ))}
      {addingTag === type ? (
        <div className="flex gap-1 items-center">
          <input autoFocus className="text-xs border border-gray-300 rounded-full px-2.5 py-1 w-24 focus:outline-none" value={newTagName} onChange={e => setNewTagName(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag(type)} placeholder="이름 입력" />
          <button onClick={() => addTag(type)} className="text-xs text-indigo-600">✓</button>
          <button onClick={() => setAddingTag(null)} className="text-xs text-gray-400">✕</button>
        </div>
      ) : (
        <button onClick={() => setAddingTag(type)} className="text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-500">+</button>
      )}
    </div>
  );

  return (
    <div>
      <div className="space-y-2 mb-5">
        <FilterRow label="국가" type="country" items={countries} value={filterCountry} onChange={setFilterCountry} />
        <FilterRow label="카테고리" type="cat" items={cats} value={filterCat} onChange={setFilterCat} />
        <FilterRow label="브랜드" type="brand" items={brands} value={filterBrand} onChange={setFilterBrand} />
      </div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-gray-400">{filtered.length}개 레퍼런스</p>
        <button onClick={() => { setEditRef(null); setShowForm(true); }} className="bg-black text-white text-xs px-4 py-2 rounded-full">+ 레퍼런스 추가</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(r => (
          <div key={r.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition group relative cursor-pointer" onClick={() => { setEditRef(r); setShowForm(true); }}>
            {r.thumbUrl ? <img src={r.thumbUrl} alt="" className="w-full h-36 object-cover" onClick={e => { if (r.url) { e.stopPropagation(); window.open(r.url, "_blank"); } }} /> : <div className="h-36 bg-gray-50 flex items-center justify-center cursor-pointer" onClick={e => { if (r.url) { e.stopPropagation(); window.open(r.url, "_blank"); } }}><span className="text-3xl text-gray-200">🔗</span></div>}
            <button onClick={e => { e.stopPropagation(); setDeleteTarget({ type: "ref", id: r.id }); }} className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center">×</button>
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-800 line-clamp-2 mb-1">{r.title || "(제목 없음)"}</p>
              <div className="flex gap-1 flex-wrap">
                {r.country && <Pill color="blue">{countries.find(c => c.id === r.country)?.name}</Pill>}
                {r.brand && <Pill color="gray">{brands.find(b => b.id === r.brand)?.name || r.brand}</Pill>}
                {r.category && <Pill color="purple">{cats.find(c => c.id === r.category)?.name}</Pill>}
              </div>
              {r.memo && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{r.memo}</p>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-20 text-gray-300"><p className="text-4xl mb-3">🔍</p><p className="text-sm">레퍼런스를 추가해보세요</p></div>}
      </div>
      {showForm && <RefForm ref_={editRef} countries={countries} cats={cats} brands={brands} onSave={handleSave} onClose={() => { setShowForm(false); setEditRef(null); }} />}
      {deleteTarget && (
        <PasswordConfirm
          onConfirm={() => {
            if (deleteTarget.type === "ref") setReferences(prev => prev.filter(r => r.id !== deleteTarget.id));
            else if (deleteTarget.type === "country") setCountries(prev => prev.filter(c => c.id !== deleteTarget.id));
            else if (deleteTarget.type === "cat") setCats(prev => prev.filter(c => c.id !== deleteTarget.id));
            else if (deleteTarget.type === "brand") setBrands(prev => prev.filter(b => b.id !== deleteTarget.id));
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function RefForm({ ref_, countries, cats, brands, onSave, onClose }) {
  const [form, setForm] = useState(ref_ || { id: genId(), country: "", category: "", brand: "", title: "", url: "", thumbUrl: "", memo: "" });
  const set = k => v => setForm(f => ({ ...f, [k]: v }));
  const handleThumb = e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = ev => set("thumbUrl")(ev.target.result); r.readAsDataURL(file); };
  const handlePaste = e => { const items = e.clipboardData?.items; if (!items) return; for (let i = 0; i < items.length; i++) { if (items[i].type.indexOf("image") !== -1) { const file = items[i].getAsFile(); const r = new FileReader(); r.onload = ev => set("thumbUrl")(ev.target.result); r.readAsDataURL(file); break; } } };
  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-sm">레퍼런스 {ref_ ? "수정" : "추가"}</h2><button onClick={onClose} className="text-gray-400 hover:text-black text-xl">✕</button></div>
        <div className="space-y-3">
          <div><Label>국가</Label><div className="flex gap-1.5 flex-wrap">{countries.map(c => <button key={c.id} onClick={() => set("country")(c.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${form.country === c.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{c.name}</button>)}</div></div>
          <div><Label>카테고리</Label><div className="flex gap-1.5 flex-wrap">{cats.map(c => <button key={c.id} onClick={() => set("category")(c.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${form.category === c.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{c.name}</button>)}</div></div>
          <div><Label>브랜드</Label><div className="flex gap-1.5 flex-wrap">{brands.map(b => <button key={b.id} onClick={() => set("brand")(b.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${form.brand === b.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{b.name}</button>)}</div></div>
          <div><Label>제목/설명</Label><TF value={form.title} onChange={set("title")} placeholder="레퍼런스 제목" /></div>
          <div><Label>링크 (광고 라이브러리 등)</Label><TF value={form.url} onChange={set("url")} placeholder="https://..." /></div>
          <div><Label>대표 이미지</Label>
            <label className="block cursor-pointer">
              {form.thumbUrl ? (
                <div className="relative group cursor-pointer" onClick={() => set("thumbUrl")("")}>
                  <img src={form.thumbUrl} alt="" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center"><span className="text-white text-xs">클릭하여 제거</span></div>
                </div>
              ) : (
                <div onPaste={handlePaste} tabIndex={0} className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-xs text-gray-400 hover:border-indigo-300 transition gap-1 cursor-text">
                  <span className="text-2xl">📋</span><span>Ctrl+V 붙여넣기</span><span className="text-gray-300">이미지 복사 후 클릭 → Ctrl+V</span>
                </div>
              )}
            </label>
          </div>
          <div><Label>메모</Label><TA value={form.memo} onChange={set("memo")} placeholder="자유 메모" rows={2} /></div>
        </div>
        <div className="flex gap-2 mt-5"><button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500">취소</button><button onClick={() => { onSave(form); onClose(); }} className="flex-1 bg-black text-white rounded-xl py-2 text-sm font-semibold">저장</button></div>
      </div>
    </Modal>
  );
}

// ── TAB 7: Creator ────────────────────────────────────────────
function CreatorTab({ products, creators, setCreators }) {
  const [filterPid, setFilterPid] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editCreator, setEditCreator] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = creators.filter(c => filterPid === "all" || c.productId === filterPid);
  const handleSave = c => setCreators(prev => { const e = prev.find(x => x.id === c.id); return e ? prev.map(x => x.id === c.id ? c : x) : [...prev, c]; });

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <span className="text-xs text-gray-400">품목</span>
        <button onClick={() => setFilterPid("all")} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterPid === "all" ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>전체</button>
        {products.map(p => <button key={p.id} onClick={() => setFilterPid(p.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterPid === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p.name}</button>)}
        <button onClick={() => { setEditCreator(null); setShowForm(true); }} className="ml-auto bg-black text-white text-xs px-4 py-2 rounded-full">+ 크리에이터 추가</button>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-300"><p className="text-4xl mb-3">🌟</p><p className="text-sm">시딩 크리에이터를 추가해보세요</p></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(c => {
            const prod = products.find(p => p.id === c.productId);
            return (
              <div key={c.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition group relative cursor-pointer" onClick={() => { setEditCreator(c); setShowForm(true); }}>
                {c.thumbUrl ? <div style={{ aspectRatio: "4/5" }}><img src={c.thumbUrl} alt="" className="w-full h-full object-cover" /></div> : <div className="bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center" style={{ aspectRatio: "4/5" }}><span className="text-4xl">🌟</span></div>}
                <button onClick={e => { e.stopPropagation(); setDeleteTarget(c.id); }} className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center">×</button>
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.handle}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {prod && <Pill color={prod.tag === "MAIN" ? "indigo" : "gray"}>{prod.name}</Pill>}
                    {c.platform && <Pill color="purple">{c.platform}</Pill>}
                    {c.followers && <span className="text-xs text-gray-400">{c.followers}</span>}
                  </div>
                  {c.contentUrl && <a href={c.contentUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-indigo-500 hover:underline mt-1 block truncate">콘텐츠 보기 →</a>}
                  {c.memo && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.memo}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showForm && <CreatorForm creator={editCreator} products={products} onSave={handleSave} onClose={() => { setShowForm(false); setEditCreator(null); }} />}
      {deleteTarget && <PasswordConfirm onConfirm={() => { setCreators(prev => prev.filter(c => c.id !== deleteTarget)); setDeleteTarget(null); }} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}

function CreatorForm({ creator, products, onSave, onClose }) {
  const [form, setForm] = useState(creator || { id: genId(), productId: products[0]?.id || "", name: "", handle: "", platform: "Instagram", followers: "", contentUrl: "", thumbUrl: "", memo: "" });
  const set = k => v => setForm(f => ({ ...f, [k]: v }));
  const handleThumb = e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = ev => set("thumbUrl")(ev.target.result); r.readAsDataURL(file); };
  const handlePaste = e => { const items = e.clipboardData?.items; if (!items) return; for (let i = 0; i < items.length; i++) { if (items[i].type.indexOf("image") !== -1) { const file = items[i].getAsFile(); const r = new FileReader(); r.onload = ev => set("thumbUrl")(ev.target.result); r.readAsDataURL(file); break; } } };
  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-sm">크리에이터 {creator ? "수정" : "추가"}</h2><button onClick={onClose} className="text-gray-400 hover:text-black text-xl">✕</button></div>
        <div className="space-y-3">
          <div><Label>품목</Label><div className="flex gap-1.5 flex-wrap">{products.map(p => <button key={p.id} onClick={() => set("productId")(p.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${form.productId === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p.name}</button>)}</div></div>
          <div><Label>플랫폼</Label><div className="flex gap-1.5">{["Instagram","TikTok","YouTube"].map(p => <button key={p} onClick={() => set("platform")(p)} className={`text-xs px-2.5 py-1 rounded-full border transition ${form.platform === p ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p}</button>)}</div></div>
          <div><Label>크리에이터 이름</Label><TF value={form.name} onChange={set("name")} placeholder="이름" /></div>
          <div><Label>계정 핸들</Label><TF value={form.handle} onChange={set("handle")} placeholder="@handle" /></div>
          <div><Label>팔로워 수</Label><TF value={form.followers} onChange={set("followers")} placeholder="ex. 12.5만" /></div>
          <div><Label>콘텐츠 링크</Label><TF value={form.contentUrl} onChange={set("contentUrl")} placeholder="https://instagram.com/..." /></div>
          <div><Label>프로필/콘텐츠 이미지</Label>
            {form.thumbUrl ? (
              <div className="relative group cursor-pointer" onClick={() => set("thumbUrl")("")}>
                <img src={form.thumbUrl} alt="" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center"><span className="text-white text-xs">클릭하여 제거</span></div>
              </div>
            ) : (
              <div onPaste={handlePaste} tabIndex={0} className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-xs text-gray-400 hover:border-indigo-300 transition gap-1 cursor-text">
                <span className="text-2xl">📋</span>
                <span>Ctrl+V 붙여넣기</span>
                <span className="text-gray-300">이미지 복사 후 클릭 → Ctrl+V</span>
              </div>
            )}
          </div>
          <div><Label>메모</Label><TA value={form.memo} onChange={set("memo")} placeholder="특이사항, 협의 내용 등" rows={2} /></div>
        </div>
        <div className="flex gap-2 mt-5"><button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500">취소</button><button onClick={() => { onSave(form); onClose(); }} className="flex-1 bg-black text-white rounded-xl py-2 text-sm font-semibold">저장</button></div>
      </div>
    </Modal>
  );
}

// ── IMPORT / EXPORT ───────────────────────────────────────────
function useImportExport({ products, setProducts, assets, setAssets, meetings, setMeetings, references, setReferences, csvRows, setCsvRows, creators, setCreators }) {
  const importRef = useRef();
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ products, assets, meetings, references, csvRows, creators }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `narka-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  const importData = e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.products) setProducts(d.products);
        if (d.assets) setAssets(d.assets);
        if (d.meetings) setMeetings(d.meetings);
        if (d.references) setReferences(d.references);
        if (d.csvRows) setCsvRows(d.csvRows);
        if (d.creators) setCreators(d.creators);
        alert("불러오기 완료!");
      } catch { alert("파일 형식 오류"); }
    };
    r.readAsText(file);
  };
  return { importRef, exportData, importData };
}

// ── 메인 앱 ──────────────────────────────────────────────────
const TABS = [
  { id: "dashboard", label: "📊 Contents Dashboard" },
  { id: "usp", label: "🗂 제품X편익" },
  { id: "archive", label: "🎬 narka archive" },
  { id: "metaraw", label: "📈 META RAW" },
  { id: "meeting", label: "📋 Developer" },
  { id: "reference", label: "🔍 Reference" },
  { id: "creator", label: "🌟 Creator" },
];

export default function App() {
  const { user, authLoaded, accessDenied, signIn, signOut } = useAuth();

  if (!authLoaded) return (
    <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center">
      <div className="text-center"><p className="text-2xl mb-2">🎬</p><p className="text-sm text-gray-400">로딩 중...</p></div>
    </div>
  );

  if (!user) return <LoginScreen onSignIn={signIn} accessDenied={accessDenied} />;

  return <AppInner user={user} signOut={signOut} />;
}

function usePresence(user) {
  const [onlineMembers, setOnlineMembers] = useState([]);
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("narka-presence", { config: { presence: { key: user.email } } });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const members = Object.values(state).map(arr => arr[0]).filter(Boolean);
        setOnlineMembers(members);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: user.name || user.email?.split("@")[0], email: user.email });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [user]);
  return onlineMembers;
}

function MemberBadge({ members }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 cursor-default select-none">
        <span>💛</span>
        <span>멤버 {members.length}</span>
      </div>
      {show && members.length > 0 && (
        <div className="absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-lg p-3 z-50 min-w-[140px]">
          <p className="text-xs text-gray-400 mb-2 font-medium">지금 접속 중</p>
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-700 py-0.5">
              <span>💛</span>
              <span>{m.name || m.email}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AppInner({ user, signOut }) {
  const getInitialTab = () => {
    const hash = window.location.hash.replace("#", "");
    const validTabs = ["dashboard","usp","archive","meeting","metaraw","reference","creator"];
    return validTabs.includes(hash) ? hash : "archive";
  };
  const [tab, setTabRaw] = useState(getInitialTab);
  const setTab = (t) => { setTabRaw(t); window.location.hash = t; };
  const { products, setProducts, assets, setAssets, meetings, setMeetings, references, setReferences, csvRows, setCsvRows, creators, setCreators, loaded } = useAppState();
  const { importRef, exportData, importData } = useImportExport({ products, setProducts, assets, setAssets, meetings, setMeetings, references, setReferences, csvRows, setCsvRows, creators, setCreators });
  const onlineMembers = usePresence(user);

  const winningCount = assets.filter(a => a.isWinning).length;
  const onCount = assets.filter(a => a.status === "ON").length;

  if (!loaded) return (
    <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center">
      <div className="text-center"><p className="text-2xl mb-2">🎬</p><p className="text-sm text-gray-400">데이터 불러오는 중...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f7f8] font-sans">
      <div className="sticky top-0 z-40 shadow-sm" style={{ background: "#F5C633" }}>
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="data:image/png;base64,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" alt="NARKA" className="h-6 object-contain" />
            <span className="text-xs text-gray-700 hidden sm:block">Creative Hub</span>
            <div className="hidden sm:flex gap-2">
              <Pill color="emerald">🏆 {winningCount}</Pill>
              <Pill color="blue">🟢 ON {onCount}</Pill>
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            <input type="file" accept=".json" ref={importRef} onChange={importData} className="hidden" />
            <button onClick={() => importRef.current.click()} className="text-xs px-3 py-1.5 border border-white/50 rounded-full text-gray-800 hover:bg-white/30">불러오기</button>
            <button onClick={exportData} className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-full hover:bg-black">내보내기</button>
            <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-yellow-300">
              {user.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} className="w-6 h-6 rounded-full" alt="" />}
              <span className="text-xs text-gray-800 font-medium hidden sm:block">{user.name || user.email?.split("@")[0]}</span>
              <MemberBadge members={onlineMembers} />
              <button onClick={signOut} className="text-xs text-gray-700 hover:text-red-600 px-2 py-1 rounded-full hover:bg-red-50 transition">로그아웃</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto items-center gap-1 pb-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 my-1 transition font-medium whitespace-nowrap rounded-full ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-700 hover:text-gray-900"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-5">
        {tab === "dashboard" && <ContentsDashboardTab products={products} assets={assets} csvRows={csvRows} />}
        {tab === "usp" && <ProductUSPTab products={products} setProducts={setProducts} />}
        {tab === "archive" && <NarkaArchiveTab assets={assets} setAssets={setAssets} products={products} csvRows={csvRows} />}
        {tab === "meeting" && <DeveloperTab meetings={meetings} setMeetings={setMeetings} products={products} assets={assets} csvRows={csvRows} />}
        {tab === "metaraw" && <MetaRawTab csvRows={csvRows} setCsvRows={setCsvRows} assets={assets} setAssets={setAssets} products={products} />}
        {tab === "reference" && <ReferenceTab references={references} setReferences={setReferences} />}
        {tab === "creator" && <CreatorTab products={products} creators={creators} setCreators={setCreators} />}
      </div>
    </div>
  );
}
