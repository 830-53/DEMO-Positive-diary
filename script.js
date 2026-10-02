const STORAGE_KEY = "future-letters.v1";
const VIEW_NAMES = ["home", "write", "schedule", "send", "inbox", "reply", "settings", "delete-account", "terms", "privacy"];
const HISTORY_START_YEAR = 2026;
const HISTORY_START_MONTH = 3;
const DECISION_BUTTON_SOUND_SELECTOR = "button, a, select, .calendar-letter-card";
const BGM_VOLUME = 0.216;
const EFFECT_SOUND_VOLUME = 0.7;
const DECISION_BUTTON_SOUND_FILE = "";
const BGM_SOUND_FILE = "";
const CURSOR_MOVE_SOUND_FILE = "";
const DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
const CURRENT_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

const appState = {
  activeView: "home",
  suppressNextHashChange: false,
  inboxMonthKey: "",
  serverAvailable: false,
};

let decisionButtonAudio = null;
let cursorMoveAudio = null;
let bgmAudio = null;

function prepareDecisionButtonAudio() {
  if (!DECISION_BUTTON_SOUND_FILE) {
    decisionButtonAudio = null;
    return;
  }

  decisionButtonAudio = new Audio(DECISION_BUTTON_SOUND_FILE);
  decisionButtonAudio.preload = "auto";
  decisionButtonAudio.volume = EFFECT_SOUND_VOLUME;
  decisionButtonAudio.load();
}

function prepareBgmAudio() {
  if (!BGM_SOUND_FILE) {
    bgmAudio = null;
    return;
  }

  if (bgmAudio) {
    return;
  }

  bgmAudio = new Audio(BGM_SOUND_FILE);
  bgmAudio.loop = true;
  bgmAudio.preload = "auto";
  bgmAudio.volume = BGM_VOLUME;
  bgmAudio.load();
}

function playBgmAudio() {
  if (!bgmAudio) {
    prepareBgmAudio();
  }

  if (!bgmAudio || !bgmAudio.paused) {
    return;
  }

  const playPromise = bgmAudio.play();
  if (!playPromise || typeof playPromise.catch !== "function") {
    return;
  }

  playPromise.catch(() => {
    // Autoplay can be blocked until the user taps the page.
  });
}

function playDecisionButtonMedia() {
  if (!decisionButtonAudio) {
    prepareDecisionButtonAudio();
  }

  if (!decisionButtonAudio) {
    return;
  }

  decisionButtonAudio.currentTime = 0;

  const playPromise = decisionButtonAudio.play();
  if (!playPromise || typeof playPromise.catch !== "function") {
    return;
  }

  playPromise.catch(() => {
    const oneShot = new Audio(DECISION_BUTTON_SOUND_FILE);
    oneShot.play().catch(() => {});
  });
}

function prepareCursorMoveAudio() {
  if (!CURSOR_MOVE_SOUND_FILE) {
    cursorMoveAudio = null;
    return;
  }

  cursorMoveAudio = new Audio(CURSOR_MOVE_SOUND_FILE);
  cursorMoveAudio.preload = "auto";
  cursorMoveAudio.volume = EFFECT_SOUND_VOLUME;
  cursorMoveAudio.load();
}

function playCursorMoveMedia() {
  if (!cursorMoveAudio) {
    prepareCursorMoveAudio();
  }

  if (!cursorMoveAudio) {
    return;
  }

  cursorMoveAudio.currentTime = 0;

  const playPromise = cursorMoveAudio.play();
  if (!playPromise || typeof playPromise.catch !== "function") {
    return;
  }

  playPromise.catch(() => {
    const oneShot = new Audio(CURSOR_MOVE_SOUND_FILE);
    oneShot.play().catch(() => {});
  });
}

function shouldPlayDecisionButtonSound(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  const interactiveTarget = target.closest(DECISION_BUTTON_SOUND_SELECTOR);
  if (!interactiveTarget) {
    return false;
  }

  if (interactiveTarget instanceof HTMLButtonElement || interactiveTarget instanceof HTMLSelectElement) {
    return !interactiveTarget.disabled;
  }

  if (interactiveTarget instanceof HTMLAnchorElement) {
    return interactiveTarget.getAttribute("href") !== "";
  }

  return true;
}

function shouldPlayCursorMoveSound(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  const interactiveTarget = target.closest("button, a, select, .calendar-letter-card");
  if (!(interactiveTarget instanceof HTMLElement)) {
    return false;
  }

  const isBackNavigation =
    interactiveTarget.classList.contains("nav-button") ||
    interactiveTarget.dataset.navTarget === "home" ||
    interactiveTarget.textContent?.includes("閉じる");
  if (!isBackNavigation) {
    return false;
  }

  const label = (interactiveTarget.textContent || "").replace(/\s+/g, "").trim();
  return label.includes("ホームへ戻る") || label.includes("前の画面へ") || label.includes("閉じる") || interactiveTarget.dataset.navTarget === "home";
}

