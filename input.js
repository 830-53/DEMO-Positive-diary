function getWeekdayLabel(dateValue) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
}

function getTodayDateValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function formatDateYmd(dateValue) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}


function getWeatherLabel(weather) {
  return {
    sunny: "晴れ",
    cloudy: "曇り",
    rainy: "雨",
    snowy: "雪",
    typhoon: "台風",
  }[weather] || "";
}

const EMOTION_AXES = [
  { key: "happy", label: "うれしい", color: "#ff9f43" },
  { key: "excited", label: "ワクワク", color: "#ffd84d" },
  { key: "fun", label: "楽しい", color: "#ff6fa8" },
  { key: "irritated", label: "イライラ", color: "#ff5c5c" },
  { key: "anxious", label: "焦り・不安", color: "#b85cff" },
  { key: "regret", label: "後悔", color: "#8f67ff" },
  { key: "sad", label: "悲しい", color: "#4f8df7" },
  { key: "other", label: "その他", color: "#a6a6a6" },
];

const EMOTION_RADAR_SIZE = 320;
const EMOTION_RADAR_CENTER = EMOTION_RADAR_SIZE / 2;
const EMOTION_RADAR_RADIUS = 122;
const EMOTION_RADAR_LEVELS = 4;

function createEmotionProfile() {
  return EMOTION_AXES.reduce((profile, { key }) => {
    profile[key] = 0;
    return profile;
  }, {});
}

function normalizeEmotionProfile(profile) {
  const nextProfile = createEmotionProfile();

  if (!profile || typeof profile !== "object") {
    return nextProfile;
  }

  EMOTION_AXES.forEach(({ key }) => {
    const level = Number(profile[key]);
    nextProfile[key] = Number.isFinite(level) ? Math.max(0, Math.min(EMOTION_RADAR_LEVELS, Math.round(level))) : 0;
  });

  return nextProfile;
}

function getEmotionSummaryLevel(profile) {
  const levels = EMOTION_AXES.map(({ key }) => Number(profile?.[key] || 0));
  const strongestLevel = levels.reduce((maxLevel, level) => Math.max(maxLevel, level), 0);

  if (!Number.isFinite(strongestLevel) || strongestLevel <= 0) {
    return 20;
  }

  return Math.min(100, 20 + strongestLevel * 20);
}

function getEmotionAxisAngle(index) {
  return index * 45;
}

function getEmotionPoint(radius, angleDeg) {
  const radians = (angleDeg * Math.PI) / 180;
  return [
    EMOTION_RADAR_CENTER + radius * Math.sin(radians),
    EMOTION_RADAR_CENTER - radius * Math.cos(radians),
  ];
}

