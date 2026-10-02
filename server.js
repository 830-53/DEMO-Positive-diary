const LOCAL_LETTERS_KEY = "future-letters.v1";

const EMOTION_AXES = [
    { key: "happy", label: "うれしい" },
    { key: "excited", label: "ワクワク" },
    { key: "fun", label: "楽しい" },
    { key: "irritated", label: "イライラ" },
    { key: "anxious", label: "焦り・不安" },
    { key: "regret", label: "後悔" },
    { key: "sad", label: "悲しい" },
    { key: "other", label: "その他" },
];

function getFirebaseContext() {
    const db = window.db;
    const dbFunctions = window.dbFunctions || {};
    const { collection, getDocs, getDoc, doc, setDoc, increment } = dbFunctions;

    if (!db || !collection || !getDocs || !getDoc || !doc || !setDoc || !increment) {
        throw new Error("Firebaseの準備ができていません。");
    }

    return { db, collection, getDocs, getDoc, doc, setDoc, increment };
}

function createEmotionProfile() {
    return EMOTION_AXES.reduce((profile, axis) => {
        profile[axis.key] = 0;
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
        nextProfile[key] = Number.isFinite(level) ? Math.max(0, Math.min(4, Math.round(level))) : 0;
    });

    return nextProfile;
}

function getEmotionSummaryLevel(profile) {
    const strongest = EMOTION_AXES.reduce((maxLevel, { key }) => {
        const level = Number(profile?.[key] || 0);
        return Math.max(maxLevel, level);
    }, 0);

    if (strongest <= 0) {
        return 20;
    }

    return Math.min(100, 20 + strongest * 20);
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

function buildLetterRecord(draft) {
    const memoEmotionProfile = normalizeEmotionProfile(draft?.memoEmotionProfile);
    const hasEmotionProfile = Boolean(draft?.memoEmotionProfileTouched) || EMOTION_AXES.some(({ key }) => Number(memoEmotionProfile[key]) > 0);
    const memoEmotionLevel = hasEmotionProfile
        ? getEmotionSummaryLevel(memoEmotionProfile)
        : Number(draft?.memoEmotionLevel) || 60;

    const body = [
        "1. 日付・曜日・天気",
        `日付: ${draft?.memoDate || ""}`,
        `曜日: ${draft?.memoWeekday || ""}`,
        ...(draft?.memoWeather ? [`天気: ${getWeatherLabel(draft.memoWeather)}`] : []),
        `感情パラメータ: ${memoEmotionLevel}`,
        ...(hasEmotionProfile
            ? [
                    "感情の内訳:",
                    ...EMOTION_AXES.map(({ key, label }) => `・${label}: ${memoEmotionProfile[key]}/4`),
                ]
            : []),
        "2. 今日の出来事",
        `出来事: ${draft?.memoTodayEvent || ""}`,
        `なぜその感情が強かったのか: ${draft?.memoEmotionReason || ""}`,
        `ポジティブ変換: ${draft?.memoEmotionPositive || ""}`,
        "3. 今日できたこと",
        `自由記述: ${draft?.memoAchievementNotes || ""}`,
        "4. 明日やりたいこと",
        draft?.memoTomorrowGoal || "",
        "5. 明日楽しみなこと",
        draft?.memoTomorrowFun || "",
    ].join("\n");

    return {
        id: crypto.randomUUID(),
        title: String(draft?.title || ""),
        body,
        memoDate: String(draft?.memoDate || ""),
        memoWeekday: String(draft?.memoWeekday || ""),
        memoWeather: String(draft?.memoWeather || ""),
        memoEmotionLevel: String(memoEmotionLevel),
        ...(hasEmotionProfile ? { memoEmotionProfile } : {}),
        memoEmotionProfileTouched: Boolean(draft?.memoEmotionProfileTouched),
        memoTodayEvent: String(draft?.memoTodayEvent || ""),
        memoEmotionReason: String(draft?.memoEmotionReason || ""),
        memoEmotionPositive: String(draft?.memoEmotionPositive || ""),
        memoAchievementNotes: String(draft?.memoAchievementNotes || ""),
        memoTomorrowGoal: String(draft?.memoTomorrowGoal || ""),
        memoTomorrowFun: String(draft?.memoTomorrowFun || ""),
        createdAt: new Date().toISOString(),
        deliveryAt: String(draft?.deliveryAt || ""),
        readAt: null,
        notifiedAt: null,
    };
}

function getMonthKeyFromDraft(draft) {
    const memoDate = String(draft?.memoDate || "");
    const matched = /^(\d{4})-(\d{2})-\d{2}$/.exec(memoDate);
    return matched ? `${matched[1]}-${matched[2]}` : null;
}

async function saveMonthlyEmotionSummary(draft) {
    const monthKey = getMonthKeyFromDraft(draft);
    const currentUid = window.currentUserUid || (window.firebaseAuth?.currentUser?.uid);
    if (!monthKey || !currentUid) {
        return null;
    }

    const { db, doc, setDoc, increment } = getFirebaseContext();
    const profile = normalizeEmotionProfile(draft?.memoEmotionProfile);
    const emotionTotals = EMOTION_AXES.reduce((totals, { key }) => {
        totals[key] = increment(profile[key]);
        return totals;
    }, {});

    const summary = {
        monthKey,
        entryCount: increment(1),
        emotionTotals,
        updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "users", currentUid, "month", monthKey), summary, { merge: true });
    return summary;
}