function toLocalDateTimeValue(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

function formatDateOnly(isoString) {
  return DATE_FORMATTER.format(new Date(isoString));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============ Server API Utilities ============

async function serverSaveletters(letters) {
  try {
    const firebaseStore = window.firebaseLetterStore;
    if (firebaseStore?.saveLettersToFirebase) {
      await firebaseStore.saveLettersToFirebase(letters);
      return true;
    }
  } catch (error) {
    console.error("Firebase save failed:", error);
  }
  return false;
}

// ============ Storage Functions (with Server Support) ============

function loadletters() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveletters(letters) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
  // Sync to server asynchronously
  if (appState.serverAvailable) {
    serverSaveletters(letters).catch(() => {});
  }
}

const EMOTION_PROFILE_KEYS = [
  "happy",
  "excited",
  "fun",
  "irritated",
  "anxious",
  "regret",
  "sad",
  "other",
];

function createEmotionProfile() {
  return EMOTION_PROFILE_KEYS.reduce((profile, key) => {
    profile[key] = 0;
    return profile;
  }, {});
}

function normalizeEmotionProfile(profile) {
  const nextProfile = createEmotionProfile();

  if (!profile || typeof profile !== "object") {
    return nextProfile;
  }

  EMOTION_PROFILE_KEYS.forEach((key) => {
    const level = Number(profile[key]);
    nextProfile[key] = Number.isFinite(level) ? Math.max(0, Math.min(4, Math.round(level))) : 0;
  });

  return nextProfile;
}

function readEmotionProfile(value) {
  if (typeof value === "string") {
    try {
      return normalizeEmotionProfile(JSON.parse(value));
    } catch {
      return createEmotionProfile();
    }
  }

  return normalizeEmotionProfile(value);
}

function normalizeDraft(draft) {
  if (!draft || typeof draft !== "object") {
    return {
      title: "",
      body: "",
      memoDate: "",
      memoWeekday: "",
      memoWeather: "",
      memoEmotionLevel: "3",
      memoTodayEvent: "",
      memoEmotionReason: "",
      memoEmotionPositive: "",
      memoAchievementNotes: "",
      memoTomorrowGoal: "",
      memoTomorrowFun: "",
      memoEmotionProfileTouched: false,
      deliveryMode: "fixed",
      deliveryRandomRange: "fiscalYear",
      deliverySeason: "",
      deliveryAt: "",
    };
  }

  const memoWeather = ["sunny", "cloudy", "rainy", "snowy", "typhoon"].includes(draft.memoWeather)
    ? draft.memoWeather
    : "";
  const memoEmotionLevelRaw = Number(draft.memoEmotionLevel);
  const memoEmotionLevel = Number.isFinite(memoEmotionLevelRaw) && memoEmotionLevelRaw >= 1 && memoEmotionLevelRaw <= 5
    ? String(memoEmotionLevelRaw * 20)
    : [100, 90, 80, 70, 60, 50, 40, 30, 20].includes(memoEmotionLevelRaw)
      ? String(memoEmotionLevelRaw)
      : "60";
  return {
    title: typeof draft.title === "string" ? draft.title : "",
    body: typeof draft.body === "string" ? draft.body : "",
    memoDate: typeof draft.memoDate === "string" ? draft.memoDate : "",
    memoWeekday: typeof draft.memoWeekday === "string" ? draft.memoWeekday : "",
    memoWeather,
    memoEmotionLevel,
    ...(Object.prototype.hasOwnProperty.call(draft, "memoEmotionProfile") ? { memoEmotionProfile: readEmotionProfile(draft.memoEmotionProfile) } : {}),
    memoEmotionProfileTouched: Boolean(draft.memoEmotionProfileTouched),
    memoTodayEvent: typeof draft.memoTodayEvent === "string" ? draft.memoTodayEvent : "",
    memoEmotionReason: typeof draft.memoEmotionReason === "string" ? draft.memoEmotionReason : "",
    memoEmotionPositive: typeof draft.memoEmotionPositive === "string" ? draft.memoEmotionPositive : "",
    memoAchievementNotes: typeof draft.memoAchievementNotes === "string" ? draft.memoAchievementNotes : "",
    memoTomorrowGoal: typeof draft.memoTomorrowGoal === "string" ? draft.memoTomorrowGoal : "",
    memoTomorrowFun: typeof draft.memoTomorrowFun === "string" ? draft.memoTomorrowFun : "",
    deliveryMode: draft.deliveryMode === "random" ? "random" : "fixed",
    deliveryRandomRange: draft.deliveryRandomRange === "tenYears" ? "tenYears" : "fiscalYear",
    deliverySeason: ["spring", "summer", "autumn", "winter"].includes(draft.deliverySeason)
      ? draft.deliverySeason
      : "",
    deliveryAt: typeof draft.deliveryAt === "string" ? draft.deliveryAt : "",
  };
}

let draftState = normalizeDraft({});

function loadDraft() {
  draftState = normalizeDraft(draftState);
  return { ...draftState };
}

function saveDraft(partialDraft) {
  draftState = normalizeDraft({
    ...draftState,
    ...partialDraft,
  });
  return { ...draftState };
}

function clearDraft() {
  draftState = normalizeDraft({});
}

// ============ Server Initialization ============

async function initializeServerStorage() {
  appState.serverAvailable = Boolean(window.firebaseLetterStore);

  if (!appState.serverAvailable) {
    console.log("Firebase storage is not ready yet.");
    return;
  }

  try {
    const firebaseStore = window.firebaseLetterStore;
    const remoteLettersPromise = firebaseStore?.fetchLettersFromFirebase
      ? firebaseStore.fetchLettersFromFirebase().catch(() => [])
      : Promise.resolve([]);

    const [remoteLetters] = await Promise.all([
      remoteLettersPromise,
    ]);

    if (Array.isArray(remoteLetters)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteLetters));
    }

    console.log("Firebase storage is ready!");
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

function getFiscalYearRange(now) {
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const start = new Date(year, 3, 1, 0, 0, 0, 0);
  const end = new Date(year + 1, 3, 1, 0, 0, 0, 0);
  end.setMilliseconds(-1);
  return { start, end };
}

function getTenYearRange(now) {
  const start = new Date(now);
  const end = new Date(now);
  end.setFullYear(end.getFullYear() + 10);
  return { start, end };
}

function getSeasonRangeForYear(season, year) {
  const startOfMonth = (month) => new Date(year, month, 1, 0, 0, 0, 0);
  const endOfMonth = (month) => {
    const end = new Date(year, month + 1, 1, 0, 0, 0, 0);
    end.setMilliseconds(-1);
    return end;
  };

  switch (season) {
    case "spring":
      return [startOfMonth(2), endOfMonth(4)];
    case "summer":
      return [startOfMonth(5), endOfMonth(7)];
    case "autumn":
      return [startOfMonth(8), endOfMonth(10)];
    case "winter": {
      const start = new Date(year, 11, 1, 0, 0, 0, 0);
      const end = new Date(year + 1, 2, 1, 0, 0, 0, 0);
      end.setMilliseconds(-1);
      return [start, end];
    }
    default:
      return null;
  }
}

function getSeasonRangesWithin(season, overallStart, overallEnd) {
  const ranges = [];

  for (let year = overallStart.getFullYear() - 1; year <= overallEnd.getFullYear() + 1; year += 1) {
    const seasonRange = getSeasonRangeForYear(season, year);
    if (!seasonRange) {
      continue;
    }

    const [seasonStart, seasonEnd] = seasonRange;
    const startTime = Math.max(overallStart.getTime(), seasonStart.getTime());
    const endTime = Math.min(overallEnd.getTime(), seasonEnd.getTime());

    if (startTime <= endTime) {
      ranges.push([new Date(startTime), new Date(endTime)]);
    }
  }

  return ranges;
}

function getNextSeasonRangeAfter(season, afterDate) {
  const baseYear = afterDate.getFullYear();

  for (let year = baseYear - 1; year <= baseYear + 3; year += 1) {
    const seasonRange = getSeasonRangeForYear(season, year);
    if (!seasonRange) {
      continue;
    }

    const [seasonStart, seasonEnd] = seasonRange;
    if (seasonStart.getTime() > afterDate.getTime()) {
      return [seasonStart, seasonEnd];
    }
  }

  return null;
}

function getRandomDate(start, end) {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const randomTime = startTime + Math.floor(Math.random() * Math.max(endTime - startTime, 1));
  return new Date(randomTime);
}

function pickRandomDateFromRanges(ranges) {
  const totalDuration = ranges.reduce((sum, [start, end]) => sum + Math.max(end.getTime() - start.getTime(), 1), 0);
  let offset = Math.floor(Math.random() * totalDuration);

  for (const [start, end] of ranges) {
    const duration = Math.max(end.getTime() - start.getTime(), 1);
    if (offset < duration) {
      return getRandomDate(start, end);
    }

    offset -= duration;
  }

  return getRandomDate(ranges[0][0], ranges[0][1]);
}

function getNextDayStart(now) {
  const nextDay = new Date(now);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);
  return nextDay;
}

