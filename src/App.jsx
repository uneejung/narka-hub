import { supabase } from "./supabase.js";
import { useState, useRef, useEffect } from "react";

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
  const [creators, setCreatorsRaw] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const [p, a, m, r, c, cr] = await Promise.all([
        sbGet("narka_products", INIT_PRODUCTS),
        sbGet("narka_assets", []),
        sbGet("narka_meetings", []),
        sbGet("narka_references", []),
        sbGet("narka_csvrows", []),
        sbGet("narka_creators", []),
      ]);
      setProductsRaw(p); setAssetsRaw(a); setMeetingsRaw(m); setReferencesRaw(r); setCsvRowsRaw(c); setCreatorsRaw(cr);
      setLoaded(true);
    }
    load();
    const channel = supabase.channel("narka_sync")
      .on("postgres_changes", { event: "*", schema: "public" }, async () => {
        const [p, a, m, r, c, cr] = await Promise.all([
          sbGet("narka_products", INIT_PRODUCTS), sbGet("narka_assets", []),
          sbGet("narka_meetings", []), sbGet("narka_references", []),
          sbGet("narka_csvrows", []), sbGet("narka_creators", []),
        ]);
        setProductsRaw(p); setAssetsRaw(a); setMeetingsRaw(m); setReferencesRaw(r); setCsvRowsRaw(c); setCreatorsRaw(cr);
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const mk = (setter, table) => (v) => setter(prev => {
    const next = typeof v === "function" ? v(prev) : v;
    sbSet(table, next); return next;
  });

  return {
    products, setProducts: mk(setProductsRaw, "narka_products"),
    assets, setAssets: mk(setAssetsRaw, "narka_assets"),
    meetings, setMeetings: mk(setMeetingsRaw, "narka_meetings"),
    references, setReferences: mk(setReferencesRaw, "narka_references"),
    csvRows, setCsvRows: mk(setCsvRowsRaw, "narka_csvrows"),
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
function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });
}

const META_KEYS = {
  "광고 이름": "adName", "캠페인 이름": "campaign",
  "roas (광고 지출 대비 수익률)": "roas", "노출": "impressions",
  "클릭(전체)": "clicks", "ctr(전체)": "ctr", "cpm": "cpm", "cpc(전체)": "cpc",
  "소진 금액 (krw)": "spend", "구매": "convCount", "구매 전환값": "convValue",
  "구매 roas": "roas",
};

function normRow(row) {
  const out = {};
  Object.entries(row).forEach(([k, v]) => {
    const mapped = META_KEYS[k] || META_KEYS[k.toLowerCase()];
    if (mapped) out[mapped] = v; else out[k] = v;
  });
  return out;
}