function getEmotionPolygonPoints(profile) {
  return EMOTION_AXES.map(({ key }, index) => {
    const level = Number(profile?.[key] || 0);
    const levelRatio = Math.max(0, Math.min(EMOTION_RADAR_LEVELS, level)) / EMOTION_RADAR_LEVELS;
    const [x, y] = getEmotionPoint(EMOTION_RADAR_RADIUS * levelRatio, getEmotionAxisAngle(index));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function getEmotionRadarMarkup(profile) {
  const normalizedProfile = normalizeEmotionProfile(profile);
  const ringLevels = [1, 2, 3, 4];
  const rings = ringLevels.map((level) => {
    const radius = (EMOTION_RADAR_RADIUS * level) / EMOTION_RADAR_LEVELS;
    const points = EMOTION_AXES.map((_, index) => {
      const [x, y] = getEmotionPoint(radius, getEmotionAxisAngle(index));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    return `<polygon class="emotion-radar-ring" points="${points}" />`;
  }).join("");

  const axes = EMOTION_AXES.map((axis, index) => {
    const [x, y] = getEmotionPoint(EMOTION_RADAR_RADIUS, getEmotionAxisAngle(index));
    return `<line class="emotion-radar-axis" x1="${EMOTION_RADAR_CENTER}" y1="${EMOTION_RADAR_CENTER}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" />`;
  }).join("");

  const handles = EMOTION_AXES.map((axis, index) => {
    const level = normalizedProfile[axis.key];
    const levelRatio = level / EMOTION_RADAR_LEVELS;
    const [x, y] = getEmotionPoint(EMOTION_RADAR_RADIUS * levelRatio, getEmotionAxisAngle(index));
    const handleRadius = level === 0 ? 4.5 : 6.5;

    return `
      <circle
        class="emotion-radar-handle"
        cx="${x.toFixed(1)}"
        cy="${y.toFixed(1)}"
        r="${handleRadius}"
        fill="${axis.color}"
        data-emotion-axis="${axis.key}"
        data-emotion-level="${level}"
      />
    `;
  }).join("");

  const shapePoints = getEmotionPolygonPoints(normalizedProfile);
  const labels = EMOTION_AXES.map((axis, index) => {
    const angle = getEmotionAxisAngle(index);
    const level = normalizedProfile[axis.key];

    return `
      <div class="emotion-radar-label" style="--emotion-angle: ${angle}deg; --emotion-color: ${axis.color};">
        <span class="emotion-radar-label-name">${axis.label}</span>
        <span class="emotion-radar-label-value">${level}/4</span>
      </div>
    `;
  }).join("");

  return `
    <div class="emotion-radar-shell">
      <div class="emotion-radar-surface" aria-hidden="true"></div>
      <svg class="emotion-radar-svg" viewBox="0 0 ${EMOTION_RADAR_SIZE} ${EMOTION_RADAR_SIZE}" role="img" aria-label="感情レーダーチャート">
        <g>
          ${rings}
          ${axes}
          <polygon class="emotion-radar-shape" points="${shapePoints}" />
          ${handles}
        </g>
      </svg>
      <div class="emotion-radar-labels" aria-hidden="true">
        ${labels}
      </div>
    </div>
    <p class="emotion-radar-note">図を直接押して、中心から外へ4段階で選べます。</p>
  `;
}

function getEmotionValue(level) {
  const allowedValues = [100, 90, 80, 70, 60, 50, 40, 30, 20];
  const numericLevel = Number(level);

  if (allowedValues.includes(numericLevel)) {
    return numericLevel;
  }

  if (Number.isFinite(numericLevel) && numericLevel >= 1 && numericLevel <= 5) {
    return numericLevel * 20;
  }

  return 60;
}

async function loadlettersForSave() {
  const response = await fetch("/data/diary.json");
  if (!response.ok) {
    throw new Error("diary.json の読み込みに失敗しました。");
  }

  const letters = await response.json();
  return Array.isArray(letters) ? letters : [];
}

// ここから置き換え(ファイアベースに保存する処理に変更)
async function saveDraftTolettersJson(draft) {
  const db = window.db;
  const { doc, setDoc } = window.dbFunctions;

  const security = window.siteSecurity;
  const validation = security?.validateDraft(draft);
  if (validation && !validation.valid) {
    throw new Error(validation.errors[0]);
  }
  if (security?.isRateLimited("letters:save", 20, 60_000)) {
    throw new Error("保存操作が多すぎます。しばらく待ってからお試しください。");
  }

  if (!db || !doc || !setDoc) {
    throw new Error("Firebaseの準備ができていません。");
  }

  const memoEmotionProfile = normalizeEmotionProfile(draft.memoEmotionProfile);
  const hasEmotionProfile = draft.memoEmotionProfileTouched || EMOTION_AXES.some(({ key }) => Number(memoEmotionProfile[key]) > 0);
  const memoEmotionLevel = hasEmotionProfile
    ? getEmotionSummaryLevel(memoEmotionProfile)
    : getEmotionValue(draft.memoEmotionLevel);
  const emotionDetailLines = hasEmotionProfile
    ? [
        `感情の内訳:`,
        ...EMOTION_AXES.map(({ key, label }) => `・${label}: ${memoEmotionProfile[key]}/4`),
      ]
    : [];

  // 1つの文章に合体させるパーツ（もともとあった処理をそのまま活用！）
  const body = [
    `1. 日付・曜日・天気`,
    `日付: ${draft.memoDate}`,
    `曜日: ${draft.memoWeekday}`,
    ...(draft.memoWeather ? [`天気: ${getWeatherLabel(draft.memoWeather)}`] : []),
    `感情パラメータ: ${memoEmotionLevel}`,
    ...emotionDetailLines,
    `2. 今日の出来事`,
    `出来事: ${draft.memoTodayEvent}`,
    `3. 今日できたこと`,
    `自由記述: ${draft.memoAchievementNotes}`,
    `4. 明日やりたいこと`,
    draft.memoTomorrowGoal,
    `5. 明日楽しみなこと`,
    draft.memoTomorrowFun,
  ].join("\n");

  // Firebaseに保存するデータの形（バラバラの項目も一緒に持たせる！）
  const nextletter = {
    id: crypto.randomUUID(),
    title: draft.title,
    body: body, 

    // カレンダーや履歴で使いやすいようにバラバラの項目を持たせる
    memoDate: draft.memoDate,
    memoWeekday: draft.memoWeekday,
    memoWeather: draft.memoWeather,
    memoEmotionLevel: String(memoEmotionLevel),
    // 常に感情プロファイルを保存する（一次元の値のみの特別扱いを廃止）
    memoEmotionProfile: memoEmotionProfile,
    memoEmotionProfileTouched: Boolean(draft.memoEmotionProfileTouched),
    memoTodayEvent: draft.memoTodayEvent,
    memoEmotionReason: draft.memoEmotionReason,
    memoEmotionPositive: draft.memoEmotionPositive,
    memoAchievementNotes: draft.memoAchievementNotes,
    memoTomorrowGoal: draft.memoTomorrowGoal,
    memoTomorrowFun: draft.memoTomorrowFun,
    
    createdAt: new Date().toISOString(),
    deliveryAt: "",
    readAt: null,
    notifiedAt: null,
  };

  // Firebaseのユーザー別コレクションにデータを追加する（ログイン済みなら users/{uid}/letters）
  const currentUid = window.currentUserUid || (window.firebaseAuth?.currentUser?.uid);
  const path = currentUid
    ? ["users", currentUid, "letters", nextletter.id]
    : ["letters", nextletter.id];
  await setDoc(doc(db, ...path), nextletter);

  const firebaseStore = window.firebaseLetterStore;
  if (firebaseStore?.saveMonthlyEmotionSummary) {
    await firebaseStore.saveMonthlyEmotionSummary(draft);
  }

  return nextletter;
}
// ここまで置き換え

function renderWriteView() {
  const form = document.getElementById("draft-form");
  const draft = loadDraft();
  const initialDate = draft.memoDate || getTodayDateValue();
  const hasStoredEmotionProfile = Object.prototype.hasOwnProperty.call(draft, "memoEmotionProfile");
  const initialEmotionProfile = hasStoredEmotionProfile ? normalizeEmotionProfile(draft.memoEmotionProfile) : createEmotionProfile();
  const initialEmotionValue = hasStoredEmotionProfile
    ? getEmotionSummaryLevel(initialEmotionProfile)
    : getEmotionValue(draft.memoEmotionLevel);
  const initialEmotionTouched = Boolean(draft.memoEmotionProfileTouched || hasStoredEmotionProfile);

  if (!form) {
    return;
  }
  

  form.innerHTML = `
    <section class="memo-section memo-section-1">
      <div class="memo-section-head">
        <span class="memo-step-number">1</span>
        <div>
          <p class="memo-step-title">日付・曜日・天気</p>
          <p class="memo-step-note">今日の基本情報を選んでください。</p>
        </div>
      </div>
      <div class="memo-grid memo-grid-3">
        <label class="memo-field">
          <span>日付</span>
          <input id="memo-date" name="memoDate" type="date" value="${initialDate}" readonly aria-readonly="true" />
          <p class="field-note">自動入力です。表示は ${formatDateYmd(initialDate) || "年・月・日"} です。</p>
        </label>
        <label class="memo-field">
          <span>曜日</span>
          <input id="memo-weekday" name="memoWeekday" type="text" value="${draft.memoWeekday || getWeekdayLabel(initialDate)}" readonly />
        </label>
        <div class="memo-field weather-field">
          <span>天気</span>
          <div class="weather-grid" role="radiogroup" aria-label="天気を選択">
            <label class="weather-option">
              <input type="radio" name="memoWeather" value="sunny" ${draft.memoWeather === "sunny" ? "checked" : ""} />
              <img src="img/wether/sunny.jpg" class="weather-img" alt="晴れ">
              <span>晴れ</span>
            </label>
            <label class="weather-option">
              <input type="radio" name="memoWeather" value="cloudy" ${draft.memoWeather === "cloudy" ? "checked" : ""} />
              <img src="img/wether/clowdy.png" class="weather-img" alt="曇り">
              <span>曇り</span>
            </label>
            <label class="weather-option">
              <input type="radio" name="memoWeather" value="rainy" ${draft.memoWeather === "rainy" ? "checked" : ""} />
              <img src="img/wether/rainy.jpg" class="weather-img" alt="雨">
              <span>雨</span>
            </label>
            <label class="weather-option">
              <input type="radio" name="memoWeather" value="snowy" ${draft.memoWeather === "snowy" ? "checked" : ""} />
              <img src="img/wether/snowy.png" class="weather-img" alt="雪">
              <span>雪</span>
            </label>
            <label class="weather-option">
                <input type="radio" name="memoWeather" value="typhoon" ${draft.memoWeather === "typhoon" ? "checked" : ""} />
              <img src="img/wether/typhoon.png" class="weather-img" alt="台風">
            <span>台風</span>
            </label>
          </div>
        </div>
      </div>

      <label class="memo-field emotion-field">
        <span>感情パラメータ</span>
        <input id="memo-emotion-level" name="memoEmotionLevel" type="hidden" value="${initialEmotionValue}" />
        <textarea id="memo-emotion-profile" name="memoEmotionProfile" hidden>${JSON.stringify(initialEmotionProfile)}</textarea>
        <input id="memo-emotion-profile-touched" name="memoEmotionProfileTouched" type="hidden" value="${initialEmotionTouched ? "true" : "false"}" />
        <div id="emotion-scale" class="emotion-scale" role="group" aria-label="感情パラメータを選択"></div>
        <p id="strongest-emotion-output" class="field-note">この中で一番強かった感情は（未選択）</p>
      </label>
    </section>

    <section class="memo-section memo-section-2">
      <div class="memo-section-head">
        <span class="memo-step-number">2</span>
        <div>
          <p class="memo-step-title">今日の出来事</p>
          <p class="memo-step-note">上に出来事、下に感情を入れてください。</p>
        </div>
      </div>
      <div class="memo-grid">
        <label class="memo-field">
          <span>出来事</span>
          <textarea id="memo-today-event" name="memoTodayEvent" rows="4" placeholder="今日あったことを書いてください">${draft.memoTodayEvent || ""}</textarea>
        </label>
        <label class="memo-field">
          <span id="emotion-reason-label">なぜその感情が強かったのか</span>
          <textarea id="memo-emotion-reason" name="memoEmotionReason" rows="4" placeholder="感情が強くなった理由を書いてください">${draft.memoEmotionReason || ""}</textarea>
        </label>
        <label class="memo-field">
          <span>ポジティブ変換</span>
          <textarea id="memo-emotion-positive" name="memoEmotionPositive" rows="4" placeholder="ネガティブなら、前向きに言い換えてみよう">${draft.memoEmotionPositive || ""}</textarea>
        </label>
      </div>
    </section>

    <section class="memo-section memo-section-3">
      <div class="memo-section-head">
        <span class="memo-step-number">3</span>
        <div>
          <p class="memo-step-title">今日できたこと</p>
          <p class="memo-step-note">今日できたことを自由に書き留めます。</p>
        </div>
      </div>
      <label class="memo-field">
      </label>
      <label class="memo-field">
        <span>自由記述</span>
        <textarea id="memo-achievement-notes" name="memoAchievementNotes" rows="4" placeholder="どんなことでも、できたと思ったことを書こう">${draft.memoAchievementNotes || ""}</textarea>
      </label>
    </section>

    <section class="memo-section memo-section-4">
      <div class="memo-section-head">
        <span class="memo-step-number">4</span>
        <div>
          <p class="memo-step-title">明日やりたいこと</p>
          <p class="memo-step-note">一行で、短く書いてください。</p>
        </div>
      </div>
      <label class="memo-field">
        <span>明日やりたいこと</span>
        <textarea id="memo-tomorrow-goal" name="memoTomorrowGoal" rows="2" placeholder="明日やりたいことを一行で">${draft.memoTomorrowGoal || ""}</textarea>
      </label>
    </section>

    <section class="memo-section memo-section-5">
      <div class="memo-section-head">
        <span class="memo-step-number">5</span>
        <div>
          <p class="memo-step-title">明日楽しみなこと</p>
          <p class="memo-step-note">明日楽しみにしていることを書いてください。</p>
        </div>
      </div>
      <label class="memo-field">
        <span>明日楽しみなこと</span>
        <textarea id="memo-tomorrow-fun" name="memoTomorrowFun" rows="2" placeholder="明日楽しみなことを書いてください">${draft.memoTomorrowFun || ""}</textarea>
      </label>
    </section>

    <input id="letter-title" name="title" type="hidden" value="${draft.title || ""}" />
    <textarea id="letter-body" name="body" hidden>${draft.body || ""}</textarea>
    `;

  const dateInput = document.getElementById("memo-date");
  const weekdayInput = document.getElementById("memo-weekday");
  const emotionLevelInput = document.getElementById("memo-emotion-level");
  const emotionProfileInput = document.getElementById("memo-emotion-profile");
  const emotionProfileTouchedInput = document.getElementById("memo-emotion-profile-touched");
  const emotionScale = document.getElementById("emotion-scale");
  const strongestEmotionOutput = document.getElementById("strongest-emotion-output");
  const emotionReasonLabel = document.getElementById("emotion-reason-label");
  let emotionProfileState = initialEmotionProfile;
  let emotionProfileTouched = hasStoredEmotionProfile;

  const getStrongestEmotionLabel = (profile) => {
    const strongestAxis = EMOTION_AXES.reduce((strongest, axis) => {
      const level = Number(profile?.[axis.key] || 0);
      const strongestLevel = Number(strongest?.level || 0);
      return level > strongestLevel ? { axis, level } : strongest;
    }, null);

    return strongestAxis?.level > 0 ? strongestAxis.axis.label : "未選択";
  };

  const syncWeekday = () => {
    if (weekdayInput instanceof HTMLInputElement && dateInput instanceof HTMLInputElement) {
      weekdayInput.value = getWeekdayLabel(dateInput.value);
    }
  };

  const syncEmotionScale = () => {
    if (!(emotionScale instanceof HTMLElement) || !(emotionLevelInput instanceof HTMLInputElement) || !(emotionProfileInput instanceof HTMLTextAreaElement) || !(emotionProfileTouchedInput instanceof HTMLInputElement)) {
      return;
    }

    const currentValue = emotionProfileTouched
      ? getEmotionSummaryLevel(emotionProfileState)
      : initialEmotionValue;
    emotionLevelInput.value = String(currentValue);
    emotionProfileInput.value = JSON.stringify(emotionProfileState);
    emotionProfileTouchedInput.value = emotionProfileTouched ? "true" : "false";
    if (strongestEmotionOutput) {
      const strongestEmotionLabel = getStrongestEmotionLabel(emotionProfileState);
      strongestEmotionOutput.textContent = `この中で一番強かった感情は（${strongestEmotionLabel}）`;
      if (emotionReasonLabel) {
        emotionReasonLabel.textContent = strongestEmotionLabel === "未選択"
          ? "なぜその感情が強かったのか"
          : `なぜ「${strongestEmotionLabel}」が強かったのか`;
      }
    }

    emotionScale.innerHTML = getEmotionRadarMarkup(emotionProfileState);

    const emotionRadarSvg = emotionScale.querySelector(".emotion-radar-svg");
    if (!(emotionRadarSvg instanceof SVGElement)) {
      return;
    }

    emotionRadarSvg.addEventListener("pointerdown", (event) => {
      event.preventDefault();

      const rect = emotionRadarSvg.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const localX = ((event.clientX - rect.left) / rect.width) * EMOTION_RADAR_SIZE;
      const localY = ((event.clientY - rect.top) / rect.height) * EMOTION_RADAR_SIZE;
      const deltaX = localX - EMOTION_RADAR_CENTER;
      const deltaY = localY - EMOTION_RADAR_CENTER;
      const radius = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
      const angle = (Math.atan2(deltaX, -deltaY) * 180 / Math.PI + 360) % 360;
      const axisIndex = Math.round(angle / 45) % EMOTION_AXES.length;
      const level = Math.max(0, Math.min(EMOTION_RADAR_LEVELS, Math.round((radius / EMOTION_RADAR_RADIUS) * EMOTION_RADAR_LEVELS)));
      const nextAxis = EMOTION_AXES[axisIndex];

      if (!nextAxis) {
        return;
      }

      emotionProfileTouched = true;
      emotionProfileState = {
        ...emotionProfileState,
        [nextAxis.key]: level,
      };

      syncEmotionScale();
    });
  };

  dateInput?.addEventListener("input", syncWeekday);
  emotionLevelInput?.addEventListener("input", syncEmotionScale);

  syncWeekday();
  syncEmotionScale();
}

function renderScheduleView() {
  const draft = loadDraft();
  if (!draft.body && !draft.memoTomorrowGoal) {
    showView("write", { updateHash: true });
    return;
  }

  const summary = document.getElementById("draft-summary");
  const modeSelect = document.getElementById("delivery-mode");
  const randomRangeSelect = document.getElementById("delivery-random-range");
  const seasonSelect = document.getElementById("delivery-season");
  const deliveryInput = document.getElementById("delivery-at");

  renderDraftSummary(summary, draft);

  if (deliveryInput) {
    deliveryInput.min = toLocalDateTimeValue(new Date());
    deliveryInput.value = draft.deliveryAt || toLocalDateTimeValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  }

  if (modeSelect) {
    modeSelect.value = draft.deliveryMode || "fixed";
  }

  if (randomRangeSelect) {
    randomRangeSelect.value = draft.deliveryRandomRange || "fiscalYear";
  }

  if (seasonSelect) {
    seasonSelect.value = draft.deliverySeason || "";
  }

  syncScheduleVisibility();
}

function syncScheduleVisibility() {
  const modeSelect = document.getElementById("delivery-mode");
  const randomRangeSelect = document.getElementById("delivery-random-range");
  const seasonSelect = document.getElementById("delivery-season");
  const fixedFields = document.getElementById("fixed-delivery-fields");
  const randomFields = document.getElementById("random-delivery-fields");
  const seasonFields = document.getElementById("delivery-season-fields");
  const deliveryInput = document.getElementById("delivery-at");

  const isRandom = modeSelect?.value === "random";

  if (fixedFields) fixedFields.hidden = isRandom;
  if (randomFields) randomFields.hidden = !isRandom;
  if (deliveryInput) {
    deliveryInput.disabled = isRandom;
    deliveryInput.required = !isRandom;
  }
  if (randomRangeSelect) randomRangeSelect.disabled = !isRandom;
  if (seasonFields) seasonFields.hidden = !isRandom;
  if (seasonSelect) seasonSelect.disabled = !isRandom;
}

function buildMemoDraftFromForm() {
  const dateInput = document.getElementById("memo-date");
  const weekdayInput = document.getElementById("memo-weekday");
  const emotionLevelInput = document.getElementById("memo-emotion-level");
  const emotionProfileInput = document.getElementById("memo-emotion-profile");
  const emotionProfileTouchedInput = document.getElementById("memo-emotion-profile-touched");
  const weatherInput = document.querySelector('input[name="memoWeather"]:checked');
  const titleInput = document.getElementById("letter-title");
  const bodyInput = document.getElementById("letter-body");

  const memoDate = String(dateInput?.value || "");
  const memoWeekday = String(weekdayInput?.value || getWeekdayLabel(memoDate));
  const memoWeather = weatherInput instanceof HTMLInputElement ? weatherInput.value : "";
  let memoEmotionProfile = createEmotionProfile();

  if (emotionProfileInput instanceof HTMLTextAreaElement) {
    try {
      memoEmotionProfile = normalizeEmotionProfile(JSON.parse(emotionProfileInput.value || "{}"));
    } catch {
      memoEmotionProfile = createEmotionProfile();
    }
  }

  const memoEmotionProfileTouched = emotionProfileTouchedInput instanceof HTMLInputElement
    ? emotionProfileTouchedInput.value === "true"
    : false;

  const memoEmotionLevel = String(emotionLevelInput?.value || getEmotionSummaryLevel(memoEmotionProfile));
  const memoTodayEvent = String(document.getElementById("memo-today-event")?.value || "").trim();
  const memoEmotionReason = String(document.getElementById("memo-emotion-reason")?.value || "").trim();
  const memoEmotionPositive = String(document.getElementById("memo-emotion-positive")?.value || "").trim();
  const memoAchievementNotes = String(document.getElementById("memo-achievement-notes")?.value || "").trim();
  const memoTomorrowGoal = String(document.getElementById("memo-tomorrow-goal")?.value || "").trim();
  const memoTomorrowFun = String(document.getElementById("memo-tomorrow-fun")?.value || "").trim();

  const body = [
    `1. 日付・曜日・天気`,
    `日付: ${memoDate}`,
    `曜日: ${memoWeekday}`,
    ...(memoWeather ? [`天気: ${getWeatherLabel(memoWeather)}`] : []),
    `感情パラメータ: ${memoEmotionLevel}`,
    `感情の内訳:`,
    ...EMOTION_AXES.map(({ key, label }) => `・${label}: ${memoEmotionProfile[key]}/4`),
    `2. 今日の出来事`,
    `出来事: ${memoTodayEvent}`,
    `なぜその感情が強かったのか: ${memoEmotionReason}`,
    `ポジティブ変換: ${memoEmotionPositive}`,
    `3. 今日できたこと`,
    `自由記述: ${memoAchievementNotes}`,
    `4. 明日やりたいこと`,
    memoTomorrowGoal,
    `5. 明日楽しみなこと`,
    memoTomorrowFun,
  ].join("\n");

  if (titleInput instanceof HTMLInputElement) {
    titleInput.value = memoTomorrowGoal;
  }

  if (bodyInput instanceof HTMLTextAreaElement) {
    bodyInput.value = body;
  }

  return {
    title: memoTomorrowGoal,
    body,
    memoDate,
    memoWeekday,
    memoWeather,
    memoEmotionLevel,
    memoEmotionProfile,
    memoEmotionProfileTouched,
    memoTodayEvent,
    memoEmotionReason,
    memoEmotionPositive,
    memoAchievementNotes,
    memoTomorrowGoal,
    memoTomorrowFun,
  };
}

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "draft-form") {
    return;
  }

  // デフォルトの送信挙動を防ぐ場合は入れておく
  event.preventDefault();

  const draft = buildMemoDraftFromForm();

  try {
    await saveDraftTolettersJson(draft);
    
    // ★ここを追加：保存成功したらホーム画面に戻る
    if (typeof showView === "function") {
      showView("home", { updateHash: true });
    } else {
      //もし showView 関数が使えない環境なら、強制的にページをリロードやホームへ移動させる代わりの処理
      window.location.hash = "#home";
      window.location.reload();
    }

  } catch (error) {
    console.error(error);
    alert("保存に失敗しました。");
  }
});
function renderSendView() {
  const draft = loadDraft();
  if (!draft.body) {
    showView("write", { updateHash: true });
    return;
  }

  const draftSummary = document.getElementById("send-draft-summary");
  const scheduleSummary = document.getElementById("send-summary");
  const sendButton = document.getElementById("send-letter-btn");
  const sendMessage = document.getElementById("send-message");

  renderDraftSummary(draftSummary, draft);
  renderScheduleSummary(scheduleSummary, draft);

  const sentToday = hasSentletterToday();
  if (sendButton) {
    sendButton.disabled = sentToday;
  }
  if (sendMessage) {
    sendMessage.textContent = sentToday ? "今日はすでに日記を書いています。" : "";
  }
}