function createRandomDeliveryAt(randomRange, season) {
  const now = new Date();
  const minDeliveryAt = getNextDayStart(now);
  const overallRange = randomRange === "tenYears" ? getTenYearRange(now) : getFiscalYearRange(now);
  const effectiveStart = new Date(Math.max(overallRange.start.getTime(), minDeliveryAt.getTime()));

  if (effectiveStart.getTime() > overallRange.end.getTime()) {
    return toLocalDateTimeValue(minDeliveryAt);
  }

  if (season) {
    const seasonRanges = getSeasonRangesWithin(season, effectiveStart, overallRange.end);
    if (seasonRanges.length > 0) {
      return toLocalDateTimeValue(pickRandomDateFromRanges(seasonRanges));
    }

    if (randomRange === "fiscalYear") {
      const nextSeasonRange = getNextSeasonRangeAfter(season, effectiveStart);
      if (nextSeasonRange) {
        const [nextSeasonStart, nextSeasonEnd] = nextSeasonRange;
        return toLocalDateTimeValue(getRandomDate(nextSeasonStart, nextSeasonEnd));
      }
    }
  }

  return toLocalDateTimeValue(getRandomDate(effectiveStart, overallRange.end));
}

function getletterTitle(item) {
  return item.title && item.title.trim() ? item.title : "無題の記録";
}

function getMemoWeatherLabel(weather) {
  return {
    sunny: "晴れ",
    cloudy: "曇り",
    rainy: "雨",
    snowy: "雪",
    typhoon: "台風",
  }[weather] || "未選択";
}

function getMemoWeekdayLabel(dateValue) {
  if (!dateValue) {
    return "未選択";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "未選択";
  }

  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
}

function getMemoEmotionLabel(level) {
  const normalized = String(level || "");
  return normalized ? `${normalized}%` : "未選択";
}

function hasMemoDraft(draft) {
  return Boolean(
    draft.memoDate ||
      draft.memoWeekday ||
      draft.memoWeather ||
      draft.memoEmotionLevel ||
      draft.memoTodayEvent ||
      draft.memoAchievementNotes ||
      draft.memoTomorrowGoal,
  );
}

function getSenderLabel(item) {
  return `${formatDateOnly(item.createdAt)} の私より`;
}


function getScheduleLabel(draft) {
  if (draft.deliveryMode === "random") {
    const rangeLabel = draft.deliveryRandomRange === "tenYears" ? "10年間" : "一年間";
    const seasonLabel = {
      spring: "春",
      summer: "夏",
      autumn: "秋",
      winter: "冬",
    }[draft.deliverySeason] || "指定なし";

    return `ランダム配達（${rangeLabel}・${seasonLabel}）`;
  }

  return "日時を指定して配達";
}

