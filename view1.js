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
  // 1. 日付・曜日・天気
  document.getElementById("pdf-date").textContent = item.memoDate;
  document.getElementById("pdf-weekday").textContent = item.memoWeekday;

  const weatherIconMap = {
    sunny: "/img/weather/sunny.png",
    cloudy: "/img/weather/cloudy.png",
    rainy: "/img/weather/rainy.png",
    snowy: "/img/weather/snowy.png",
    typhoon: "/img/weather/typhoon.png",
  };

  document.getElementById("pdf-weather-icon").src = weatherIconMap[item.memoWeather];
  document.getElementById("pdf-weather-label").textContent = getWeatherLabel(item.memoWeather);

  const emotionIconMap = {
    100: "/img/emotion/100.png",
    80: "/img/emotion/80.png",
    60: "/img/emotion/60.png",
    40: "/img/emotion/40.png",
    20: "/img/emotion/20.png",
  };

  document.getElementById("pdf-emotion-icon").src = emotionIconMap[item.memoEmotionLevel];
  document.getElementById("pdf-emotion-label").textContent = item.memoEmotionLevel + "%";

  const strongestEmotion = EMOTION_AXES.reduce((strongest, axis) => {
    const level = Number(item.memoEmotionProfile?.[axis.key] || 0);
    const strongestLevel = Number(strongest?.level || 0);
    return level > strongestLevel ? { axis, level } : strongest;
  }, null);
  const strongestEmotionLabel = strongestEmotion?.level > 0 ? strongestEmotion.axis.label : "未選択";
  const strongestEmotionElement = document.getElementById("pdf-strongest-emotion");
  if (strongestEmotionElement) {
    strongestEmotionElement.textContent = `この中で一番強かった感情は（${strongestEmotionLabel}）`;
  }

  // 2. 今日の出来事
  document.getElementById("pdf-event").textContent = item.memoTodayEvent;
  document.getElementById("pdf-emotion-reason").textContent = item.memoEmotionReason;
  document.getElementById("pdf-emotion-positive").textContent = item.memoEmotionPositive;

  // 3. 今日できたこと
  document.getElementById("pdf-achievement-notes").textContent = item.memoAchievementNotes;

  // 4. 明日やりたいこと
  document.getElementById("pdf-tomorrow-goal").textContent = item.memoTomorrowGoal;

  showView("letter");
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
    empty.textContent = "まだ届いている手紙はありません。";
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
      const primaryletter = dayletters[dayletters.length - 1] || null;

      if (primaryletter) {
        cell.classList.add("is-clickable");
        cell.setAttribute("role", "button");
        cell.tabIndex = 0;
        cell.setAttribute("aria-label", `${day}日の手紙を開く`);
        cell.addEventListener("click", () => {
          openReplyDialogForletter(primaryletter);
        });
        cell.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openReplyDialogForletter(primaryletter);
          }
        });
      }

      const dayNum = document.createElement("p");
      dayNum.className = "calendar-day-number";
      dayNum.textContent = String(day);
      cell.appendChild(dayNum);

      const hasReply = dayletters.some((item) => Array.isArray(item.replies) && item.replies.length > 0);
      if (hasReply) {
        const replyBadge = document.createElement("span");
        replyBadge.className = "calendar-reply-badge";
        replyBadge.textContent = "OK";
        cell.appendChild(replyBadge);
      }

      if (dayletters.length > 0) {
        const summary = document.createElement("p");
        summary.className = "calendar-cell-summary";
        summary.textContent = dayletters.length === 1 ? "　" : `${dayletters.length}　`;
        cell.appendChild(summary);
      }

      grid.appendChild(cell);
    }

    block.appendChild(grid);
    container.appendChild(block);
  });
}

