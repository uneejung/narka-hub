import { supabase } from "./supabase.js";
import { useState, useRef, useEffect, useCallback } from "react";

// ───────────────────────────────────────────────
// INITIAL DATA
// ───────────────────────────────────────────────
const INIT_PRODUCTS = [
  {
    id: "p1", name: "슈퍼픽스 헤어마스카라", tag: "MAIN",
    usps: [
      { id: "u1", label: "강력 고정력", copies: [{ id: "c1", text: "하루종일 무너지지 않는 스타일" }, { id: "c2", text: "땀에도 끄떡없는 픽서" }] },
      { id: "u2", label: "자연스러운 마무리", copies: [{ id: "c3", text: "억지스럽지 않은 자연스러움" }] },
    ],
  },
  {
    id: "p2", name: "프레시세범 헤어마스카라&미스트", tag: "MAIN",
    usps: [
      { id: "u1", label: "두피 세범 케어", copies: [{ id: "c1", text: "기름진 두피, 하루만에 리셋" }] },
      { id: "u2", label: "청량한 향", copies: [{ id: "c2", text: "샤워한 것처럼 산뜻한 향" }] },
    ],
  },
  {
    id: "p3", name: "헤어 밀크", tag: "SUB",
    usps: [
      { id: "u1", label: "손상 케어", copies: [{ id: "c1", text: "끊어지기 직전 모발을 살리는" }] },
    ],
  },
  {
    id: "p4", name: "샴푸 (신규)", tag: "SUB",
    usps: [
      { id: "u1", label: "두피 세정", copies: [{ id: "c1", text: "막힌 모공을 뚫는 딥클렌징" }] },
    ],
  },
];

function genId() { return `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

// ───────────────────────────────────────────────
// PERSIST (sessionStorage as surrogate)
// ───────────────────────────────────────────────
async function sbGet(table, def) {
  try {
    const { data, error } = await supabase.from(table).select("*").eq("id", "singleton").single();
    if (error || !data) return def;
    return JSON.parse(data.value);
  } catch { return def; }
}
async function sbSet(table, value) {
  try {
    await supabase.from(table).upsert({ id: "singleton", value: JSON.stringify(value) });
  } catch {}
}
function useAppState() {
  const [products, setProductsRaw] = useState(INIT_PRODUCTS);
  const [assets, setAssetsRaw] = useState([]);
  const [meetings, setMeetingsRaw] = useState([]);
  const [references, setReferencesRaw] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const [p, a, m, r] = await Promise.all([
        sbGet("narka_products", INIT_PRODUCTS),
        sbGet("narka_assets", []),
        sbGet("narka_meetings", []),
        sbGet("narka_references", []),
      ]);
      setProductsRaw(p); setAssetsRaw(a); setMeetingsRaw(m); setReferencesRaw(r);
      setLoaded(true);
    }
    load();
    // 실시간 동기화
    const channel = supabase.channel("narka_changes")
      .on("postgres_changes", { event: "*", schema: "public" }, async () => {
        const [p, a, m, r] = await Promise.all([
          sbGet("narka_products", INIT_PRODUCTS),
          sbGet("narka_assets", []),
          sbGet("narka_meetings", []),
          sbGet("narka_references", []),
        ]);
        setProductsRaw(p); setAssetsRaw(a); setMeetingsRaw(m); setReferencesRaw(r);
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const setProducts = (v) => { setProductsRaw(prev => { const next = typeof v === "function" ? v(prev) : v; sbSet("narka_products", next); return next; }); };
  const setAssets = (v) => { setAssetsRaw(prev => { const next = typeof v === "function" ? v(prev) : v; sbSet("narka_assets", next); return next; }); };
  const setMeetings = (v) => { setMeetingsRaw(prev => { const next = typeof v === "function" ? v(prev) : v; sbSet("narka_meetings", next); return next; }); };
  const setReferences = (v) => { setReferencesRaw(prev => { const next = typeof v === "function" ? v(prev) : v; sbSet("narka_references", next); return next; }); };

  if (!loaded) return { products: INIT_PRODUCTS, setProducts, assets: [], setAssets, meetings: [], setMeetings, references: [], setReferences, _loading: true };
  return { products, setProducts, assets, setAssets, meetings, setMeetings, references, setReferences, _loading: false };
}

// ───────────────────────────────────────────────
// TINY UI PRIMITIVES
// ───────────────────────────────────────────────
const COLORS = {
  MAIN: { pill: "bg-indigo-100 text-indigo-700", border: "border-indigo-200" },
  SUB: { pill: "bg-gray-100 text-gray-600", border: "border-gray-200" },
  best: { pill: "bg-emerald-100 text-emerald-700", border: "border-emerald-300" },
  worst: { pill: "bg-red-100 text-red-600", border: "border-red-200" },
  winning: { pill: "bg-amber-100 text-amber-700", border: "border-amber-300" },
};

function Pill({ children, color = "gray", className = "" }) {
  const map = { gray: "bg-gray-100 text-gray-600", indigo: "bg-indigo-100 text-indigo-700", emerald: "bg-emerald-100 text-emerald-700", red: "bg-red-100 text-red-600", amber: "bg-amber-100 text-amber-700", purple: "bg-purple-100 text-purple-700", blue: "bg-blue-100 text-blue-700" };
  return <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${map[color] || map.gray} ${className}`}>{children}</span>;
}

function SegBtn({ options, value, onChange, size = "sm" }) {
  const sz = size === "sm" ? "text-xs px-2.5 py-1" : "text-sm px-3 py-1.5";
  return (
    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`${sz} font-medium transition-colors ${value === o.value ? "bg-black text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Modal({ onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto`}>
        {children}
      </div>
    </div>
  );
}

function TF({ value, onChange, placeholder, className = "" }) {
  return <input className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 ${className}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}

function TA({ value, onChange, placeholder, rows = 3, className = "" }) {
  return <textarea className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/20 ${className}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} />;
}

function Label({ children }) {
  return <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{children}</p>;
}

function Divider() { return <div className="border-t border-gray-100 my-4" />; }

// ───────────────────────────────────────────────
// MONTH FILTER BAR
// ───────────────────────────────────────────────
function MonthFilter({ value, onChange }) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button onClick={() => onChange("all")} className={`text-xs px-3 py-1 rounded-full border transition ${value === "all" ? "bg-black text-white border-black" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}>전체</button>
      {months.map((m) => (
        <button key={m} onClick={() => onChange(m)} className={`text-xs px-3 py-1 rounded-full border transition ${value === m ? "bg-black text-white border-black" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}>{m.slice(5)}월</button>
      ))}
    </div>
  );
}

function matchMonth(dateStr, filter) {
  if (filter === "all" || !dateStr) return true;
  return dateStr.startsWith(filter);
}