function renderDraftSummary(container, draft) {
  if (!container) {
    return;
  }

  if (hasMemoDraft(draft)) {
    const weatherLine = draft.memoWeather ? `<p class="summary-value">天気: ${escapeHtml(getMemoWeatherLabel(draft.memoWeather))}</p>` : "";

    container.innerHTML = `
      <div class="summary-card">
        <p class="summary-label">1. 日付・曜日・天気</p>
        <p class="summary-value">日付: ${escapeHtml(draft.memoDate || "未選択")}</p>
        <p class="summary-value">曜日: ${escapeHtml(draft.memoWeekday || getMemoWeekdayLabel(draft.memoDate))}</p>
        ${weatherLine}
        <p class="summary-value">感情パラメータ: ${escapeHtml(getMemoEmotionLabel(draft.memoEmotionLevel))}</p>
      </div>
      <div class="summary-card">
        <p class="summary-label">2. 今日の出来事</p>
        <p class="summary-value summary-body">${escapeHtml(draft.memoTodayEvent || "")}</p>
      </div>
      <div class="summary-card">
        <p class="summary-label">3. 今日できたこと</p>
        <p class="summary-value summary-body">${escapeHtml(draft.memoAchievementNotes || "")}</p>
      </div>
      <div class="summary-card">
        <p class="summary-label">4. 明日やりたいこと</p>
        <p class="summary-value summary-body">${escapeHtml(draft.memoTomorrowGoal || "")}</p>
      </div>
      <div class="summary-card">
        <p class="summary-label">5. 明日楽しみなこと</p>
        <p class="summary-value summary-body">${escapeHtml(draft.memoTomorrowFun || "")}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="summary-card">
      <p class="summary-label">件名</p>
      <p class="summary-value">${escapeHtml(getletterTitle(draft))}</p>
    </div>
    <div class="summary-card">
      <p class="summary-label">本文</p>
      <p class="summary-value summary-body">${escapeHtml(draft.body || "")}</p>
    </div>
  `;
}

function renderScheduleSummary(container, draft) {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="summary-card">
      <p class="summary-label">配達方法</p>
      <p class="summary-value">${escapeHtml(getScheduleLabel(draft))}</p>
    </div>
  `;
}

function getLocalDateKey(dateLike) {
  const date = new Date(dateLike);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hasSentletterToday() {
  const todayKey = getLocalDateKey(new Date());
  return loadletters().some((letter) => getLocalDateKey(letter.createdAt) === todayKey);
}

function getletterState(item, now) {
  return "delivered";
}

function markletterAsRead(letterId) {
  const nextletters = loadletters().map((letter) => {
    if (letter.id !== letterId || letter.readAt) {
      return letter;
    }

    return {
      ...letter,
      readAt: new Date().toISOString(),
    };
  });

  saveletters(nextletters);
}

function openletterDialog(item, dialogElements) {
  if (!dialogElements) {
    return;
  }

  dialogElements.meta.textContent = getSenderLabel(item);
  dialogElements.title.textContent = getletterTitle(item);
  dialogElements.body.textContent = item.body || "";
  // (Dialog-level reply button removed; dialog-scoped FAB is used instead.)

  dialogElements.dialog.showModal();
  // Add a small floating reply button inside the dialog so it is clickable while modal
  ensureDialogFab(dialogElements.dialog, item.id);
}

function openDeliveredletterById(letterId) {
  const dialogElements = window.__inboxDialogElements;
  if (!dialogElements) {
    return;
  }

  const letter = loadletters().find((item) => item.id === letterId);
  if (!letter) {
    return;
  }

  openletterDialog(letter, dialogElements);
}

function formatMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthKey(monthKey) {
  const matched = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!matched) {
    return null;
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
    return null;
  }

  return new Date(year, month, 1);
}

function createHistoryMonthKeys(endDate) {
  const keys = [];
  const current = new Date(HISTORY_START_YEAR, HISTORY_START_MONTH, 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current.getTime() <= end.getTime()) {
    keys.push(monthKeyFromDate(current));
    current.setMonth(current.getMonth() + 1);
  }

  return keys;
}

function resolveInitialInboxMonthKey(delivered, monthKeys) {
  if (appState.inboxMonthKey && monthKeys.includes(appState.inboxMonthKey)) {
    return appState.inboxMonthKey;
  }

  if (delivered.length > 0) {
    const lastDelivered = delivered[delivered.length - 1];
    const lastKey = monthKeyFromDate(new Date(lastDelivered.createdAt));
    if (monthKeys.includes(lastKey)) {
      return lastKey;
    }
  }

  return monthKeys[monthKeys.length - 1];
}

function populateHistoryMonthSelect(monthKeys, selectedKey) {
  const monthSelect = document.getElementById("history-month");
  if (!monthSelect) {
    return;
  }

  monthSelect.innerHTML = "";

  monthKeys.forEach((monthKey) => {
    const monthDate = parseMonthKey(monthKey);
    if (!monthDate) {
      return;
    }

    const option = document.createElement("option");
    option.value = monthKey;
    option.textContent = formatMonthLabel(monthDate);
    monthSelect.appendChild(option);
  });

  monthSelect.value = selectedKey;
}

function buildCalendarletterCard(item, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `calendar-letter-card${item.readAt ? "" : " unread"}`;

  button.innerHTML = `
    ${item.readAt ? "" : '<span class="unread-dot" aria-hidden="true"></span>'}
    <p class="calendar-letter-meta">${escapeHtml(getSenderLabel(item))}</p>
    <p class="calendar-letter-title">${escapeHtml(getletterTitle(item))}</p>
  `;

  button.addEventListener("click", () => {
    openletterDialog(item, options.dialogElements);
    if (!item.readAt) {
      markletterAsRead(item.id);
      options.onChange?.();
    }
  });

  return button;
}

function renderCalendarHistory(delivered, options) {
  const container = options.calendarContainer;
  if (!container) {
    return;
  }

  container.innerHTML = "";

  const monthMap = new Map();

  if (options.forceMonthDate) {
    const forcedKey = monthKeyFromDate(options.forceMonthDate);
    monthMap.set(forcedKey, {
      label: formatMonthLabel(options.forceMonthDate),
      monthDate: new Date(options.forceMonthDate.getFullYear(), options.forceMonthDate.getMonth(), 1),
      byDay: new Map(),
    });
  }

  delivered.forEach((item) => {
    const createdDate = new Date(item.createdAt);
    const monthKey = formatMonthKey(createdDate);

    if (options.forceMonthDate && monthKey !== monthKeyFromDate(options.forceMonthDate)) {
      return;
    }

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        label: formatMonthLabel(createdDate),
        monthDate: new Date(createdDate.getFullYear(), createdDate.getMonth(), 1),
        byDay: new Map(),
      });
    }

    const month = monthMap.get(monthKey);
    const dayKey = getDateKey(createdDate);

    if (!month.byDay.has(dayKey)) {
      month.byDay.set(dayKey, []);
    }

    month.byDay.get(dayKey).push(item);
  });

  const months = [...monthMap.values()].sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());

  if (months.length === 0) {
    const empty = document.createElement("p");
    empty.className = "calendar-empty";
    empty.textContent = "まだ届いている記録はありません。";
    container.appendChild(empty);
    return;
  }

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  months.forEach((month) => {
    const block = document.createElement("section");
    block.className = "month-block";

    const title = document.createElement("h3");
    title.className = "month-title";
    title.textContent = month.label;
    block.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    weekdays.forEach((weekday) => {
      const weekdayCell = document.createElement("div");
      weekdayCell.className = "calendar-weekday";
      weekdayCell.textContent = weekday;
      grid.appendChild(weekdayCell);
    });

    const firstDay = new Date(month.monthDate.getFullYear(), month.monthDate.getMonth(), 1);
    const lastDay = new Date(month.monthDate.getFullYear(), month.monthDate.getMonth() + 1, 0);

    for (let i = 0; i < firstDay.getDay(); i += 1) {
      const blank = document.createElement("div");
      blank.className = "calendar-cell empty";
      grid.appendChild(blank);
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const cellDate = new Date(month.monthDate.getFullYear(), month.monthDate.getMonth(), day);
      const cellKey = getDateKey(cellDate);
      const dayletters = month.byDay.get(cellKey) || [];
      const hasWrittenletter = options.writtenDateKeys?.has(cellKey) || false;

      const cell = document.createElement("div");
      cell.className = hasWrittenletter ? "calendar-cell has-written-day" : "calendar-cell";

      const dayNum = document.createElement("p");
      dayNum.className = "calendar-day-number";
      dayNum.textContent = String(day);
      cell.appendChild(dayNum);

      // Check if any letter on this day has a reply
      const hasReply = dayletters.some((item) => Array.isArray(item.replies) && item.replies.length > 0);
      if (hasReply) {
        const replyBadge = document.createElement("span");
        replyBadge.className = "calendar-reply-badge";
        replyBadge.textContent = "OK";
        cell.appendChild(replyBadge);
      }

      const cards = document.createElement("div");
      cards.className = "calendar-cards";

      dayletters.forEach((item) => {
        cards.appendChild(
          buildCalendarletterCard(item, {
            dialogElements: options.dialogElements,
            onChange: options.onChange,
          })
        );
      });

      cell.appendChild(cards);
      grid.appendChild(cell);
    }

    block.appendChild(grid);
    container.appendChild(block);
  });
}

function enqueueArrivalMessages(messages, noticeElement) {
  if (!noticeElement || messages.length === 0) {
    return;
  }

  window.__arrivalQueue = window.__arrivalQueue || [];
  window.__arrivalQueue.push(...messages);

  if (!window.__arrivalPlaying) {
    playArrivalQueue(noticeElement);
  }
}

function playArrivalQueue(noticeElement) {
  if (!window.__arrivalQueue || window.__arrivalQueue.length === 0) {
    noticeElement.innerHTML = "";
    noticeElement.hidden = true;
    noticeElement.classList.remove("is-visible");
    window.__arrivalPlaying = false;
    return;
  }

  window.__arrivalPlaying = true;
  const nextMessage = window.__arrivalQueue.shift();

  renderArrivalNotice(noticeElement, nextMessage);
  noticeElement.hidden = false;
  noticeElement.classList.add("is-visible");

  window.setTimeout(() => {
    noticeElement.classList.remove("is-visible");
    window.setTimeout(() => playArrivalQueue(noticeElement), 260);
  }, 2400);
}

function renderArrivalNotice(noticeElement, arrivalItem) {
  noticeElement.innerHTML = "";

  const content = document.createElement("div");
  content.className = "arrival-notice-content";

  const text = document.createElement("p");
  text.className = "arrival-notice-text";
  text.textContent = arrivalItem.text;

  const actions = document.createElement("div");
  actions.className = "arrival-notice-actions";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "arrival-notice-button btn-secondary";
  button.textContent = "日記を読む";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeliveredletterById(arrivalItem.letterId);
  });

  actions.appendChild(button);
  content.appendChild(text);
  content.appendChild(actions);
  noticeElement.appendChild(content);
}

function renderInboxView() {
  const calendarContainer = document.getElementById("calendar-months");
  const nowTime = document.getElementById("now-time");
  const arrivalNotice = document.getElementById("arrival-notice");
  const dialog = document.getElementById("letter-dialog");
  const dialogTitle = document.getElementById("dialog-title");
  const dialogBody = document.getElementById("dialog-body");
  const dialogMeta = document.getElementById("dialog-meta");

  if (!calendarContainer || !dialog || !dialogTitle || !dialogBody || !dialogMeta) {
    return;
  }

  const letters = loadletters()
    .map((item) => ({
      ...item,
      readAt: item.readAt || null,
      notifiedAt: item.notifiedAt || null,
    }))
    .sort((a, b) => new Date(a.deliveryAt).getTime() - new Date(b.deliveryAt).getTime());

  const updatedletters = [];
  const arrivalMessages = [];

  letters.forEach((item) => {
    const state = getletterState(item, Date.now());

    if (state === "delivered" && !item.notifiedAt) {
      arrivalMessages.push({
        text: getArrivalNoticeText(item),
        letterId: item.id,
      });
    }

    updatedletters.push(item);
  });

  if (arrivalMessages.length > 0) {
    saveletters(updatedletters);
    enqueueArrivalMessages(arrivalMessages, arrivalNotice);
  }

  const delivered = updatedletters
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const writtenDateKeys = new Set(
    updatedletters.map((item) => getDateKey(new Date(item.createdAt)))
  );

  const historyMonthKeys = createHistoryMonthKeys(new Date());
  const selectedMonthKey = resolveInitialInboxMonthKey(delivered, historyMonthKeys);
  const selectedMonthDate = parseMonthKey(selectedMonthKey) || new Date();
  appState.inboxMonthKey = selectedMonthKey;

  populateHistoryMonthSelect(historyMonthKeys, selectedMonthKey);

  const deliveredInSelectedMonth = delivered.filter((item) => {
    return monthKeyFromDate(new Date(item.createdAt)) === selectedMonthKey;
  });

  if (nowTime) {
    nowTime.textContent = CURRENT_TIME_FORMATTER.format(new Date());
  }

  const dialogElements = {
    dialog,
    title: dialogTitle,
    body: dialogBody,
    meta: dialogMeta,
  };

  window.__inboxDialogElements = dialogElements;

  renderCalendarHistory(deliveredInSelectedMonth, {
    calendarContainer,
    dialogElements,
    forceMonthDate: selectedMonthDate,
    writtenDateKeys,
    onChange: () => renderInboxView(),
  });
}

function updateCurrentTime() {
  const nowTime = document.getElementById("now-time");
  if (nowTime && appState.activeView === "inbox") {
    nowTime.textContent = CURRENT_TIME_FORMATTER.format(new Date());
  }
}

function renderWriteView() {
  const titleInput = document.getElementById("letter-title");
  const bodyInput = document.getElementById("letter-body");
  const draft = loadDraft();

  if (titleInput) {
    titleInput.value = draft.title || "";
  }

  if (bodyInput) {
    bodyInput.value = draft.body || "";
  }
}

function renderScheduleView() {
  const draft = loadDraft();
  if (!draft.body && !hasMemoDraft(draft)) {
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

// ============ Reply Functionality ============

function ensureReplyOriginalTextDialog() {
  let dialog = document.getElementById("reply-original-text-dialog");
  if (dialog) {
    return dialog;
  }

  dialog = document.createElement("dialog");
  dialog.id = "reply-original-text-dialog";
  dialog.innerHTML = `
    <div class="reply-original-text-paper">
      <h3 id="reply-original-text-title"></h3>
      <p id="reply-original-text-content"></p>
      <form method="dialog">
        <button class="btn-secondary" type="submit">閉じる</button>
      </form>
    </div>
  `;
  document.body.appendChild(dialog);
  return dialog;
}

function showReplyOriginalText(title, value) {
  const dialog = ensureReplyOriginalTextDialog();
  dialog.querySelector("#reply-original-text-title").textContent = title;
  dialog.querySelector("#reply-original-text-content").textContent = value;
  dialog.showModal();
}

function getReplyOriginalPreview(value) {
  const text = String(value || "未入力");
  return text.length > 20 ? `${Array.from(text).slice(0, 20).join("")}…` : text;
}

function renderReplyOriginal(container, letter) {
  const date = letter?.memoDate || String(letter?.body || "").match(/日付:\s*(\d{4}-\d{2}-\d{2})/)?.[1] || "未入力";
  const weekday = letter?.memoWeekday || (typeof getWeekdayLabel === "function" ? getWeekdayLabel(date) : "");
  const weather = typeof getWeatherLabel === "function" ? getWeatherLabel(letter?.memoWeather) : "未入力";
  const axes = typeof EMOTION_AXES !== "undefined" ? EMOTION_AXES : [];
  const profile = typeof normalizeEmotionProfile === "function"
    ? normalizeEmotionProfile(letter?.memoEmotionProfile)
    : {};
  if (!letter?.memoEmotionProfile) {
    const body = String(letter?.body || "");
    const labels = typeof EMOTION_AXES !== "undefined" ? EMOTION_AXES : [];
    labels.forEach(({ key, label }) => {
      const matched = body.match(new RegExp(`・${label}[:：]\\s*(\\d+)\\s*/\\s*4`));
      if (matched) {
        profile[key] = Number(matched[1]);
      }
    });
  }
  const center = 100;
  const radius = 66;
  const pointFor = (value, index, scale = radius) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * index / Math.max(axes.length, 1);
    const length = scale * Math.max(0, Math.min(4, value)) / 4;
    return `${(center + Math.cos(angle) * length).toFixed(1)},${(center + Math.sin(angle) * length).toFixed(1)}`;
  };
  const rings = [1, 2, 3, 4].map((level) => {
    const points = axes.map((_, index) => pointFor(level, index, radius)).join(" ");
    return `<polygon points="${points}" />`;
  }).join("");
  const axisLines = axes.map((_, index) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * index / Math.max(axes.length, 1);
    return `<line x1="100" y1="100" x2="${(center + Math.cos(angle) * radius).toFixed(1)}" y2="${(center + Math.sin(angle) * radius).toFixed(1)}" />`;
  }).join("");
  const values = axes.map(({ key }) => Number(profile?.[key] || 0));
  const shapePoints = values.map((value, index) => pointFor(value, index));
  const shape = shapePoints.join(" ");
  const shapeSections = axes.map(({ color }, index) => {
    const nextIndex = (index + 1) % axes.length;
    return `<polygon class="reply-radar-section" points="100,100 ${shapePoints[index]} ${shapePoints[nextIndex]}" style="--reply-emotion-color: ${color};" />`;
  }).join("");
  const handles = axes.map(({ key, color }, index) => {
    const [x, y] = pointFor(values[index], index).split(",");
    return `<circle class="reply-radar-handle" cx="${x}" cy="${y}" r="6" fill="${color}" />`;
  }).join("");
  const labels = axes.map(({ label }, index) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * index / Math.max(axes.length, 1);
    return `<text class="emotion-trend-axis-label" x="${(center + Math.cos(angle) * 88).toFixed(1)}" y="${(center + Math.sin(angle) * 88).toFixed(1)}">${escapeHtml(label)}</text>`;
  }).join("");
  const originalTexts = {
    emotionReason: letter?.memoEmotionReason || "未入力",
    emotionPositive: letter?.memoEmotionPositive || "未入力",
    achievementNotes: letter?.memoAchievementNotes || "未入力",
    todayEvent: letter?.memoTodayEvent || "未入力",
    tomorrowGoal: letter?.memoTomorrowGoal || "未入力",
    tomorrowFun: letter?.memoTomorrowFun || "未入力",
  };
  const emotionAxes = typeof EMOTION_AXES !== "undefined" ? EMOTION_AXES : [];
  const strongestEmotion = emotionAxes.reduce((strongest, axis) => {
    const level = Number(letter?.memoEmotionProfile?.[axis.key] || 0);
    const strongestLevel = Number(strongest?.level || 0);
    return level > strongestLevel ? { axis, level } : strongest;
  }, null);
  originalTexts.strongestEmotion = strongestEmotion?.level > 0 ? strongestEmotion.axis.label : "未選択";

  container.innerHTML = `
    <div class="reply-log-header"><span>${escapeHtml(date)}</span><span>（${escapeHtml(weekday)}）</span><span class="reply-weather">天気 ${escapeHtml(weather)}</span></div>
    <div class="reply-log-emotion">
      <svg class="reply-radar" viewBox="0 0 200 200" role="img" aria-label="その日の感情チャート"><g class="reply-radar-rings">${rings}</g><g class="reply-radar-axis">${axisLines}</g><g class="reply-radar-sections">${shapeSections}</g><polygon class="reply-radar-shape" points="${shape}" />${handles}${labels}</svg>
      <div class="reply-log-prompts"><div class="reply-log-bubble"><span>この中で一番強かった感情は（${escapeHtml(originalTexts.strongestEmotion)}）</span></div><div class="reply-log-bubble"><span>どうしてその感情が強かったのか</span><button class="reply-original-preview" type="button" data-original-key="emotionReason">${escapeHtml(getReplyOriginalPreview(originalTexts.emotionReason))}</button></div></div>
    </div>
    <div class="reply-log-paired"><div class="reply-log-box"><h4>ネガティブだったら…</h4><button class="reply-original-preview" type="button" data-original-key="emotionPositive">${escapeHtml(getReplyOriginalPreview(originalTexts.emotionPositive))}</button></div><div class="reply-log-box"><h4>良かったこと</h4><button class="reply-original-preview" type="button" data-original-key="achievementNotes">${escapeHtml(getReplyOriginalPreview(originalTexts.achievementNotes))}</button></div></div>
    <div class="reply-log-box reply-log-wide"><h4>今日の目標に対して</h4><button class="reply-original-preview" type="button" data-original-key="todayEvent">${escapeHtml(getReplyOriginalPreview(originalTexts.todayEvent))}</button></div>
    <div class="reply-log-box reply-log-wide"><h4>明日の目標</h4><button class="reply-original-preview" type="button" data-original-key="tomorrowGoal">${escapeHtml(getReplyOriginalPreview(originalTexts.tomorrowGoal))}</button></div>
    <div class="reply-log-box reply-log-wide"><h4>明日楽しみなこと</h4><button class="reply-original-preview" type="button" data-original-key="tomorrowFun">${escapeHtml(getReplyOriginalPreview(originalTexts.tomorrowFun))}</button></div>
  `;

  container.querySelectorAll(".reply-original-preview").forEach((button) => {
    const key = button.dataset.originalKey;
    button.addEventListener("click", () => showReplyOriginalText("原文", originalTexts[key] || "未入力"));
  });
}

function ensureReplyDialog() {
  let dlg = document.getElementById("reply-dialog");
  if (dlg) return dlg;

  dlg = document.createElement("dialog");
  dlg.id = "reply-dialog";

  dlg.innerHTML = `
    <div class="reply-form">
      <div class="reply-dialog-paper">
        <header class="reply-dialog-header">
          <h3>ログ</h3>
        </header>

        <section id="reply-original" class="reply-original-section"></section>
        <div class="reply-dialog-actions">
          <button id="husen-open" type="button" class="husen-open-button">付箋にメモ</button>
          <button id="reply-cancel" type="button" class="btn-secondary">閉じる</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dlg);

  const original = dlg.querySelector("#reply-original");
  const husenOpen = dlg.querySelector("#husen-open");
  const cancel = dlg.querySelector("#reply-cancel");

  let currentTargetId = null;

  function populateSelect(preselectId) {
    const letters = loadletters()
      .filter((l) => new Date(l.deliveryAt).getTime() <= Date.now())
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    currentTargetId = preselectId || (letters.length > 0 ? letters[0].id : null);
    updateOriginal();
  }


  cancel.addEventListener("click", () => dlg.close());
  husenOpen.addEventListener("click", () => openHusenDialog(currentTargetId));

  // Expose helper to populate when opening
  dlg.populateSelect = populateSelect;
  dlg.setSelected = (id) => {
    populateSelect(id);
  };

  return dlg;
}

