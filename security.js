(() => {
  const LIMITS = Object.freeze({
    title: 80,
    body: 12000,
    shortText: 200,
    memo: 2000,
    displayName: 40,
  });

  const requestHistory = new Map();

  // Input normalization and size limits.
  function cleanText(value, maxLength) {
    return String(value ?? "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength);
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
  }

  // Client-side abuse throttling. Firebase rules remain authoritative.
  function isRateLimited(key, limit = 10, windowMs = 60_000) {
    const now = Date.now();
    const recent = (requestHistory.get(key) || []).filter((time) => now - time < windowMs);
    if (recent.length >= limit) {
      requestHistory.set(key, recent);
      return true;
    }
    recent.push(now);
    requestHistory.set(key, recent);
    return false;
  }

  // Diary payload validation.
  function validateDraft(draft) {
    const value = draft && typeof draft === "object" ? draft : {};
    const errors = [];
    const rawBody = String(value.body ?? "");
    const body = cleanText(rawBody, LIMITS.body);

    if (!body) {
      errors.push("本文を入力してください。");
    }
    if (String(value.title || "").length > LIMITS.title) {
      errors.push(`件名は${LIMITS.title}文字以内で入力してください。`);
    }
    if (rawBody.length > LIMITS.body) {
      errors.push(`本文は${LIMITS.body}文字以内で入力してください。`);
    }
    if (String(value.memoEmotionReason || "").length > LIMITS.memo) {
      errors.push(`感情の理由は${LIMITS.memo}文字以内で入力してください。`);
    }
    if (String(value.memoEmotionPositive || "").length > LIMITS.memo) {
      errors.push(`ポジティブ変換は${LIMITS.memo}文字以内で入力してください。`);
    }
    if (String(value.memoTomorrowGoal || "").length > LIMITS.memo) {
      errors.push(`明日やりたいことは${LIMITS.memo}文字以内で入力してください。`);
    }
    if (String(value.memoTomorrowFun || "").length > LIMITS.memo) {
      errors.push(`明日楽しみなことは${LIMITS.memo}文字以内で入力してください。`);
    }

    return { valid: errors.length === 0, errors };
  }

  // Authentication payload validation.
  function validateCredentials(email, password) {
    const normalizedEmail = cleanText(email, 320).toLowerCase();
    const normalizedPassword = String(password || "");
    const errors = [];

    if (!isEmail(normalizedEmail)) {
      errors.push("メールアドレスの形式が正しくありません。");
    }
    if (normalizedPassword.length < 6 || normalizedPassword.length > 128) {
      errors.push("パスワードは6文字以上128文字以内で入力してください。");
    }

    return { valid: errors.length === 0, errors, email: normalizedEmail };
  }

  function validateDisplayName(name) {
    const value = cleanText(name, LIMITS.displayName);
    return { valid: value.length <= LIMITS.displayName, value };
  }

  window.siteSecurity = Object.freeze({
    limits: LIMITS,
    cleanText,
    validateDraft,
    validateCredentials,
    validateDisplayName,
    isRateLimited,
  });
})();