function parseletterEmotionValue(letter) {
  const storedValue = Number(letter?.memoEmotionLevel);
  if (Number.isFinite(storedValue)) {
    if (storedValue >= 1 && storedValue <= 5) {
      return storedValue * 20;
    }

    if (storedValue >= 20 && storedValue <= 100) {
      return storedValue;
    }
  }

  const body = String(letter?.body || "");
  const matched = body.match(/感情パラメータ:\s*(\d+)(?:\/5)?/);
  if (!matched) {
    return null;
  }

  const parsed = Number(matched[1]);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed >= 1 && parsed <= 5) {
    return parsed * 20;
  }

  if (parsed >= 20 && parsed <= 100) {
    return parsed;
  }

  return null;
}

function parseletterMemoDate(letter) {
  const storedDate = String(letter?.memoDate || "");
  if (storedDate) {
    const storedDateTime = new Date(storedDate);
    if (!Number.isNaN(storedDateTime.getTime())) {
      return storedDateTime;
    }
  }

  const body = String(letter?.body || "");
  const matched = body.match(/日付:\s*(\d{4}-\d{2}-\d{2})/);
  if (!matched) {
    return null;
  }

  const parsedDate = new Date(`${matched[1]}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getMondayStart(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  const offset = (nextDate.getDay() + 6) % 7;
  nextDate.setDate(nextDate.getDate() - offset);
  return nextDate;
}

function getDateKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildWeeklyEmotionSeries(letters, weekStartDate) {
  const totals = new Map();

  letters.forEach((letter) => {
    const emotionValue = parseletterEmotionValue(letter);
    const memoDate = parseletterMemoDate(letter);

    if (!Number.isFinite(emotionValue) || !memoDate) {
      return;
    }

    const letterWeekStart = getMondayStart(memoDate);
    if (letterWeekStart.getTime() !== weekStartDate.getTime()) {
      return;
    }

    const dateKey = getDateKeyFromDate(memoDate);
    const nextEntry = totals.get(dateKey) || { sum: 0, count: 0 };
    nextEntry.sum += emotionValue;
    nextEntry.count += 1;
    totals.set(dateKey, nextEntry);
  });

  return Array.from({ length: 7 }, (_, index) => {
    const cellDate = new Date(weekStartDate);
    cellDate.setDate(cellDate.getDate() + index);
    const entry = totals.get(getDateKeyFromDate(cellDate));
    if (!entry || entry.count === 0) {
      return null;
    }

    return Math.round(entry.sum / entry.count);
  });
}

function createEmotionTrendChart(monthKey, monthlySummary = null) {
  const chartCard = document.createElement("section");
  chartCard.className = "emotion-profile-card";

  const heading = document.createElement("div");
  heading.className = "emotion-profile-head";
  heading.innerHTML = `
    <div>
      <p class="emotion-profile-eyebrow">Emotion profile</p>
      <h3>感情パラメータ</h3>
    </div>
    <p class="emotion-profile-note">${monthKey || "選択中の月"}の入力値を、最大値4に対する割合で表示</p>
  `;

  const chartWrap = document.createElement("div");
  chartWrap.className = "emotion-profile-chart";

  const axes = [
    { key: "happy", label: "うれしい", color: "#ff9f43" },
    { key: "excited", label: "ワクワク", color: "#ffd84d" },
    { key: "fun", label: "楽しい", color: "#ff6fa8" },
    { key: "irritated", label: "イライラ", color: "#ff5c5c" },
    { key: "anxious", label: "焦り・不安", color: "#b85cff" },
    { key: "regret", label: "後悔", color: "#8f67ff" },
    { key: "sad", label: "悲しい", color: "#4f8df7" },
    { key: "other", label: "その他", color: "#a6a6a6" },
  ];
  const maxLevel = 4;
  const monthlyTotals = monthlySummary?.emotionTotals || monthlySummary;
  const monthlyEntryCount = Number(monthlySummary?.entryCount);
  const profile = axes.reduce((values, axis) => {
    const total = Number(monthlyTotals?.[axis.key]);
    values[axis.key] = Number.isFinite(total) && Number.isFinite(monthlyEntryCount) && monthlyEntryCount > 0
      ? Math.max(0, Math.min(maxLevel, total / monthlyEntryCount))
      : 0;
    return values;
  }, {});

  const chartSize = 360;
  const center = chartSize / 2;
  const radius = 112;
  const getPoint = (pointRadius, index) => {
    const angle = (index * 45 * Math.PI) / 180;
    return [center + pointRadius * Math.sin(angle), center - pointRadius * Math.cos(angle)];
  };
  const buildPolygon = (pointRadius) => axes.map((_, index) => getPoint(pointRadius, index).map((value) => value.toFixed(1)).join(",")).join(" ");
  const rings = [1, 2, 3, 4].map((level) => `<polygon class="emotion-profile-ring" points="${buildPolygon(radius * level / maxLevel)}" />`).join("");
  const spokes = axes.map((_, index) => {
    const [x, y] = getPoint(radius, index);
    return `<line class="emotion-profile-axis" x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" />`;
  }).join("");
  const valuePoints = axes.map((axis, index) => getPoint(radius * profile[axis.key] / maxLevel, index));
  const values = valuePoints.map((point) => point.map((value) => value.toFixed(1)).join(",")).join(" ");
  const handles = axes.map((axis, index) => {
    const [x, y] = valuePoints[index];
    return `<circle class="emotion-profile-handle" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${axis.color}" />`;
  }).join("");
  const labels = axes.map((axis, index) => {
    const [x, y] = getPoint(radius + 29, index);
    const percentage = Math.round((profile[axis.key] / maxLevel) * 100);
    return `<text class="emotion-profile-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" fill="${axis.color}">${axis.label} ${percentage}%</text>`;
  }).join("");

  chartWrap.innerHTML = `
    <svg class="emotion-profile-svg" viewBox="0 0 ${chartSize} ${chartSize}" role="img" aria-label="各感情パラメータの割合">
      <title>各感情パラメータの割合</title>
      ${rings}
      ${spokes}
      <polygon class="emotion-profile-shape" points="${values}" />
      ${handles}
      ${labels}
    </svg>
  `;

  chartCard.appendChild(heading);
  chartCard.appendChild(chartWrap);

  if (!monthlySummary || monthlyEntryCount <= 0) {
    const empty = document.createElement("p");
    empty.className = "emotion-profile-empty";
    empty.textContent = "感情パラメータの記録がまだありません。";
    chartCard.appendChild(empty);
  }

  return chartCard;
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
  button.textContent = "日記を開く";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeliveredletterById(arrivalItem.letterId);
  });

  actions.appendChild(button);
  content.appendChild(text);
  content.appendChild(actions);
  noticeElement.appendChild(content);
}