function openReplyDialogForletter(letter) {
  const id = letter && typeof letter === "object" ? letter.id : String(letter || "");
  const letters = loadletters();
  const target = letters.find((l) => l.id === id);
  if (!target) {
    alert("対象の日記が見つかりませんでした。");
    return;
  }

  const dlg = ensureReplyDialog();
  dlg.populateSelect(id);
  dlg.showModal();
}

function openReplyDialog() {
  const dlg = ensureReplyDialog();
  dlg.populateSelect();
  dlg.showModal();
}

function saveReplyToletter(letterId, replyBody) {
  const letters = loadletters();
  const idx = letters.findIndex((l) => l.id === letterId);
  if (idx === -1) {
    alert("返信先の日記が見つかりませんでした。");
    return false;
  }
  // Enforce single reply per letter
  if (Array.isArray(letters[idx].replies) && letters[idx].replies.length > 0) {
    alert("この記録には既に返信が行われています。返信は1回までです。");
    return false;
  }

  const reply = {
    id: crypto.randomUUID(),
    body: replyBody,
    createdAt: new Date().toISOString(),
  };

  letters[idx].replies = [reply];
  saveletters(letters);

  // If on inbox, re-render to reflect any UI changes
  if (appState.activeView === "inbox") {
    renderInboxView();
  }

  return true;
}


