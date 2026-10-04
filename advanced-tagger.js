const ADVANCED_BASE = "/job-tag-alias-master/";
const MASTER_URL = ADVANCED_BASE + "data/job-tags.json";
const DEFAULTS_URL = ADVANCED_BASE + "config/matching-defaults.json";
const MATCHER_URL = ADVANCED_BASE + "matcher.js?v=20261004e";

let resourcePromise = null;

const LABEL_MAP = {
  "勤務場所名1": "勤務地",
  "勤務地住所1": "勤務地住所",
  "交通1": "交通",
  "仕事名": "仕事名",
  "Indeed用求人タイトル": "Indeed用求人タイトル"
};

export async function loadAdvancedTagger() {
  if (resourcePromise) return resourcePromise;

  resourcePromise = Promise.all([
    fetch(MASTER_URL, { cache: "no-store" }).then(res => {
      if (!res.ok) throw new Error("求人タグマスタを読み込めませんでした");
      return res.json();
    }),
    fetch(DEFAULTS_URL, { cache: "no-store" }).then(res => {
      if (!res.ok) throw new Error("判定設定を読み込めませんでした");
      return res.json();
    }),
    import(MATCHER_URL)
  ]).then(([master, defaults, matcher]) => {
    if (!matcher || typeof matcher.analyzeText !== "function") {
      throw new Error("Advanced判定エンジンを読み込めませんでした");
    }

    const codeMap = {};
    master.tags.forEach(tag => {
      codeMap[String(tag.tag_code)] = tag.job_tag || tag.canonical;
    });

    return {
      master,
      defaults,
      codeMap,
      version: master.schema_version,
      snapshotDate: master.snapshot_date,
      analyzeText(text) {
        return matcher.analyzeText(text, master, defaults);
      },
      analyzeFields(fields) {
        if (typeof matcher.analyzeFields === "function") {
          return matcher.analyzeFields(fields, master, defaults);
        }
        const fallbackText = (fields || [])
          .filter(field => field && field.value)
          .map(field => (LABEL_MAP[field.name] || field.name || "項目") + "：" + String(field.value))
          .join("\n");
        return matcher.analyzeText(fallbackText, master, defaults);
      }
    };
  }).catch(error => {
    resourcePromise = null;
    throw error;
  });

  return resourcePromise;
}

export function buildAdvancedFields({ row, headerRow, indices, jobTypeText, featureTexts }) {
  const fields = [];

  indices.forEach(idx => {
    if (!row[idx]) return;
    const rawName = String(headerRow[idx] || "").trim() || ("列" + idx);
    fields.push({ name: rawName, value: String(row[idx]) });
  });

  if (jobTypeText) {
    fields.push({ name: "職種コード名称", value: String(jobTypeText) });
  }

  (featureTexts || []).forEach(text => {
    if (text) fields.push({ name: "特徴コード名称", value: String(text) });
  });

  return fields;
}

export function buildAdvancedSource(args) {
  return buildAdvancedFields(args)
    .map(field => (LABEL_MAP[field.name] || field.name) + "：" + field.value)
    .join("\n");
}

export const advancedTaggingMeta = {
  base: ADVANCED_BASE,
  master: MASTER_URL,
  defaults: DEFAULTS_URL,
  matcher: MATCHER_URL
};