async function renderInboxView() {
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

  const now = Date.now();
  const updatedletters = [];
  const arrivalMessages = [];

  letters.forEach((item) => {
    const state = getletterState(item, now);
    if (state === "delivered" && !item.notifiedAt) {
      updatedletters.push({
        ...item,
        notifiedAt: new Date().toISOString(),
      });
      return;
    }

    updatedletters.push(item);
  });

  if (arrivalMessages.length > 0) {
    saveletters(updatedletters);
    enqueueArrivalMessages(arrivalMessages, arrivalNotice);
  }

  const delivered = updatedletters
    .filter((item) => getletterState(item, now) === "delivered")
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

  const monthlySummary = await Promise.resolve(
    window.firebaseLetterStore?.fetchMonthlyEmotionSummary?.(selectedMonthKey)
  ).catch(() => null);

  if (nowTime) {
    nowTime.textContent = new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
  }

  const dialogElements = {
    dialog,
    title: dialogTitle,
    body: dialogBody,
    meta: dialogMeta,
  };

  window.__inboxDialogElements = dialogElements;

  const notebookPaper = calendarContainer.closest(".notebook-paper");
  if (notebookPaper) {
    notebookPaper.querySelector(".emotion-profile-card")?.remove();
    notebookPaper.insertBefore(createEmotionTrendChart(selectedMonthKey, monthlySummary), calendarContainer);
  }

  renderCalendarHistory(deliveredInSelectedMonth, {
    calendarContainer,
    dialogElements,
    forceMonthDate: selectedMonthDate,
    writtenDateKeys,
    onChange: () => renderInboxView(),
  });
}