function getAssetMetrics(assetTitle, csvRows) {
  if (!assetTitle || !csvRows.length) return null;
  const bracket = assetTitle.match(/\[([^\]]+)\]/);
  const key = bracket ? bracket[1].toLowerCase() : assetTitle.toLowerCase();
  const matched = csvRows.filter(r => {
    const name = (r.adName || r["광고 이름"] || "").toLowerCase();
    return name.includes(key);
  });
  if (!matched.length) return null;
  const sum = (k) => matched.reduce((a, r) => a + (parseFloat(r[k]) || 0), 0);
  const avg = (k) => matched.length ? sum(k) / matched.length : 0;
  const totalSpend = sum("spend");
  const totalConv = sum("convValue");
  return {
    roas: totalSpend > 0 ? (totalConv / totalSpend).toFixed(2) : "—",
    spend: totalSpend ? `₩${Math.round(totalSpend).toLocaleString()}` : "—",
    convValue: totalConv ? `₩${Math.round(totalConv).toLocaleString()}` : "—",
    convRate: avg("convRate") ? `${avg("convRate").toFixed(2)}%` : "—",
    ctr: avg("ctr") ? `${avg("ctr").toFixed(2)}%` : "—",
    cpm: avg("cpm") ? `₩${Math.round(avg("cpm")).toLocaleString()}` : "—",
    cpc: avg("cpc") ? `₩${Math.round(avg("cpc")).toLocaleString()}` : "—",
    _roas: totalSpend > 0 ? totalConv / totalSpend : 0,
    _ctr: avg("ctr"),
    _cpc: avg("cpc"),
    _spend: totalSpend,
    _convValue: totalConv,
    _convRate: avg("convRate"),
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
function ContentsDashboardTab({ products, assets }) {
  const [activePid, setActivePid] = useState(products[0]?.id || "");
  const prod = products.find(p => p.id === activePid);
  if (!prod) return null;

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
        {products.map(p => (
          <button key={p.id} onClick={() => setActivePid(p.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${activePid === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.tag === "MAIN" ? "bg-indigo-400" : "bg-gray-400"}`} />
            {p.name}
          </button>
        ))}
      </div>
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
                            {copyText && <p className="text-xs text-indigo-500 truncate mt-0.5">📝 {copyText}</p>}
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
  );
}

// ── TAB 3: narka archive (소재 아카이브) ─────────────────────
function AssetForm({ asset, products, onSave, onClose }) {
  const [form, setForm] = useState(asset || {
    id: genId(), productId: products[0]?.id || "", uspId: "", copyId: "",
    title: "", painpoint: "", benefit: "",
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
          <div className="grid grid-cols-2 gap-3">
            <div><Label>페인포인트</Label><TA value={form.painpoint} onChange={set("painpoint")} placeholder="소비자 불편" rows={2} /></div>
            <div><Label>소구 편익</Label><TA value={form.benefit} onChange={set("benefit")} placeholder="전달하는 이점" rows={2} /></div>
          </div>
          <Divider />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>대표 이미지 (캡처본)</Label>
              <label className="block cursor-pointer">
                {form.thumbUrl ? (
                  <div className="relative group" style={{ aspectRatio: "4/5", maxHeight: 200 }}>
                    <img src={form.thumbUrl} alt="" className="w-full h-full object-cover rounded-xl border border-gray-200" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center"><span className="text-white text-xs">교체</span></div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-400 hover:border-gray-400 transition" style={{ aspectRatio: "4/5", maxHeight: 200 }}>
                    + 이미지 업로드<br />(9:16 비율)
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleThumb} />
              </label>
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

function AssetCard({ asset, products, csvRows, onClick }) {
  const prod = products.find(p => p.id === asset.productId);
  const usp = prod?.usps.find(u => u.id === asset.uspId);
  const metrics = getAssetMetrics(asset.title, csvRows);
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
  const [filterResult, setFilterResult] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
      const ma = getAssetMetrics(a.title, csvRows);
      const mb = getAssetMetrics(b.title, csvRows);
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
      </div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-gray-400">{filtered.length}개 소재</p>
        <button onClick={() => { setEditAsset(null); setShowForm(true); }} className="bg-black text-white text-xs px-4 py-2 rounded-full hover:bg-gray-800">+ 소재 추가</button>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-300"><p className="text-4xl mb-3">🎬</p><p className="text-sm">소재를 추가해보세요</p></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(a => (
            <div key={a.id} className="relative group">
              <AssetCard asset={a} products={products} csvRows={csvRows} onClick={() => { setEditAsset(a); setShowForm(true); }} />
              <button onClick={e => { e.stopPropagation(); setDeleteTarget(a.id); }}
                className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center z-10">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {showForm && <AssetForm asset={editAsset} products={products} onSave={handleSave} onClose={() => { setShowForm(false); setEditAsset(null); }} />}
      {deleteTarget && <PasswordConfirm onConfirm={() => { handleDelete(deleteTarget); setDeleteTarget(null); }} onCancel={() => setDeleteTarget(null)} />}
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
            const metrics = getAssetMetrics(a.title, csvRows);
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
  const metrics = a ? getAssetMetrics(a.title, csvRows) : null;
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
                  const metrics = getAssetMetrics(a.title, csvRows);
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

// ── TAB 5: META RAW ───────────────────────────────────────────
function MetaRawTab({ csvRows, setCsvRows, assets, products }) {
  const fileRef = useRef();
  const [filterProd, setFilterProd] = useState("all");

  const handleCSV = e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      const rows = parseCSV(ev.target.result).map(normRow);
      setCsvRows(rows);
    };
    r.readAsText(file, "UTF-8");
  };

  const matchedRows = csvRows.map(row => {
    const asset = assets.find(a => {
      const bracket = a.title?.match(/\[([^\]]+)\]/);
      const key = bracket ? bracket[1].toLowerCase() : (a.title || "").toLowerCase();
      return key && (row.adName || "").toLowerCase().includes(key);
    });
    return { ...row, assetId: asset?.id || null, productId: asset?.productId || null };
  });

  const filtered = matchedRows.filter(r => filterProd === "all" || r.productId === filterProd);
  const sum = k => filtered.reduce((a, r) => a + (parseFloat(r[k]) || 0), 0);
  const avg = k => filtered.length ? sum(k) / filtered.length : 0;
  const totalSpend = sum("spend");
  const totalConv = sum("convValue");
  const avgRoas = totalSpend > 0 ? (totalConv / totalSpend).toFixed(2) : "—";

  const assetPerf = matchedRows.filter(r => r.assetId).reduce((acc, r) => {
    const k = r.assetId;
    if (!acc[k]) acc[k] = { assetId: k, roas: 0, ctr: 0, spend: 0, convValue: 0, cpm: 0, cpc: 0, count: 0 };
    acc[k].roas += parseFloat(r.roas) || 0;
    acc[k].ctr += parseFloat(r.ctr) || 0;
    acc[k].spend += parseFloat(r.spend) || 0;
    acc[k].convValue += parseFloat(r.convValue) || 0;
    acc[k].cpm += parseFloat(r.cpm) || 0;
    acc[k].cpc += parseFloat(r.cpc) || 0;
    acc[k].count += 1;
    return acc;
  }, {});
  const assetPerfList = Object.values(assetPerf).map(x => ({
    ...x, roas: (x.roas / x.count).toFixed(2), ctr: (x.ctr / x.count).toFixed(2),
    cpm: Math.round(x.cpm / x.count).toLocaleString(), cpc: Math.round(x.cpc / x.count).toLocaleString(),
  })).sort((a, b) => b.roas - a.roas);

  return (
    <div>
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-sm mb-0.5">메타 광고 CSV 업로드</p>
            <p className="text-xs text-gray-400">광고 관리자 → 광고 탭 → 내보내기(CSV). 소재 제목의 [ ] 키워드로 자동 매칭됩니다.</p>
          </div>
          <div className="flex gap-2 items-center">
            {csvRows.length > 0 && <span className="text-xs text-emerald-600 font-medium">{csvRows.length}행 · {matchedRows.filter(r => r.assetId).length}개 매칭</span>}
            <input type="file" accept=".csv" ref={fileRef} onChange={handleCSV} className="hidden" />
            <button onClick={() => fileRef.current.click()} className="bg-black text-white text-xs px-4 py-2 rounded-full hover:bg-gray-800">CSV 업로드</button>
          </div>
        </div>
      </div>

      {csvRows.length === 0 ? (
        <div className="text-center py-24 text-gray-300"><p className="text-5xl mb-4">📊</p><p className="text-sm font-medium">CSV를 업로드하면 광고 성과가 표시됩니다</p></div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="text-xs text-gray-400">품목</span>
            <button onClick={() => setFilterProd("all")} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterProd === "all" ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>전체</button>
            {products.map(p => <button key={p.id} onClick={() => setFilterProd(p.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterProd === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p.name}</button>)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[["통합 ROAS", avgRoas, "green"], ["총 소진 예산", totalSpend ? `₩${Math.round(totalSpend).toLocaleString()}` : "—", "blue"], ["평균 CTR", `${avg("ctr").toFixed(2)}%`, "amber"], ["평균 CPM", `₩${Math.round(avg("cpm")).toLocaleString()}`, "gray"]].map(([l, v, c]) => (
              <div key={l} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{l}</p>
                <p className={`text-xl font-black ${c === "green" ? "text-emerald-600" : c === "blue" ? "text-blue-600" : c === "amber" ? "text-amber-600" : "text-gray-800"}`}>{v}</p>
              </div>
            ))}
          </div>
          {assetPerfList.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-3">아카이브 소재 성과 (자동 매칭)</p>
              <div className="space-y-2">
                {assetPerfList.map(row => {
                  const asset = assets.find(a => a.id === row.assetId);
                  const prod = products.find(p => p.id === asset?.productId);
                  return (
                    <div key={row.assetId} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-gray-200 transition">
                      {asset?.thumbUrl ? <img src={asset.thumbUrl} alt="" className="w-8 h-14 object-cover rounded-lg flex-shrink-0" /> : <div className="w-8 h-14 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><span className="text-sm">🎬</span></div>}
                      <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-gray-800 truncate">{asset?.title || "—"}</p>{prod && <Pill color="indigo">{prod.name}</Pill>}</div>
                      <div className="flex gap-3 text-right flex-shrink-0">
                        {[["ROAS",row.roas,"text-emerald-600"],["CTR",`${row.ctr}%`,""],["CPM",`₩${row.cpm}`,""],["CPC",`₩${row.cpc}`,""],["지출",`₩${Math.round(row.spend).toLocaleString()}`,""],["전환값",`₩${Math.round(row.convValue).toLocaleString()}`,""]].map(([k,v,cls]) => (
                          <div key={k}><p className="text-xs text-gray-400">{k}</p><p className={`text-xs font-bold ${cls}`}>{v}</p></div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 mb-3">전체 원본 데이터 ({filtered.length}행)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-100">{["광고명","ROAS","CTR","CPM","CPC","소진","전환값"].map(h => <th key={h} className="text-left py-2 pr-4 text-gray-400 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.slice(0, 30).map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4 max-w-[200px] truncate text-gray-700">{r.adName || r.campaign || "—"}</td>
                      <td className="py-2 pr-4 font-semibold text-emerald-600">{r.roas || "—"}</td>
                      <td className="py-2 pr-4">{r.ctr ? `${parseFloat(r.ctr).toFixed(2)}%` : "—"}</td>
                      <td className="py-2 pr-4">{r.cpm ? `₩${Math.round(parseFloat(r.cpm)).toLocaleString()}` : "—"}</td>
                      <td className="py-2 pr-4">{r.cpc ? `₩${Math.round(parseFloat(r.cpc)).toLocaleString()}` : "—"}</td>
                      <td className="py-2 pr-4">{r.spend ? `₩${Math.round(parseFloat(r.spend)).toLocaleString()}` : "—"}</td>
                      <td className="py-2 pr-4">{r.convValue ? `₩${Math.round(parseFloat(r.convValue)).toLocaleString()}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 30 && <p className="text-xs text-gray-400 mt-2 text-center">+{filtered.length - 30}행 더 있음</p>}
            </div>
          </div>
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
              {form.thumbUrl ? <img src={form.thumbUrl} alt="" className="w-full h-32 object-cover rounded-xl border border-gray-200" /> : <div className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-400 hover:border-gray-400 transition">+ 이미지 업로드</div>}
              <input type="file" accept="image/*" className="hidden" onChange={handleThumb} />
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
            <label className="block cursor-pointer">
              {form.thumbUrl ? (
                <div className="relative group cursor-pointer" onClick={() => set("thumbUrl")("")}>
                  <img src={form.thumbUrl} alt="" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center"><span className="text-white text-xs">클릭하여 제거</span></div>
                </div>
              ) : (
                <div onPaste={handlePaste} tabIndex={0} className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-xs text-gray-400 hover:border-indigo-300 transition gap-1 cursor-text">
                  <span className="text-2xl">📋</span>
                  <span>Ctrl+V 붙여넣기</span>
                  <span className="text-gray-300">이미지 복사 후 여기 클릭 → Ctrl+V</span>
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
  { id: "meeting", label: "📋 Developer" },
  { id: "metaraw", label: "📈 META RAW" },
  { id: "reference", label: "🔍 Reference" },
  { id: "creator", label: "🌟 Creator" },
];

export default function App() {
  const getInitialTab = () => {
    const hash = window.location.hash.replace("#", "");
    const validTabs = ["dashboard","usp","archive","meeting","metaraw","reference","creator"];
    return validTabs.includes(hash) ? hash : "archive";
  };
  const [tab, setTabRaw] = useState(getInitialTab);
  const setTab = (t) => { setTabRaw(t); window.location.hash = t; };
  const { products, setProducts, assets, setAssets, meetings, setMeetings, references, setReferences, csvRows, setCsvRows, creators, setCreators, loaded } = useAppState();
  const { importRef, exportData, importData } = useImportExport({ products, setProducts, assets, setAssets, meetings, setMeetings, references, setReferences, csvRows, setCsvRows, creators, setCreators });

  const winningCount = assets.filter(a => a.isWinning).length;
  const onCount = assets.filter(a => a.status === "ON").length;

  if (!loaded) return (
    <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center">
      <div className="text-center"><p className="text-2xl mb-2">🎬</p><p className="text-sm text-gray-400">데이터 불러오는 중...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f7f8] font-sans">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-lg tracking-tighter">NARKA</span>
            <span className="text-xs text-gray-400 hidden sm:block">Creative Hub</span>
            <div className="hidden sm:flex gap-2">
              <Pill color="emerald">🏆 {winningCount}</Pill>
              <Pill color="blue">🟢 ON {onCount}</Pill>
            </div>
          </div>
          <div className="flex gap-1.5">
            <input type="file" accept=".json" ref={importRef} onChange={importData} className="hidden" />
            <button onClick={() => importRef.current.click()} className="text-xs px-3 py-1.5 border border-gray-200 rounded-full text-gray-500 hover:bg-gray-50">불러오기</button>
            <button onClick={exportData} className="text-xs px-3 py-1.5 bg-black text-white rounded-full hover:bg-gray-800">내보내기</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`text-xs sm:text-sm px-3 sm:px-4 py-2.5 border-b-2 transition font-medium whitespace-nowrap ${tab === t.id ? "border-black text-black" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-5">
        {tab === "dashboard" && <ContentsDashboardTab products={products} assets={assets} />}
        {tab === "usp" && <ProductUSPTab products={products} setProducts={setProducts} />}
        {tab === "archive" && <NarkaArchiveTab assets={assets} setAssets={setAssets} products={products} csvRows={csvRows} />}
        {tab === "meeting" && <DeveloperTab meetings={meetings} setMeetings={setMeetings} products={products} assets={assets} csvRows={csvRows} />}
        {tab === "metaraw" && <MetaRawTab csvRows={csvRows} setCsvRows={setCsvRows} assets={assets} products={products} />}
        {tab === "reference" && <ReferenceTab references={references} setReferences={setReferences} />}
        {tab === "creator" && <CreatorTab products={products} creators={creators} setCreators={setCreators} />}
      </div>
    </div>
  );
}