async function fetchMonthlyEmotionSummary(monthKey) {
    const currentUid = window.currentUserUid || (window.firebaseAuth?.currentUser?.uid);
    if (!currentUid || !/^\d{4}-\d{2}$/.test(String(monthKey || ""))) {
        return null;
    }

    const { db, doc, getDoc } = getFirebaseContext();
    const snapshot = await getDoc(doc(db, "users", currentUid, "month", monthKey));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

function buildDraftSnapshot(draft) {
    const nextDraft = typeof window.normalizeDraft === "function"
        ? window.normalizeDraft(draft)
        : { ...(draft || {}) };

    return {
        ...nextDraft,
        updatedAt: new Date().toISOString(),
    };
}

async function saveLetterToFirebase(draft) {
    const security = window.siteSecurity;
    const validation = security?.validateDraft(draft);
    if (validation && !validation.valid) {
        throw new Error(validation.errors[0]);
    }

    const { db, collection, doc, setDoc } = getFirebaseContext();
    const record = buildLetterRecord(draft);
    const currentUid = window.currentUserUid || (window.firebaseAuth?.currentUser?.uid);
    const path = currentUid
        ? ["users", currentUid, "letters", record.id]
        : ["letters", record.id];
    await setDoc(doc(db, ...path), record);
    await saveMonthlyEmotionSummary(draft);
    return record;
}

async function saveLettersToFirebase(letters) {
    const { db, doc, setDoc } = getFirebaseContext();
    const nextLetters = Array.isArray(letters) ? letters : [];
    const currentUid = window.currentUserUid || (window.firebaseAuth?.currentUser?.uid);
    await Promise.all(nextLetters.map((letter) => {
        const record = letter && typeof letter === "object" ? letter : {};
        const recordId = String(record.id || crypto.randomUUID());
        if (currentUid) {
            return setDoc(doc(db, "users", currentUid, "letters", recordId), record);
        }
        return setDoc(doc(db, "letters", recordId), record);
    }));

    return nextLetters;
}

async function fetchLettersFromFirebase() {
    const { db, collection, getDocs } = getFirebaseContext();
    const currentUid = window.currentUserUid || (window.firebaseAuth?.currentUser?.uid);
    const target = currentUid ? collection(db, "users", currentUid, "letters") : collection(db, "letters");
    const snapshot = await getDocs(target);
    return snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

async function saveDraftToFirebase(draft) {
    const { db, doc, setDoc } = getFirebaseContext();
    const snapshot = buildDraftSnapshot(draft);
    const currentUid = window.currentUserUid || (window.firebaseAuth?.currentUser?.uid);
    if (currentUid) {
        await setDoc(doc(db, "users", currentUid, "drafts", "current"), snapshot);
    } else {
        await setDoc(doc(db, "drafts", "current"), snapshot);
    }
    return snapshot;
}

async function fetchDraftFromFirebase() {
    const { db, collection, getDocs } = getFirebaseContext();
    const currentUid = window.currentUserUid || (window.firebaseAuth?.currentUser?.uid);
    if (currentUid) {
        const snapshot = await getDocs(collection(db, "users", currentUid, "drafts"));
        const current = snapshot.docs.find((docSnap) => docSnap.id === "current");
        return current ? { id: current.id, ...current.data() } : null;
    }
    const snapshot = await getDocs(collection(db, "drafts"));
    const current = snapshot.docs.find((docSnap) => docSnap.id === "current");
    return current ? { id: current.id, ...current.data() } : null;
}

async function hydrateLocalStorageFromFirebase() {
    try {
        const [remoteDraft, remoteLetters] = await Promise.all([
            fetchDraftFromFirebase().catch(() => null),
            fetchLettersFromFirebase().catch(() => []),
        ]);

        if (Array.isArray(remoteLetters) && remoteLetters.length > 0 && !localStorage.getItem(LOCAL_LETTERS_KEY)) {
            localStorage.setItem(LOCAL_LETTERS_KEY, JSON.stringify(remoteLetters));
        }
    } catch (error) {
        console.error("Firebaseの初期読み込みに失敗しました", error);
    }
}

const firebaseLetterStore = {
    saveLetterToFirebase,
    saveLettersToFirebase,
    fetchLettersFromFirebase,
    saveMonthlyEmotionSummary,
    fetchMonthlyEmotionSummary,
    saveDraftToFirebase,
    fetchDraftFromFirebase,
    hydrateLocalStorageFromFirebase,
};

window.firebaseLetterStore = firebaseLetterStore;

function normalizeDraftForPersistence(draft) {
    const nextDraft = typeof draft === "object" && draft !== null ? { ...draft } : {};

    const applyStringDefault = (key, defaultValue) => {
        const currentValue = nextDraft[key];
        const shouldUseDefault = currentValue === undefined || currentValue === null || (typeof currentValue === "string" && currentValue.trim() === "");
        nextDraft[key] = shouldUseDefault ? defaultValue : String(currentValue);
    };

    const applyNumberDefault = (key, defaultValue) => {
        const currentValue = nextDraft[key];
        const numericValue = typeof currentValue === "number" ? currentValue : Number(currentValue);
        nextDraft[key] = Number.isFinite(numericValue) ? String(numericValue) : String(defaultValue);
    };

    applyStringDefault("title", "未入力");
    applyStringDefault("body", "未入力");
    applyStringDefault("memoDate", "未入力");
    applyStringDefault("memoWeekday", "未入力");
    applyStringDefault("memoWeather", "未入力");
    applyStringDefault("memoTodayEvent", "未入力");
    applyStringDefault("memoAchievementNotes", "未入力");
    applyStringDefault("memoTomorrowGoal", "未入力");
    applyStringDefault("memoTomorrowFun", "未入力");
    applyStringDefault("deliveryAt", "未入力");

    applyNumberDefault("memoEmotionLevel", 0);

    if (!nextDraft.memoEmotionProfile || typeof nextDraft.memoEmotionProfile !== "object") {
        nextDraft.memoEmotionProfile = createEmotionProfile();
    }

    nextDraft.memoEmotionProfileTouched = Boolean(nextDraft.memoEmotionProfileTouched);

    return nextDraft;
}

function collectDraftFromCurrentInputs() {
    const currentDraft = typeof window.loadDraft === "function" ? window.loadDraft() : {};
    const titleInput = document.getElementById("letter-title");
    const bodyInput = document.getElementById("letter-body");

    const title = titleInput && (titleInput instanceof HTMLInputElement || titleInput instanceof HTMLTextAreaElement)
        ? String(titleInput.value || "").trim()
        : String(currentDraft?.title || "").trim();
    const body = bodyInput && (bodyInput instanceof HTMLInputElement || bodyInput instanceof HTMLTextAreaElement)
        ? String(bodyInput.value || "").trim()
        : String(currentDraft?.body || "").trim();

    return normalizeDraftForPersistence({
        ...(currentDraft || {}),
        title,
        body,
    });
}

const saveButton = document.getElementById("save-btn");

if (saveButton) {
    saveButton.addEventListener("click", async () => {
        const draft = typeof buildMemoDraftFromForm === "function" ? buildMemoDraftFromForm() : collectDraftFromCurrentInputs();
        const body = String(draft?.body || "").trim();

        if (!draft) {
            console.warn("保存対象の下書きデータがありません。", { draft });
            return;
        }

        const localLetterRecord = buildLetterRecord(draft);

        const currentLetters = JSON.parse(localStorage.getItem(LOCAL_LETTERS_KEY) || "[]");
        if (Array.isArray(currentLetters)) {
            currentLetters.unshift(localLetterRecord);
            localStorage.setItem(LOCAL_LETTERS_KEY, JSON.stringify(currentLetters));
        }

        if (typeof window.showView === "function") {
            window.showView("home", { updateHash: true });
        } else {
            window.location.hash = "#home";
            window.location.reload();
        }

        try {
            await Promise.all([
                saveDraftToFirebase(draft),
                saveLetterToFirebase(draft),
            ]);
        } catch (error) {
            console.error("Firebaseへの同期に失敗しました。", error);
        }
    });
}