function removeInboxFab() {
  const existing = document.getElementById("inbox-reply-fab");
  if (existing) existing.remove();
}

function ensureDialogFab(dialog, letterId) {
  if (!dialog) return null;
  removeDialogFab();

  const btn = document.createElement("button");
  btn.id = "dialog-reply-fab";
  btn.type = "button";
  btn.title = "返信する";
  btn.innerHTML = "✉️";
  btn.style.position = "absolute";
  btn.style.right = "12px";
  btn.style.bottom = "12px";
  btn.style.width = "44px";
  btn.style.height = "44px";
  btn.style.borderRadius = "22px";
  btn.style.border = "none";
  btn.style.background = "#ff8fa3";
  btn.style.color = "#fff";
  btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
  btn.style.cursor = "pointer";
  btn.style.zIndex = 2147483647;

  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    openReplyDialogForletter({ id: letterId });
  });

  // Ensure the dialog is positioned relatively so absolute works
  if (getComputedStyle(dialog).position === "static") {
    dialog.style.position = "relative";
  }

  dialog.appendChild(btn);
  return btn;
}

function removeDialogFab() {
  const existing = document.getElementById("dialog-reply-fab");
  if (existing) existing.remove();
}


function renderActiveView() {
  switch (appState.activeView) {
    case "home":
      renderHomeView();
      return;
    case "write":
      renderWriteView();
      return;
    case "schedule":
      renderScheduleView();
      return;
    case "send":
      renderSendView();
      return;
    case "inbox":
      renderInboxView();
      return;
    default:
      return;
  }
}