// ───────────────────────────────────────────────
// TAB 1: USP 설정
// ───────────────────────────────────────────────
function USPSettingsTab({ products, setProducts }) {
  const [activePid, setActivePid] = useState(products[0]?.id || "");
  const [editingPid, setEditingPid] = useState(null);
  const [editingPname, setEditingPname] = useState("");

  const prod = products.find((p) => p.id === activePid);

  const addProduct = (tag) => {
    const np = { id: genId(), name: `새 품목 (${tag})`, tag, usps: [] };
    setProducts((prev) => [...prev, np]);
    setActivePid(np.id);
  };

  const updateProdName = (id, name) => setProducts((prev) => prev.map((p) => p.id === id ? { ...p, name } : p));
  const deleteProd = (id) => { setProducts((prev) => prev.filter((p) => p.id !== id)); if (activePid === id) setActivePid(products[0]?.id || ""); };

  const updateProd = (fn) => setProducts((prev) => prev.map((p) => p.id === activePid ? fn(p) : p));

  const addUsp = () => updateProd((p) => ({ ...p, usps: [...p.usps, { id: genId(), label: "", copies: [] }] }));
  const editUspLabel = (uid, label) => updateProd((p) => ({ ...p, usps: p.usps.map((u) => u.id === uid ? { ...u, label } : u) }));
  const deleteUsp = (uid) => updateProd((p) => ({ ...p, usps: p.usps.filter((u) => u.id !== uid) }));

  const addCopy = (uid) => updateProd((p) => ({ ...p, usps: p.usps.map((u) => u.id === uid ? { ...u, copies: [...u.copies, { id: genId(), text: "" }] } : u) }));
  const editCopy = (uid, cid, text) => updateProd((p) => ({ ...p, usps: p.usps.map((u) => u.id === uid ? { ...u, copies: u.copies.map((c) => c.id === cid ? { ...c, text } : c) } : u) }));
  const deleteCopy = (uid, cid) => updateProd((p) => ({ ...p, usps: p.usps.map((u) => u.id === uid ? { ...u, copies: u.copies.filter((c) => c.id !== cid) } : u) }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">품목 · USP · 카피를 3단계로 설정하세요. 소재 아카이브와 회의록에 자동 연동됩니다.</p>
        <div className="flex gap-2">
          <button onClick={() => addProduct("MAIN")} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700">+ MAIN 품목</button>
          <button onClick={() => addProduct("SUB")} className="text-xs bg-gray-700 text-white px-3 py-1.5 rounded-full hover:bg-gray-800">+ SUB 품목</button>
        </div>
      </div>

      {/* 품목 탭 */}
      <div className="flex gap-2 flex-wrap mb-5">
        {products.map((p) => (
          <div key={p.id} className="relative group">
            {editingPid === p.id ? (
              <input autoFocus className="text-xs border border-gray-300 rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/20 w-36"
                value={editingPname} onChange={(e) => setEditingPname(e.target.value)}
                onBlur={() => { updateProdName(p.id, editingPname); setEditingPid(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { updateProdName(p.id, editingPname); setEditingPid(null); } }} />
            ) : (
              <button onClick={() => setActivePid(p.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${activePid === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${p.tag === "MAIN" ? "bg-indigo-400" : "bg-gray-400"}`} />
                {p.name}
                {activePid === p.id && (
                  <span className="flex items-center gap-0.5 ml-1">
                    <span onClick={(e) => { e.stopPropagation(); setEditingPid(p.id); setEditingPname(p.name); }} className="opacity-50 hover:opacity-100 cursor-pointer">✏️</span>
                    <span onClick={(e) => { e.stopPropagation(); deleteProd(p.id); }} className="opacity-50 hover:opacity-100 cursor-pointer text-red-400">×</span>
                  </span>
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {prod ? (
        <div className="space-y-4">
          {prod.usps.map((u) => (
            <div key={u.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              {/* USP 헤더 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                <input className="flex-1 font-semibold text-sm border-0 border-b border-dashed border-gray-200 px-1 py-0.5 focus:outline-none focus:border-black"
                  value={u.label} onChange={(e) => editUspLabel(u.id, e.target.value)} placeholder="USP 핵심편익 이름" />
                <button onClick={() => addCopy(u.id)} className="text-xs text-indigo-600 hover:underline whitespace-nowrap">+ 카피 추가</button>
                <button onClick={() => deleteUsp(u.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
              </div>
              {/* 카피 목록 */}
              <div className="space-y-2 pl-4">
                {u.copies.map((c, ci) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-300 w-4 flex-shrink-0">{ci + 1}</span>
                    <input className="flex-1 text-sm border border-gray-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/10 bg-gray-50"
                      value={c.text} onChange={(e) => editCopy(u.id, c.id, e.target.value)} placeholder="카피 텍스트" />
                    <button onClick={() => deleteCopy(u.id, c.id)} className="text-gray-300 hover:text-red-400 text-base leading-none flex-shrink-0">×</button>
                  </div>
                ))}
                {u.copies.length === 0 && <p className="text-xs text-gray-300 italic">카피를 추가해보세요</p>}
              </div>
            </div>
          ))}
          <button onClick={addUsp} className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600 transition">
            + USP(핵심편익) 추가
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-16">품목을 선택하거나 추가하세요</p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// TAB 2: 소재 아카이브
// ───────────────────────────────────────────────
function AssetForm({ asset, products, onSave, onClose }) {
  const [form, setForm] = useState(asset || {
    id: genId(), productId: products[0]?.id || "", uspId: "", copyId: "",
    title: "", painpoint: "", benefit: "",
    result: "none", isWinning: false, status: "진행중",
    insight: "", nextDev: "",
    thumbUrl: "", videoUrl: "",
    thumbFile: null,
    date: new Date().toISOString().slice(0, 10),
    metrics: { roas: "", cpc: "", cpm: "", ctr: "", spend: "", convValue: "", convRate: "" },
  });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setMetric = (k) => (v) => setForm((f) => ({ ...f, metrics: { ...f.metrics, [k]: v } }));

  const selectedProd = products.find((p) => p.id === form.productId);
  const selectedUsp = selectedProd?.usps.find((u) => u.id === form.uspId);

  const handleThumb = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, thumbUrl: ev.target.result }));
    reader.readAsDataURL(file);
  };

  return (
    <Modal onClose={onClose} wide>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-base">소재 {asset ? "수정" : "등록"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        <div className="space-y-5">
          {/* 품목 */}
          <div>
            <Label>품목</Label>
            <div className="flex flex-wrap gap-2">
              {products.map((p) => (
                <button key={p.id} onClick={() => { set("productId")(p.id); set("uspId")(""); set("copyId")(""); }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1 ${form.productId === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-600"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.tag === "MAIN" ? "bg-indigo-400" : "bg-gray-400"}`} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* USP */}
          {selectedProd?.usps.length > 0 && (
            <div>
              <Label>USP (핵심편익)</Label>
              <div className="flex flex-wrap gap-2">
                {selectedProd.usps.map((u) => (
                  <button key={u.id} onClick={() => { set("uspId")(u.id); set("copyId")(""); }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${form.uspId === u.id ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-600"}`}>
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 카피 */}
          {selectedUsp?.copies.length > 0 && (
            <div>
              <Label>적용 카피</Label>
              <div className="flex flex-wrap gap-2">
                {selectedUsp.copies.map((c) => (
                  <button key={c.id} onClick={() => set("copyId")(c.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${form.copyId === c.id ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-600"}`}>
                    {c.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Divider />

          {/* 소재 정보 */}
          <div><Label>소재 제목</Label><TF value={form.title} onChange={set("title")} placeholder="소재 식별 이름 (ex. 세범_정수리샷_v3)" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>페인포인트</Label><TA value={form.painpoint} onChange={set("painpoint")} placeholder="소비자 불편" rows={2} /></div>
            <div><Label>소구 편익</Label><TA value={form.benefit} onChange={set("benefit")} placeholder="전달하는 이점" rows={2} /></div>
          </div>

          <Divider />

          {/* 대표이미지 + 영상 링크 */}
          <div>
            <Label>대표 이미지 + 영상 링크</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">대표 이미지 (캡처본)</p>
                <label className="block cursor-pointer">
                  {form.thumbUrl ? (
                    <div className="relative group">
                      <img src={form.thumbUrl} alt="thumb" className="w-full h-28 object-cover rounded-lg border border-gray-200" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition">
                        <span className="text-white text-xs">교체</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-28 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400 hover:border-gray-400 transition">
                      + 이미지 업로드
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleThumb} />
                </label>
              </div>
              <div className="flex flex-col">
                <p className="text-xs text-gray-400 mb-1">Dropbox / Drive 링크</p>
                <TF value={form.videoUrl} onChange={set("videoUrl")} placeholder="https://dropbox.com/..." />
                <p className="text-xs text-gray-400 mt-2">이미지 클릭 시 링크로 이동합니다</p>
              </div>
            </div>
          </div>

          <Divider />

          {/* 상태 / 결과 */}
          <div className="flex flex-wrap gap-4">
            <div>
              <Label>진행 상태</Label>
              <div className="flex gap-2">
                {["기획중", "제작중", "진행중", "종료"].map((s) => (
                  <button key={s} onClick={() => set("status")(s)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${form.status === s ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <Label>결과 분류</Label>
              <div className="flex gap-2">
                {[{ v: "none", l: "미분류" }, { v: "best", l: "✅ BEST" }, { v: "worst", l: "❌ WORST" }].map((r) => (
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

          <div><Label>분석 메모 (잘된/안된 이유)</Label><TA value={form.insight} onChange={set("insight")} placeholder="왜 잘됐나 / 왜 안됐나" rows={2} /></div>
          <div><Label>추가 개발 방향</Label><TF value={form.nextDev} onChange={set("nextDev")} placeholder="다음 변주 포인트" /></div>

          <Divider />

          {/* 광고 성과 */}
          <div>
            <Label>광고 성과 (수동 입력 또는 CSV 업로드 후 자동)</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["roas","ROAS"],["cpc","CPC"],["cpm","CPM"],["ctr","CTR(%)"],["spend","소진예산"],["convValue","전환값"],["convRate","전환율(%)"]].map(([k,l]) => (
                <div key={k}><p className="text-xs text-gray-400 mb-1">{l}</p><TF value={form.metrics[k]} onChange={setMetric(k)} placeholder="0" /></div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50">취소</button>
          <button onClick={() => { onSave(form); onClose(); }} className="flex-1 bg-black text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-800">저장</button>
        </div>
      </div>
    </Modal>
  );
}

function AssetCard({ asset, products, onClick }) {
  const prod = products.find((p) => p.id === asset.productId);
  const usp = prod?.usps.find((u) => u.id === asset.uspId);
  const copy = usp?.copies.find((c) => c.id === asset.copyId);
  const borderClass = asset.isWinning ? "border-amber-300" : asset.result === "best" ? "border-emerald-300" : asset.result === "worst" ? "border-red-200" : "border-gray-100";

  return (
    <div className={`bg-white border ${borderClass} rounded-xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer`} onClick={onClick}>
      {asset.thumbUrl ? (
        <div className="relative" onClick={(e) => { if (asset.videoUrl) { e.stopPropagation(); window.open(asset.videoUrl, "_blank"); } }}>
          <img src={asset.thumbUrl} alt="" className="w-full h-32 object-cover" />
          {asset.videoUrl && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><div className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center"><span className="text-sm ml-0.5">▶</span></div></div>}
          {asset.isWinning && <span className="absolute top-2 right-2 text-base">🏆</span>}
        </div>
      ) : (
        <div className="h-20 bg-gray-50 flex items-center justify-center">
          <span className="text-2xl text-gray-200">🎬</span>
          {asset.isWinning && <span className="absolute top-2 right-2">🏆</span>}
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-semibold text-gray-800 leading-snug mb-2 line-clamp-2">{asset.title || "(제목 없음)"}</p>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {prod && <Pill color={prod.tag === "MAIN" ? "indigo" : "gray"}>{prod.name}</Pill>}
          {usp && <Pill color="purple">{usp.label}</Pill>}
          {asset.result === "best" && <Pill color="emerald">BEST</Pill>}
          {asset.result === "worst" && <Pill color="red">WORST</Pill>}
        </div>
        {copy && <p className="text-xs text-indigo-500 mt-1 line-clamp-1">카피: {copy.text}</p>}
        {asset.status && <p className="text-xs text-gray-400 mt-1">{asset.status} · {asset.date}</p>}
        {asset.metrics?.roas && <p className="text-xs text-gray-500 mt-1">ROAS {asset.metrics.roas} · CTR {asset.metrics.ctr}%</p>}
      </div>
    </div>
  );
}

function ArchiveTab({ assets, setAssets, products }) {
  const [monthFilter, setMonthFilter] = useState("all");
  const [filterProd, setFilterProd] = useState("all");
  const [filterResult, setFilterResult] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState(null);

  const handleSave = (a) => setAssets((prev) => { const e = prev.find((x) => x.id === a.id); return e ? prev.map((x) => x.id === a.id ? a : x) : [...prev, a]; });
  const handleDelete = (id) => { if (window.confirm("삭제할까요?")) setAssets((prev) => prev.filter((a) => a.id !== id)); };

  const filtered = assets.filter((a) =>
    matchMonth(a.date, monthFilter) &&
    (filterProd === "all" || a.productId === filterProd) &&
    (filterResult === "all" || a.result === filterResult) &&
    (filterStatus === "all" || a.status === filterStatus)
  );

  return (
    <div>
      {/* 필터 */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-8">월</span>
          <MonthFilter value={monthFilter} onChange={setMonthFilter} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-8">품목</span>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilterProd("all")} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterProd === "all" ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>전체</button>
            {products.map((p) => <button key={p.id} onClick={() => setFilterProd(p.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterProd === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p.name}</button>)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-8">결과</span>
          <div className="flex gap-1">
            {[["all","전체"],["best","BEST"],["worst","WORST"]].map(([v,l]) => <button key={v} onClick={() => setFilterResult(v)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterResult === v ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{l}</button>)}
          </div>
          <div className="flex gap-1 ml-2">
            {["all","기획중","제작중","진행중","종료"].map((s) => <button key={s} onClick={() => setFilterStatus(s)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterStatus === s ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{s === "all" ? "상태전체" : s}</button>)}
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((a) => (
            <AssetCard key={a.id} asset={a} products={products} onClick={() => { setEditAsset(a); setShowForm(true); }} />
          ))}
        </div>
      )}

      {showForm && <AssetForm asset={editAsset} products={products} onSave={handleSave} onClose={() => { setShowForm(false); setEditAsset(null); }} />}
    </div>
  );
}

// ───────────────────────────────────────────────
// TAB 3: 주간 회의
// ───────────────────────────────────────────────
function DrawingCanvas({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#1a1a1a");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === "eraser" ? "#fff" : color;
    ctx.lineWidth = tool === "eraser" ? 20 : 2;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL());
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {["pen","eraser"].map((t) => <button key={t} onClick={() => setTool(t)} className={`text-xs px-2.5 py-1 rounded-full border transition ${tool === t ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{t === "pen" ? "✏️ 펜" : "🧹 지우개"}</button>)}
        {["#1a1a1a","#ef4444","#3b82f6","#10b981","#f59e0b"].map((c) => <button key={c} onClick={() => { setTool("pen"); setColor(c); }} className={`w-6 h-6 rounded-full border-2 transition ${color === c && tool === "pen" ? "border-gray-800 scale-110" : "border-gray-200"}`} style={{ background: c }} />)}
        <button onClick={clear} className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 ml-auto">전체 지우기</button>
      </div>
      <canvas ref={canvasRef} width={600} height={240}
        className="w-full border border-gray-200 rounded-xl bg-white touch-none cursor-crosshair"
        style={{ height: 180 }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
    </div>
  );
}

function AssetPicker({ assets, products, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [filterPid, setFilterPid] = useState("all");
  const filtered = assets.filter((a) =>
    (filterPid === "all" || a.productId === filterPid) &&
    (!search || a.title?.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <Modal onClose={onClose}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-sm">소재 선택</h3><button onClick={onClose} className="text-gray-400 hover:text-black text-xl w-7 h-7 flex items-center justify-center">✕</button></div>
        <TF value={search} onChange={setSearch} placeholder="소재명 검색..." className="mb-3" />
        <div className="flex gap-1.5 flex-wrap mb-3">
          <button onClick={() => setFilterPid("all")} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterPid === "all" ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>전체</button>
          {products.map((p) => <button key={p.id} onClick={() => setFilterPid(p.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterPid === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p.name}</button>)}
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {filtered.map((a) => {
            const prod = products.find((p) => p.id === a.productId);
            return (
              <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-gray-300 cursor-pointer transition" onClick={() => { onSelect(a); onClose(); }}>
                {a.thumbUrl ? <img src={a.thumbUrl} alt="" className="w-12 h-10 object-cover rounded-lg flex-shrink-0" /> : <div className="w-12 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><span className="text-lg">🎬</span></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{a.title || "(제목 없음)"}</p>
                  <div className="flex gap-1 mt-0.5">
                    {prod && <Pill color={prod.tag === "MAIN" ? "indigo" : "gray"}>{prod.name}</Pill>}
                    {a.result === "best" && <Pill color="emerald">BEST</Pill>}
                    {a.result === "worst" && <Pill color="red">WORST</Pill>}
                    {a.isWinning && <Pill color="amber">🏆위닝</Pill>}
                  </div>
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

function SelectedAssetRow({ assetId, memo, assets, products, onMemoChange, onRemove }) {
  const a = assets.find((x) => x.id === assetId);
  const prod = a ? products.find((p) => p.id === a.productId) : null;
  if (!a) return null;
  return (
    <div className="border border-gray-100 rounded-xl p-3 mb-2 bg-white">
      <div className="flex items-start gap-3 mb-2">
        {a.thumbUrl ? <img src={a.thumbUrl} alt="" className="w-14 h-12 object-cover rounded-lg flex-shrink-0" onClick={() => a.videoUrl && window.open(a.videoUrl, "_blank")} style={{ cursor: a.videoUrl ? "pointer" : "default" }} /> : <div className="w-14 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><span className="text-xl">🎬</span></div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{a.title || "(제목 없음)"}</p>
          <div className="flex gap-1 flex-wrap mt-0.5">
            {prod && <Pill color="indigo">{prod.name}</Pill>}
            {a.result === "best" && <Pill color="emerald">BEST</Pill>}
            {a.result === "worst" && <Pill color="red">WORST</Pill>}
          </div>
        </div>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0">×</button>
      </div>
      <TA value={memo} onChange={onMemoChange} placeholder="운영 성과 및 BEST/WORST 분석 이유를 적어주세요" rows={2} />
    </div>
  );
}

function MeetingTab({ meetings, setMeetings, products, assets }) {
  const blank = () => ({
    id: genId(), date: new Date().toISOString().slice(0, 10),
    analysis: "", uspCheck: {}, newResult: "",
    byProduct: {}, designerLayout: "", designerLayoutImg: "",
    designerRef: [{ id: genId(), uspProductId: "", uspId: "", note: "", url: "" }],
  });
  const [activeIdx, setActiveIdx] = useState(0);
  const [draft, setDraft] = useState(null);
  const [activePid, setActivePid] = useState(products[0]?.id || "");
  const [pickerFor, setPickerFor] = useState(null); // { productId, type: "best"|"worst" }

  const form = draft || meetings[activeIdx];
  const upd = (v) => setDraft(v);
  const save = () => { if (draft) { setMeetings((prev) => prev.map((m, i) => i === activeIdx ? draft : m)); setDraft(null); } };
  const addMeeting = () => { const m = blank(); setMeetings((prev) => [m, ...prev]); setActiveIdx(0); setDraft(null); };

  const getBP = (pid) => form?.byProduct?.[pid] || { bestItems: [], worstItems: [], nextDev: "" };
  const setBP = (pid, field, val) => upd({ ...form, byProduct: { ...form.byProduct, [pid]: { ...getBP(pid), [field]: val } } });

  const addAssetToBP = (pid, type, assetId) => {
    const bp = getBP(pid);
    const list = bp[type === "best" ? "bestItems" : "worstItems"] || [];
    if (list.find((x) => x.assetId === assetId)) return;
    const newList = [...list, { assetId, memo: "" }];
    setBP(pid, type === "best" ? "bestItems" : "worstItems", newList);
  };
  const updateBPMemo = (pid, type, assetId, memo) => {
    const bp = getBP(pid);
    const field = type === "best" ? "bestItems" : "worstItems";
    setBP(pid, field, bp[field].map((x) => x.assetId === assetId ? { ...x, memo } : x));
  };
  const removeBPAsset = (pid, type, assetId) => {
    const bp = getBP(pid);
    const field = type === "best" ? "bestItems" : "worstItems";
    setBP(pid, field, bp[field].filter((x) => x.assetId !== assetId));
  };

  const getUC = (pid, uid) => form?.uspCheck?.[pid]?.[uid] || "none";
  const setUC = (pid, uid, val) => upd({ ...form, uspCheck: { ...form.uspCheck, [pid]: { ...(form.uspCheck?.[pid] || {}), [uid]: val } } });

  const setRef = (i, field) => (v) => { const refs = [...form.designerRef]; refs[i] = { ...refs[i], [field]: v }; upd({ ...form, designerRef: refs }); };

  if (!form && meetings.length === 0) return (
    <div className="text-center py-20">
      <p className="text-sm text-gray-400 mb-3">아직 회의 기록이 없어요</p>
      <button onClick={addMeeting} className="bg-black text-white text-sm px-5 py-2 rounded-full hover:bg-gray-800">+ 첫 회의 시작</button>
    </div>
  );

  return (
    <div>
      {/* 회의 목록 */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        <button onClick={addMeeting} className="bg-black text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 hover:bg-gray-800">+ 새 회의</button>
        {meetings.map((m, i) => <button key={m.id} onClick={() => { setActiveIdx(i); setDraft(null); }} className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 transition ${activeIdx === i ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{m.date}</button>)}
      </div>

      {form && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <input type="date" value={form.date} onChange={(e) => upd({ ...form, date: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
            {draft && <button onClick={save} className="bg-emerald-500 text-white text-xs px-4 py-1.5 rounded-full hover:bg-emerald-600 font-medium">저장하기</button>}
          </div>

          {/* 1. 분석 */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3"><span className="w-6 h-6 bg-black text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0">1</span><p className="font-semibold text-sm">기존 소재 분석 — 잘된/안된 이유</p></div>
            <TA value={form.analysis} onChange={(v) => upd({ ...form, analysis: v })} placeholder="잘된 소재: 왜 됐나 / 안된 소재: 왜 안됐나" rows={3} />
          </div>

          {/* 2. USP 꼭지 현황 */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4"><span className="w-6 h-6 bg-black text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0">2</span><p className="font-semibold text-sm">USP 꼭지 개발 현황</p></div>
            <div className="flex gap-2 flex-wrap mb-4">{products.map((p) => <button key={p.id} onClick={() => setActivePid(p.id)} className={`text-xs px-3 py-1 rounded-full border transition ${activePid === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p.name}</button>)}</div>
            {(() => {
              const prod = products.find((p) => p.id === activePid);
              if (!prod || prod.usps.length === 0) return <p className="text-xs text-gray-400">USP 설정 탭에서 편익을 먼저 추가하세요</p>;
              const countByUsp = {};
              assets.filter((a) => a.productId === prod.id).forEach((a) => { if (a.uspId) countByUsp[a.uspId] = (countByUsp[a.uspId] || 0) + 1; });
              return (
                <div className="space-y-2.5">
                  {prod.usps.map((u) => (
                    <div key={u.id}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-medium text-gray-700 w-36 flex-shrink-0">{u.label}<span className="ml-1 text-gray-400 font-normal">{countByUsp[u.id] ? `(소재 ${countByUsp[u.id]}개)` : ""}</span></span>
                        <div className="flex gap-1">{["none","진행중","완료","미개발"].map((s) => <button key={s} onClick={() => setUC(prod.id, u.id, s)} className={`text-xs px-2 py-0.5 rounded-full border transition ${getUC(prod.id, u.id) === s ? "bg-black text-white border-black" : "border-gray-200 text-gray-400"}`}>{s === "none" ? "—" : s}</button>)}</div>
                      </div>
                      {u.copies.length > 0 && <div className="pl-36 flex gap-1 flex-wrap">{u.copies.map((c) => <span key={c.id} className="text-xs px-2 py-0.5 rounded bg-gray-50 border border-gray-100 text-gray-500">{c.text}</span>)}</div>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* 3. 신규 소재 결과 */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3"><span className="w-6 h-6 bg-black text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0">3</span><p className="font-semibold text-sm">지난주 신규 소재 투입 결과</p></div>
            <TA value={form.newResult} onChange={(v) => upd({ ...form, newResult: v })} placeholder="어떤 소재를 투입했고 결과는 어땠나" rows={2} />
          </div>

          {/* 기획자 */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 shadow-sm">
            <p className="font-semibold text-sm mb-1">📊 기획자</p>
            <p className="text-xs text-gray-400 mb-4">품목별 BEST/WORST 소재를 아카이브에서 선택하고, 분석 메모와 추가 개발 방향을 적으세요</p>
            <div className="flex gap-2 flex-wrap mb-4">{products.map((p) => <button key={p.id} onClick={() => setActivePid(p.id)} className={`text-xs px-3 py-1 rounded-full border transition ${activePid === p.id ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500"}`}>{p.name}</button>)}</div>
            {(() => {
              const bp = getBP(activePid);
              return (
                <div className="space-y-4">
                  {/* BEST */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-emerald-600">✅ BEST 소재</p>
                      <button onClick={() => setPickerFor({ productId: activePid, type: "best" })} className="text-xs text-blue-500 hover:underline">+ 소재 선택</button>
                    </div>
                    {(bp.bestItems || []).map((item) => <SelectedAssetRow key={item.assetId} assetId={item.assetId} memo={item.memo} assets={assets} products={products} onMemoChange={(v) => updateBPMemo(activePid, "best", item.assetId, v)} onRemove={() => removeBPAsset(activePid, "best", item.assetId)} />)}
                    {(bp.bestItems || []).length === 0 && <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">소재를 선택해주세요</p>}
                  </div>
                  {/* WORST */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-red-500">❌ WORST 소재</p>
                      <button onClick={() => setPickerFor({ productId: activePid, type: "worst" })} className="text-xs text-blue-500 hover:underline">+ 소재 선택</button>
                    </div>
                    {(bp.worstItems || []).map((item) => <SelectedAssetRow key={item.assetId} assetId={item.assetId} memo={item.memo} assets={assets} products={products} onMemoChange={(v) => updateBPMemo(activePid, "worst", item.assetId, v)} onRemove={() => removeBPAsset(activePid, "worst", item.assetId)} />)}
                    {(bp.worstItems || []).length === 0 && <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">소재를 선택해주세요</p>}
                  </div>
                  {/* 추가 개발 */}
                  <div>
                    <p className="text-xs font-semibold text-amber-600 mb-1.5">→ 위닝 소재 외 추가 개발 방향</p>
                    <TA value={bp.nextDev || ""} onChange={(v) => setBP(activePid, "nextDev", v)} placeholder="위닝 소재는 있다. 다음 어떤 꼭지 개발할까? 변주 아이디어도 OK" rows={2} />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 제작자 */}
          <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-5 shadow-sm">
            <p className="font-semibold text-sm mb-1">🎨 제작자</p>
            <p className="text-xs text-gray-400 mb-4">레이아웃 아이디어를 글 또는 그림으로 등록하세요</p>
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">레이아웃 아이디어 — 글</p>
              <TA value={form.designerLayout} onChange={(v) => upd({ ...form, designerLayout: v })} placeholder="텍스트로 레이아웃 설명" rows={2} />
            </div>
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">레이아웃 아이디어 — 스케치</p>
              <DrawingCanvas value={form.designerLayoutImg} onChange={(v) => upd({ ...form, designerLayoutImg: v })} />
            </div>
            {/* 레퍼런스 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500">레퍼런스 — 편익 분류 먼저</p>
                <button onClick={() => upd({ ...form, designerRef: [...form.designerRef, { id: genId(), uspProductId: "", uspId: "", note: "", url: "" }] })} className="text-xs text-purple-600 hover:underline">+ 추가</button>
              </div>
              {form.designerRef.map((ref, i) => {
                const refProd = products.find((p) => p.id === ref.uspProductId) || null;
                return (
                  <div key={ref.id} className="border border-purple-100 rounded-xl p-3 mb-2 bg-white space-y-2">
                    <div className="flex gap-1 flex-wrap">{products.map((p) => <button key={p.id} onClick={() => setRef(i, "uspProductId")(p.id)} className={`text-xs px-2 py-0.5 rounded-full border transition ${ref.uspProductId === p.id ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-400"}`}>{p.name}</button>)}</div>
                    {refProd?.usps.length > 0 && <div className="flex gap-1 flex-wrap">{refProd.usps.map((u) => <button key={u.id} onClick={() => setRef(i, "uspId")(u.id)} className={`text-xs px-2 py-0.5 rounded-full border transition ${ref.uspId === u.id ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-400"}`}>{u.label}</button>)}</div>}
                    <TF value={ref.note} onChange={setRef(i, "note")} placeholder="이 레퍼런스로 어떤 걸 만들고 싶나" />
                    <TF value={ref.url} onChange={setRef(i, "url")} placeholder="URL (선택)" />
                  </div>
                );
              })}
            </div>
          </div>

          {draft && (
            <div className="flex gap-2 pb-6">
              <button onClick={() => setDraft(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50">되돌리기</button>
              <button onClick={save} className="flex-1 bg-black text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-800">저장</button>
            </div>
          )}
        </div>
      )}

      {pickerFor && (
        <AssetPicker assets={assets} products={products}
          onSelect={(a) => addAssetToBP(pickerFor.productId, pickerFor.type, a.id)}
          onClose={() => setPickerFor(null)} />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// TAB 4: 레퍼런스
// ───────────────────────────────────────────────
const INIT_REF_CATS = [
  { id: "rc1", name: "헤어마스카라 경쟁사" },
  { id: "rc2", name: "두피케어 카테고리" },
  { id: "rc3", name: "K-뷰티 해외진출" },
];

function ReferencesTab({ references, setReferences }) {
  const [cats, setCats] = useState(INIT_REF_CATS);
  const [activeCat, setActiveCat] = useState(cats[0]?.id || "");
  const [editCatId, setEditCatId] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [filterProd, setFilterProd] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editRef, setEditRef] = useState(null);

  const addCat = () => {
    const nc = { id: genId(), name: "새 카테고리" };
    setCats((prev) => [...prev, nc]);
    setActiveCat(nc.id);
  };

  const REF_PRODS = ["전체 카테고리", "헤어마스카라", "헤어케어", "두피케어", "샴푸", "기타"];

  const filtered = references.filter((r) =>
    (activeCat === "all" || r.catId === activeCat) &&
    (filterProd === "전체 카테고리" || r.prodCategory === filterProd) &&
    matchMonth(r.date, monthFilter)
  );

  const handleSave = (r) => setReferences((prev) => { const e = prev.find((x) => x.id === r.id); return e ? prev.map((x) => x.id === r.id ? r : x) : [...prev, r]; });

  return (
    <div>
      {/* 카테고리 탭 */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {cats.map((c) => (
          <div key={c.id} className="flex items-center">
            {editCatId === c.id ? (
              <input autoFocus className="text-xs border border-gray-300 rounded-full px-3 py-1 focus:outline-none w-32"
                value={editCatName} onChange={(e) => setEditCatName(e.target.value)}
                onBlur={() => { setCats((prev) => prev.map((x) => x.id === c.id ? { ...x, name: editCatName } : x)); setEditCatId(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setCats((prev) => prev.map((x) => x.id === c.id ? { ...x, name: editCatName } : x)); setEditCatId(null); } }} />
            ) : (
              <button onClick={() => setActiveCat(c.id)} className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1 ${activeCat === c.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>
                {c.name}
                {activeCat === c.id && <>
                  <span onClick={(e) => { e.stopPropagation(); setEditCatId(c.id); setEditCatName(c.name); }} className="opacity-50 hover:opacity-100 ml-0.5">✏️</span>
                  <span onClick={(e) => { e.stopPropagation(); setCats((prev) => prev.filter((x) => x.id !== c.id)); }} className="opacity-50 hover:opacity-100 text-red-400">×</span>
                </>}
              </button>
            )}
          </div>
        ))}
        <button onClick={addCat} className="text-xs px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600">+ 카테고리 추가</button>
      </div>

      {/* 필터 */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2"><span className="text-xs text-gray-400 w-8">월</span><MonthFilter value={monthFilter} onChange={setMonthFilter} /></div>
        <div className="flex items-center gap-2 flex-wrap"><span className="text-xs text-gray-400 w-8">분류</span>{REF_PRODS.map((p) => <button key={p} onClick={() => setFilterProd(p)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterProd === p ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p}</button>)}</div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-gray-400">{filtered.length}개 레퍼런스</p>
        <button onClick={() => { setEditRef(null); setShowForm(true); }} className="bg-black text-white text-xs px-4 py-2 rounded-full hover:bg-gray-800">+ 레퍼런스 추가</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((r) => (
          <div key={r.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer" onClick={() => { setEditRef(r); setShowForm(true); }}>
            {r.thumbUrl ? <img src={r.thumbUrl} alt="" className="w-full h-28 object-cover" onClick={(e) => { if (r.url) { e.stopPropagation(); window.open(r.url, "_blank"); } }} /> : <div className="h-28 bg-gray-50 flex items-center justify-center cursor-pointer" onClick={(e) => { if (r.url) { e.stopPropagation(); window.open(r.url, "_blank"); } }}><span className="text-3xl text-gray-200">🔗</span></div>}
            <div className="p-3">
              <p className="text-sm font-semibold text-gray-800 line-clamp-2 mb-1">{r.title || "(제목 없음)"}</p>
              <div className="flex gap-1 flex-wrap">
                {r.brand && <Pill color="blue">{r.brand}</Pill>}
                {r.prodCategory && <Pill color="gray">{r.prodCategory}</Pill>}
              </div>
              {r.memo && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{r.memo}</p>}
              <p className="text-xs text-gray-300 mt-1">{r.date}</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-20 text-gray-300"><p className="text-4xl mb-3">🔍</p><p className="text-sm">레퍼런스를 추가해보세요</p></div>}
      </div>

      {showForm && (
        <RefForm ref_={editRef} cats={cats} onSave={handleSave} onClose={() => { setShowForm(false); setEditRef(null); }} />
      )}
    </div>
  );
}

function RefForm({ ref_, cats, onSave, onClose }) {
  const REF_PRODS = ["전체 카테고리", "헤어마스카라", "헤어케어", "두피케어", "샴푸", "기타"];
  const [form, setForm] = useState(ref_ || { id: genId(), catId: cats[0]?.id || "", title: "", brand: "", prodCategory: "헤어마스카라", url: "", thumbUrl: "", memo: "", why: "", date: new Date().toISOString().slice(0, 10) });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const handleThumb = (e) => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = (ev) => set("thumbUrl")(ev.target.result); r.readAsDataURL(file); };
  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-sm">레퍼런스 {ref_ ? "수정" : "추가"}</h2><button onClick={onClose} className="text-gray-400 hover:text-black text-xl w-7 h-7 flex items-center justify-center">✕</button></div>
        <div className="space-y-3">
          <div><Label>카테고리</Label><div className="flex gap-1.5 flex-wrap">{cats.map((c) => <button key={c.id} onClick={() => set("catId")(c.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${form.catId === c.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{c.name}</button>)}</div></div>
          <div><Label>제품 카테고리</Label><div className="flex gap-1.5 flex-wrap">{REF_PRODS.slice(1).map((p) => <button key={p} onClick={() => set("prodCategory")(p)} className={`text-xs px-2.5 py-1 rounded-full border transition ${form.prodCategory === p ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p}</button>)}</div></div>
          <div><Label>브랜드명</Label><TF value={form.brand} onChange={set("brand")} placeholder="타사 브랜드명" /></div>
          <div><Label>제목/설명</Label><TF value={form.title} onChange={set("title")} placeholder="레퍼런스 제목 또는 간단한 설명" /></div>
          <div><Label>링크</Label><TF value={form.url} onChange={set("url")} placeholder="https://..." /></div>
          <div><Label>대표 이미지</Label>
            <label className="block cursor-pointer">
              {form.thumbUrl ? <img src={form.thumbUrl} alt="" className="w-full h-32 object-cover rounded-xl border border-gray-200" /> : <div className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-400 hover:border-gray-400 transition">+ 이미지 업로드 (클릭 시 링크로 이동)</div>}
              <input type="file" accept="image/*" className="hidden" onChange={handleThumb} />
            </label>
          </div>
          <div><Label>이 레퍼런스를 고른 이유</Label><TA value={form.why} onChange={set("why")} placeholder="어떤 편익/전략에 활용하고 싶나" rows={2} /></div>
          <div><Label>메모</Label><TA value={form.memo} onChange={set("memo")} placeholder="자유 메모" rows={2} /></div>
        </div>
        <div className="flex gap-2 mt-5"><button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500">취소</button><button onClick={() => { onSave(form); onClose(); }} className="flex-1 bg-black text-white rounded-xl py-2 text-sm font-semibold">저장</button></div>
      </div>
    </Modal>
  );
}

// ───────────────────────────────────────────────
// TAB 5: 광고 대시보드
// ───────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n").map((l) => l.split(",").map((v) => v.trim().replace(/^"|"$/g, "")));
  if (lines.length < 2) return [];
  const headers = lines[0].map((h) => h.toLowerCase());
  return lines.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ""; });
    return obj;
  });
}

const META_KEY_MAP = {
  "캠페인 이름": "campaign", "광고 이름": "adName", "광고 제목": "adName",
  "노출": "impressions", "클릭(전체)": "clicks", "cpm": "cpm", "cpc(전체)": "cpc",
  "ctr(전체)": "ctr", "소진 금액 (krw)": "spend", "구매": "convValue",
  "roas (광고 지출 대비 수익률)": "roas", "결과": "results",
};

function normalizeMeta(row) {
  const out = {};
  Object.entries(row).forEach(([k, v]) => {
    const mapped = META_KEY_MAP[k] || META_KEY_MAP[k.toLowerCase()];
    if (mapped) out[mapped] = v;
    else out[k] = v;
  });
  return out;
}

function MetricCard({ label, value, sub, color = "gray" }) {
  const colors = { gray: "text-gray-800", green: "text-emerald-600", blue: "text-blue-600", amber: "text-amber-600", red: "text-red-500" };
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-black ${colors[color]}`}>{value || "—"}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SimpleBar({ data, valueKey, labelKey, label }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => parseFloat(d[valueKey]) || 0));
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 mb-3">{label}</p>
      <div className="space-y-2">
        {data.slice(0, 8).map((d, i) => {
          const val = parseFloat(d[valueKey]) || 0;
          const pct = max > 0 ? (val / max) * 100 : 0;
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-gray-600 truncate max-w-[60%]">{d[labelKey]}</span>
                <span className="text-xs font-semibold text-gray-700">{val.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DashboardTab({ assets, products }) {
  const [csvRows, setCsvRows] = useState([]);
  const [matchedRows, setMatchedRows] = useState([]);
  const [monthFilter, setMonthFilter] = useState("all");
  const [filterProd, setFilterProd] = useState("all");
  const fileRef = useRef();

  const handleCSV = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const rows = parseCSV(ev.target.result).map(normalizeMeta);
      setCsvRows(rows);
      // 간단 매칭: 소재 title이 adName에 포함되면 연결
      const matched = rows.map((row) => {
        const asset = assets.find((a) => a.title && row.adName && row.adName.includes(a.title));
        return { ...row, assetId: asset?.id || null, productId: asset?.productId || null };
      });
      setMatchedRows(matched);
    };
    r.readAsText(file, "UTF-8");
  };

  const filteredRows = matchedRows.filter((r) => filterProd === "all" || r.productId === filterProd);

  const sum = (key) => filteredRows.reduce((acc, r) => acc + (parseFloat(r[key]) || 0), 0);
  const avg = (key) => filteredRows.length ? (sum(key) / filteredRows.length).toFixed(2) : "—";

  const totalSpend = sum("spend");
  const totalConv = sum("convValue");
  const avgRoas = totalSpend > 0 ? (totalConv / totalSpend).toFixed(2) : "—";

  // 소재별 성과 (매칭된 것만)
  const assetPerf = matchedRows.filter((r) => r.assetId).reduce((acc, r) => {
    const key = r.assetId;
    if (!acc[key]) acc[key] = { assetId: key, roas: 0, ctr: 0, spend: 0, count: 0, adName: r.adName || "" };
    acc[key].roas += parseFloat(r.roas) || 0;
    acc[key].ctr += parseFloat(r.ctr) || 0;
    acc[key].spend += parseFloat(r.spend) || 0;
    acc[key].count += 1;
    return acc;
  }, {});
  const assetPerfList = Object.values(assetPerf).map((x) => ({ ...x, roas: (x.roas / x.count).toFixed(2), ctr: (x.ctr / x.count).toFixed(2) })).sort((a, b) => b.roas - a.roas);

  return (
    <div>
      {/* 업로드 */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-sm mb-0.5">메타 광고 CSV 업로드</p>
            <p className="text-xs text-gray-400">광고 관리자 → 보고서 → 내보내기(CSV). 소재 제목이 광고명에 포함되면 자동 매칭됩니다.</p>
          </div>
          <div className="flex gap-2 items-center">
            {csvRows.length > 0 && <span className="text-xs text-emerald-600 font-medium">{csvRows.length}행 로드됨 · {matchedRows.filter((r) => r.assetId).length}개 매칭</span>}
            <input type="file" accept=".csv" ref={fileRef} onChange={handleCSV} className="hidden" />
            <button onClick={() => fileRef.current.click()} className="bg-black text-white text-xs px-4 py-2 rounded-full hover:bg-gray-800">CSV 업로드</button>
          </div>
        </div>
      </div>

      {csvRows.length === 0 ? (
        <div className="text-center py-24 text-gray-300">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-sm font-medium">CSV를 업로드하면 광고 성과가 여기에 표시됩니다</p>
          <p className="text-xs mt-2">메타 광고 관리자 → 광고 탭 → 내보내기</p>
        </div>
      ) : (
        <>
          {/* 필터 */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="text-xs text-gray-400">품목</span>
            <button onClick={() => setFilterProd("all")} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterProd === "all" ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>전체</button>
            {products.map((p) => <button key={p.id} onClick={() => setFilterProd(p.id)} className={`text-xs px-2.5 py-1 rounded-full border transition ${filterProd === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500"}`}>{p.name}</button>)}
          </div>

          {/* KPI 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <MetricCard label="통합 ROAS" value={avgRoas} sub="전환값/소진예산" color="green" />
            <MetricCard label="총 소진 예산" value={totalSpend ? `₩${totalSpend.toLocaleString()}` : "—"} color="blue" />
            <MetricCard label="평균 CTR" value={avg("ctr") !== "NaN" ? `${avg("ctr")}%` : "—"} color="amber" />
            <MetricCard label="평균 CPM" value={avg("cpm") !== "NaN" ? `₩${parseFloat(avg("cpm")).toLocaleString()}` : "—"} color="gray" />
          </div>

          {/* 바 차트 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <SimpleBar data={filteredRows.sort((a, b) => (parseFloat(b.roas) || 0) - (parseFloat(a.roas) || 0))} valueKey="roas" labelKey="adName" label="ROAS 상위 광고" />
            <SimpleBar data={filteredRows.sort((a, b) => (parseFloat(b.ctr) || 0) - (parseFloat(a.ctr) || 0))} valueKey="ctr" labelKey="adName" label="CTR 상위 광고" />
          </div>

          {/* 소재 매칭 테이블 */}
          {assetPerfList.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-3">아카이브 소재 성과 (자동 매칭)</p>
              <div className="space-y-2">
                {assetPerfList.map((row) => {
                  const asset = assets.find((a) => a.id === row.assetId);
                  const prod = products.find((p) => p.id === asset?.productId);
                  return (
                    <div key={row.assetId} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-gray-200 transition">
                      {asset?.thumbUrl ? <img src={asset.thumbUrl} alt="" className="w-12 h-10 object-cover rounded-lg flex-shrink-0" /> : <div className="w-12 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><span className="text-lg">🎬</span></div>}
                      <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-gray-800 truncate">{asset?.title || row.adName}</p>{prod && <Pill color="indigo">{prod.name}</Pill>}</div>
                      <div className="flex gap-4 text-right flex-shrink-0">
                        <div><p className="text-xs text-gray-400">ROAS</p><p className="text-sm font-bold text-emerald-600">{row.roas}</p></div>
                        <div><p className="text-xs text-gray-400">CTR</p><p className="text-sm font-bold">{row.ctr}%</p></div>
                        <div><p className="text-xs text-gray-400">소진</p><p className="text-sm font-bold">₩{parseFloat(row.spend).toLocaleString()}</p></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 원본 테이블 */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 mb-3">전체 데이터 ({filteredRows.length}행)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-100">{["광고명","ROAS","CTR","CPM","CPC","소진","전환값"].map((h) => <th key={h} className="text-left py-2 pr-4 text-gray-400 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>
                  {filteredRows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4 max-w-[180px] truncate text-gray-700">{r.adName || r.campaign || "—"}</td>
                      <td className="py-2 pr-4 font-semibold text-emerald-600">{r.roas || "—"}</td>
                      <td className="py-2 pr-4">{r.ctr ? `${r.ctr}%` : "—"}</td>
                      <td className="py-2 pr-4">{r.cpm ? `₩${parseFloat(r.cpm).toLocaleString()}` : "—"}</td>
                      <td className="py-2 pr-4">{r.cpc ? `₩${parseFloat(r.cpc).toLocaleString()}` : "—"}</td>
                      <td className="py-2 pr-4">{r.spend ? `₩${parseFloat(r.spend).toLocaleString()}` : "—"}</td>
                      <td className="py-2 pr-4">{r.convValue ? `₩${parseFloat(r.convValue).toLocaleString()}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRows.length > 20 && <p className="text-xs text-gray-400 mt-2 text-center">+{filteredRows.length - 20}행 더 있음</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// IMPORT / EXPORT
// ───────────────────────────────────────────────
function useImportExport({ products, setProducts, assets, setAssets, meetings, setMeetings, references, setReferences }) {
  const importRef = useRef();
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ products, assets, meetings, references }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `narka-creative-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  const importData = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.products) setProducts(d.products);
        if (d.assets) setAssets(d.assets);
        if (d.meetings) setMeetings(d.meetings);
        if (d.references) setReferences(d.references);
        alert("불러오기 완료!");
      } catch { alert("파일 형식 오류"); }
    };
    r.readAsText(file);
  };
  return { importRef, exportData, importData };
}

// ───────────────────────────────────────────────
// MAIN APP
// ───────────────────────────────────────────────
// ───────────────────────────────────────────────
// USP 맵 탭
// ───────────────────────────────────────────────
function USPMapTab({ products, assets }) {
  const [activePid, setActivePid] = useState(products[0]?.id || "");
  const prod = products.find((p) => p.id === activePid);

  if (!prod) return <p className="text-sm text-gray-400 text-center py-16">품목을 선택하세요</p>;

  // usp별로 소재 묶기
  const grouped = {};
  prod.usps.forEach((u) => { grouped[u.id] = []; });
  assets.filter((a) => a.productId === activePid).forEach((a) => {
    if (a.uspId && grouped[a.uspId]) grouped[a.uspId].push(a);
  });

  const totalAssets = assets.filter((a) => a.productId === activePid).length;
  const coveredUsps = prod.usps.filter((u) => (grouped[u.id] || []).length > 0).length;

  return (
    <div>
      {/* 품목 탭 */}
      <div className="flex gap-2 flex-wrap mb-5">
        {products.map((p) => (
          <button key={p.id} onClick={() => setActivePid(p.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${activePid === p.id ? "bg-black text-white border-black" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.tag === "MAIN" ? "bg-indigo-400" : "bg-gray-400"}`} />
            {p.name}
          </button>
        ))}
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black">{prod.usps.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">전체 USP 꼭지</p>
        </div>
        <div className="bg-white border border-indigo-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-indigo-600">{coveredUsps}</p>
          <p className="text-xs text-gray-400 mt-0.5">소재 있는 꼭지</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black">{totalAssets}</p>
          <p className="text-xs text-gray-400 mt-0.5">이 품목 소재 수</p>
        </div>
      </div>

      {/* USP별 카드 */}
      {prod.usps.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-16">USP 설정 탭에서 편익 꼭지를 먼저 추가하세요</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prod.usps.map((u) => {
            const items = grouped[u.id] || [];
            const winningItems = items.filter((a) => a.isWinning);
            const bestItems = items.filter((a) => a.result === "best");
            const worstItems = items.filter((a) => a.result === "worst");
            return (
              <div key={u.id} className={`bg-white border rounded-xl p-4 shadow-sm ${items.length === 0 ? "border-dashed border-gray-200" : "border-gray-100"}`}>
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${items.length > 0 ? "bg-indigo-400" : "bg-gray-200"}`} />
                    <p className="text-sm font-semibold text-gray-800">{u.label}</p>
                  </div>
                  <span className="text-xs text-gray-400">{items.length}개</span>
                </div>

                {/* 카피 목록 */}
                {u.copies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {u.copies.map((c) => (
                      <span key={c.id} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">{c.text}</span>
                    ))}
                  </div>
                )}

                {/* 소재 칩 */}
                {items.length === 0 ? (
                  <p className="text-xs text-gray-300 italic">아직 소재 없음</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {items.map((a) => (
                      <span key={a.id} className={`text-xs px-2 py-1 rounded-lg border ${
                        a.isWinning ? "border-amber-300 bg-amber-50 text-amber-700 font-semibold"
                        : a.result === "best" ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : a.result === "worst" ? "border-red-200 bg-red-50 text-red-500"
                        : "border-gray-200 bg-gray-50 text-gray-600"
                      }`}>
                        {a.title || "(제목없음)"}{a.isWinning && " 🏆"}
                      </span>
                    ))}
                  </div>
                )}

                {/* 미니 통계 */}
                {items.length > 0 && (
                  <div className="flex gap-3 mt-3 pt-3 border-t border-gray-50">
                    {winningItems.length > 0 && <span className="text-xs text-amber-600">🏆 {winningItems.length}</span>}
                    {bestItems.length > 0 && <span className="text-xs text-emerald-600">✅ {bestItems.length}</span>}
                    {worstItems.length > 0 && <span className="text-xs text-red-500">❌ {worstItems.length}</span>}
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

const TABS = [
  { id: "usp", label: "⚙️ USP 설정" },
  { id: "uspmap", label: "🗺️ USP 맵" },
  { id: "archive", label: "🎬 소재 아카이브" },
  { id: "meeting", label: "📋 주간 회의" },
  { id: "references", label: "🔍 레퍼런스" },
  { id: "dashboard", label: "📊 광고 대시보드" },
];

export default function App() {
  const [tab, setTab] = useState("archive");
  const { products, setProducts, assets, setAssets, meetings, setMeetings, references, setReferences } = useAppState();
  const { importRef, exportData, importData } = useImportExport({ products, setProducts, assets, setAssets, meetings, setMeetings, references, setReferences });

  const winningCount = assets.filter((a) => a.isWinning).length;
  const activeCount = assets.filter((a) => a.status === "진행중").length;

  return (
    <div className="min-h-screen bg-[#f7f7f8] font-sans">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-lg tracking-tighter text-black">NARKA</span>
            <span className="text-xs text-gray-400 hidden sm:block">Creative Hub</span>
            <div className="hidden sm:flex gap-2">
              <Pill color="emerald">🏆 위닝 {winningCount}</Pill>
              <Pill color="blue">▶ 진행중 {activeCount}</Pill>
            </div>
          </div>
          <div className="flex gap-1.5">
            <input type="file" accept=".json" ref={importRef} onChange={importData} className="hidden" />
            <button onClick={() => importRef.current.click()} className="text-xs px-3 py-1.5 border border-gray-200 rounded-full text-gray-500 hover:bg-gray-50 transition">불러오기</button>
            <button onClick={exportData} className="text-xs px-3 py-1.5 bg-black text-white rounded-full hover:bg-gray-800 transition">내보내기</button>
          </div>
        </div>
        {/* 탭 */}
        <div className="max-w-6xl mx-auto px-4 flex overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`text-xs sm:text-sm px-3 sm:px-4 py-2.5 border-b-2 transition font-medium whitespace-nowrap ${tab === t.id ? "border-black text-black" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 바디 */}
      <div className="max-w-6xl mx-auto px-4 py-5">
        {tab === "usp" && <USPSettingsTab products={products} setProducts={setProducts} />}
        {tab === "uspmap" && <USPMapTab products={products} assets={assets} />}
        {tab === "archive" && <ArchiveTab assets={assets} setAssets={setAssets} products={products} />}
        {tab === "meeting" && <MeetingTab meetings={meetings} setMeetings={setMeetings} products={products} assets={assets} />}
        {tab === "references" && <ReferencesTab references={references} setReferences={setReferences} />}
        {tab === "dashboard" && <DashboardTab assets={assets} products={products} />}
      </div>
    </div>
  );
}
