export const config = { runtime: "edge" };

const FIELDS = "ad_name,spend,impressions,clicks,ctr,cpm,cpc,purchase_roas,actions,action_values";

async function fetchAdInsights(accountId, token, datePreset = "last_30d") {
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?fields=${FIELDS}&level=ad&date_preset=${datePreset}&limit=500&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

function normalizeMeta(row) {
  const roas = row.purchase_roas?.[0]?.value;
  const convValue = row.action_values?.find(a => a.action_type === "purchase")?.value;
  return {
    adName: row.ad_name || "",
    startDate: row.date_start || "",
    endDate: row.date_stop || "",
    spend: row.spend || "",
    roas: roas ? (parseFloat(roas) * 100).toFixed(0) : "",
    ctr: row.ctr ? (parseFloat(row.ctr) * 100).toFixed(2) : "",
    cpm: row.cpm || "",
    cpc: row.cpc || "",
    convValue: convValue || "",
    impressions: row.impressions || "",
  };
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const datePreset = searchParams.get("date_preset") || "last_30d";

  const token = process.env.VITE_META_TOKEN;
  const account1 = process.env.VITE_META_ACCOUNT_1;
  const account2 = process.env.VITE_META_ACCOUNT_2;

  if (!token) {
    return new Response(JSON.stringify({ error: "토큰 없음" }), { status: 500 });
  }

  try {
    const results = await Promise.all([
      account1 ? fetchAdInsights(account1, token, datePreset) : null,
      account2 ? fetchAdInsights(account2, token, datePreset) : null,
    ]);

    const rows = [];
    for (const result of results) {
      if (!result || result.error) continue;
      const data = result.data || [];
      rows.push(...data.map(normalizeMeta));
    }

    return new Response(JSON.stringify({ rows, total: rows.length }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