function getViewFromHash() {
  const rawHash = window.location.hash.replace(/^#/, "");
  return VIEW_NAMES.includes(rawHash) ? rawHash : "home";
}

function showView(viewName, options = {}) {
  const normalized = VIEW_NAMES.includes(viewName) ? viewName : "home";

  if ((normalized === "schedule" || normalized === "send") && !loadDraft().body) {
    showView("write", options);
    return;
  }

  appState.activeView = normalized;

  document.querySelectorAll(".app-view").forEach((view) => {
    const isActive = view.dataset.view === normalized;
    view.hidden = !isActive;
    view.classList.toggle("is-active", isActive);
  });

  if (options.updateHash !== false) {
    appState.suppressNextHashChange = true;
    window.location.hash = normalized === "home" ? "" : normalized;
  }

  renderActiveView();

}

function initApp() {
  prepareBgmAudio();
  prepareDecisionButtonAudio();
  playBgmAudio();

  // Initialize Firebase-backed storage and hydrate local cache before first render

  document.getElementById("delivery-mode")?.addEventListener("change", () => {
    syncScheduleVisibility();
  });

  document.getElementById("delivery-random-range")?.addEventListener("change", () => {
    syncScheduleVisibility();
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    playBgmAudio();

    const target = event.target;
    const useCursorMoveSound = shouldPlayCursorMoveSound(target);
    if (useCursorMoveSound) {
      playCursorMoveMedia();
    }

    const navTarget = target.closest("[data-nav-target]");
    if (!navTarget) {
      if (!useCursorMoveSound && shouldPlayDecisionButtonSound(target)) {
        playDecisionButtonMedia();
      }

      return;
    }

    if (!useCursorMoveSound && shouldPlayDecisionButtonSound(target)) {
      playDecisionButtonMedia();
    }

    event.preventDefault();
    showView(navTarget.dataset.navTarget || "home");
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    if (form.id === "draft-form") {
      event.preventDefault();
      const message = document.getElementById("form-message");
      const nextDraft = typeof buildMemoDraftFromForm === "function"
        ? buildMemoDraftFromForm()
        : {
            title: String(document.getElementById("letter-title")?.value || "").trim(),
            body: String(document.getElementById("letter-body")?.value || "").trim(),
          };
      const body = String(nextDraft.body || "").trim();

      if (!body) {
        if (message) message.textContent = "本文は必須です。";
        return;
      }

      saveDraft(nextDraft);
      showView("schedule");
      return;
    }

    if (form.id === "schedule-form") {
      event.preventDefault();
      const modeSelect = document.getElementById("delivery-mode");
      const randomRangeSelect = document.getElementById("delivery-random-range");
      const seasonSelect = document.getElementById("delivery-season");
      const deliveryInput = document.getElementById("delivery-at");
      const deliveryMode = String(modeSelect?.value || "fixed");
      const deliveryRandomRange = String(randomRangeSelect?.value || "fiscalYear");
      const deliverySeason = String(seasonSelect?.value || "");
      const deliveryAt = String(deliveryInput?.value || "");

      if (deliveryMode === "fixed" && !deliveryAt) {
        return;
      }

      saveDraft({
        deliveryMode,
        deliveryRandomRange: deliveryMode === "random" ? deliveryRandomRange : "fiscalYear",
        deliverySeason: deliveryMode === "random" ? deliverySeason : "",
        deliveryAt: deliveryMode === "fixed" ? deliveryAt : "",
      });

      showView("send");
    }
  });

  document.getElementById("send-letter-btn")?.addEventListener("click", async () => {
    const currentDraft = loadDraft();
    if (!currentDraft.body) {
      return;
    }

    if (hasSentletterToday()) {
      const sendMessage = document.getElementById("send-message");
      if (sendMessage) {
        sendMessage.textContent = "今日はすでに日記を書いています。";
      }
      const sendButton = document.getElementById("send-letter-btn");
      if (sendButton) {
        sendButton.disabled = true;
      }
      return;
    }

    const deliveryMode = currentDraft.deliveryMode || "fixed";
    const deliveryRandomRange = currentDraft.deliveryRandomRange || "fiscalYear";
    const deliverySeason = currentDraft.deliverySeason || "";
    const deliveryAt = deliveryMode === "random"
      ? createRandomDeliveryAt(deliveryRandomRange, deliverySeason)
      : currentDraft.deliveryAt || toLocalDateTimeValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    const sendButton = document.getElementById("send-letter-btn");
    if (sendButton) {
      sendButton.disabled = true;
    }

    if (typeof window.playDeliveryAnimation === "function") {
      await window.playDeliveryAnimation(currentDraft);
    }

    const letters = loadletters();
    letters.push({
      id: crypto.randomUUID(),
      title: currentDraft.title || "",
      body: currentDraft.body,
      deliveryAt,
      deliveryMode,
      deliveryRandomRange: deliveryMode === "random" ? deliveryRandomRange : "",
      deliverySeason: deliveryMode === "random" ? deliverySeason : "",
      createdAt: new Date().toISOString(),
      readAt: null,
      notifiedAt: null,
    });

    saveletters(letters);
    clearDraft();

    const sendMessage = document.getElementById("send-message");
    if (sendButton) {
      sendButton.disabled = true;
      sendButton.textContent = "送信しました";
    }
    if (sendMessage) {
      sendMessage.textContent = "日記を書きました。閲覧ノートへ移動します。";
    }

    window.setTimeout(() => {
      showView("inbox");
    }, 400);
  });

  document.getElementById("refresh-btn")?.addEventListener("click", () => {
    if (appState.activeView === "inbox") {
      renderInboxView();
    }
  });

  document.getElementById("history-month")?.addEventListener("change", (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    appState.inboxMonthKey = select.value;
    if (appState.activeView === "inbox") {
      renderInboxView();
    }
  });

  document.getElementById("letter-dialog")?.addEventListener("close", () => {
    removeDialogFab();
    if (appState.activeView === "inbox") {
      renderInboxView();
    }
  });

  window.addEventListener("hashchange", () => {
    if (appState.suppressNextHashChange) {
      appState.suppressNextHashChange = false;
      return;
    }

    showView(getViewFromHash(), { updateHash: false });
  });

  const boot = async () => {
    try {
      await initializeServerStorage();
      const initialView = getViewFromHash();
      showView(initialView, { updateHash: false });
    } finally {
      document.documentElement.classList.add("app-ready");
    }
  };

  void boot();

  window.setInterval(() => {
    if (appState.activeView === "inbox") {
      updateCurrentTime();
    }
    if (appState.activeView === "send") {
      renderSendView();
    }
  }, 30000);
}

document.addEventListener("DOMContentLoaded", initApp);
