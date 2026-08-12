//nour somaya
const supportedCurrencies = {
  USD: { ar: "الدولار الأمريكي", en: "US Dollar" },
  EUR: { ar: "اليورو", en: "Euro" },
  TRY: { ar: "الليرة التركية", en: "Turkish Lira" },
  SYP: { ar: "الليرة السورية", en: "Syrian Pound" },
};

const currencyOrder = ["USD", "EUR", "TRY", "SYP"];

const fallbackRates = {
  USD: 1,
  EUR: 0.92,
  TRY: 32.8,
  SYP: 26000,
};

let rates = { ...fallbackRates };
let lastUpdatedText = "غير متوفر";
let usingFallback = false;
let authMode = "login";
let refreshTimer = null;

const authScreen = document.getElementById("authScreen");
const mainApp = document.getElementById("mainApp");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const toggleAuthModeBtn = document.getElementById("toggleAuthModeBtn");
const authMessage = document.getElementById("authMessage");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const userNameLabel = document.getElementById("userNameLabel");
const logoutBtn = document.getElementById("logoutBtn");

const amountInput = document.getElementById("amount");
const fromCurrency = document.getElementById("fromCurrency");
const toCurrency = document.getElementById("toCurrency");
const convertedAmount = document.getElementById("convertedAmount");
const conversionMeta = document.getElementById("conversionMeta");
const statusBox = document.getElementById("statusBox");
const swapBtn = document.getElementById("swapBtn");
const convertBtn = document.getElementById("convertBtn");
const resetBtn = document.getElementById("resetBtn");
const refreshBtn = document.getElementById("refreshBtn");
const rateSummary = document.getElementById("rateSummary");

const USERS_KEY = "currencyAppUsers";
const CURRENT_USER_KEY = "currencyAppCurrentUser";

function formatNumber(value) {
  return new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatCurrency(value, currency) {
  return `${formatNumber(value)} ${currency}`;
}

function getCurrencyLabel(currency) {
  const info = supportedCurrencies[currency] || { ar: currency, en: currency };
  return `${currency} — ${info.ar} / ${info.en}`;
}

function setStatus(message, type = "success") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}

function setAuthMessage(message, type = "success") {
  if (!message) {
    authMessage.classList.add("hidden");
    authMessage.textContent = "";
    return;
  }

  authMessage.classList.remove("hidden");
  authMessage.textContent = message;
  authMessage.className = `status ${type}`;
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function showAuthMode(isSignup) {
  authMode = isSignup ? "signup" : "login";
  authName.classList.toggle("hidden", !isSignup);
  authName.required = isSignup;

  authTitle.textContent = isSignup ? "إنشاء حساب جديد" : "تسجيل الدخول";
  authSubtitle.textContent = isSignup
    ? "أنشئ حسابًا جديدًا للبدء باستخدام التطبيق."
    : "سجل دخولك للوصول إلى محول العملات.";
  authSubmitBtn.textContent = isSignup ? "إنشاء حساب" : "تسجيل الدخول";
  toggleAuthModeBtn.textContent = isSignup
    ? "لديك حساب؟ سجّل الدخول"
    : "ليس لديك حساب؟ أنشئ حسابًا";
  setAuthMessage("");
}

function showMainApp(user) {
  userNameLabel.textContent = user.name || user.email;
  authScreen.classList.add("hidden");
  mainApp.classList.remove("hidden");
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  startAutoRefresh();
  loadRates();
}

function showAuthScreen() {
  mainApp.classList.add("hidden");
  authScreen.classList.remove("hidden");
  localStorage.removeItem(CURRENT_USER_KEY);
}

function handleAuthSubmit(event) {
  event.preventDefault();
  const name = authName.value.trim();
  const email = authEmail.value.trim().toLowerCase();
  const password = authPassword.value.trim();

  if (!email || !password) {
    setAuthMessage("الرجاء إدخال البريد وكلمة المرور", "error");
    return;
  }

  if (authMode === "signup") {
    if (!name) {
      setAuthMessage("الرجاء إدخال الاسم الكامل", "error");
      return;
    }

    const users = getUsers();
    const exists = users.some((user) => user.email === email);
    if (exists) {
      setAuthMessage("هذا البريد مستخدم مسبقًا", "error");
      return;
    }

    const newUser = { name, email, password };
    users.push(newUser);
    saveUsers(users);
    showMainApp(newUser);
    setAuthMessage("تم إنشاء الحساب بنجاح", "success");
    authForm.reset();
    return;
  }

  const users = getUsers();
  const user = users.find(
    (item) => item.email === email && item.password === password,
  );

  if (!user) {
    setAuthMessage("البريد أو كلمة المرور غير صحيحة", "error");
    return;
  }

  showMainApp(user);
  setAuthMessage("تم تسجيل الدخول بنجاح", "success");
  authForm.reset();
}

function getRate(from, to) {
  if (from === to) return 1;
  const fromRate = rates[from] ?? fallbackRates[from];
  const toRate = rates[to] ?? fallbackRates[to];

  if (typeof fromRate !== "number" || typeof toRate !== "number") {
    return fallbackRates[to] / fallbackRates[from];
  }

  return toRate / fromRate;
}

function renderRateSummary() {
  const base = "USD";
  const baseValue = rates[base] ?? fallbackRates[base];
  const baseLabel = getCurrencyLabel(base);

  const items = currencyOrder
    .filter((currency) => currency !== base)
    .map((currency) => {
      const value = rates[currency] ?? fallbackRates[currency];
      const formatted = value.toFixed(6);
      const label = getCurrencyLabel(currency);
      return `
        <div class="rate-pill">
          <div class="rate-pill-top">
            <span class="rate-currency">${currency}</span>
            <span class="rate-value">1 USD = ${formatted} ${currency}</span>
          </div>
          <div class="rate-pill-label">${label}</div>
          <div class="rate-pill-foot">1 ${currency} = ${(1 / value).toFixed(6)} USD</div>
        </div>
      `;
    });

  rateSummary.innerHTML = `
    <div class="rate-summary-header">
      <strong>أسعار العملات الحالية</strong>
      <span class="rate-summary-subtitle">محدثة تلقائيًا عند توفر البيانات</span>
    </div>
    <div class="rate-pills">
      <div class="rate-pill base-pill">
        <div class="rate-pill-top">
          <span class="rate-currency">${base}</span>
          <span class="rate-value">1 ${base} = ${baseValue.toFixed(6)} ${base}</span>
        </div>
        <div class="rate-pill-label">${baseLabel}</div>
        <div class="rate-pill-foot">1 USD = 1 USD</div>
      </div>
      ${items.join("")}
    </div>
    <div class="rate-note">تم التحقق من أحدث قيمة من API: 1 USD = ${(rates.EUR ?? fallbackRates.EUR).toFixed(6)} EUR · ${(rates.TRY ?? fallbackRates.TRY).toFixed(6)} TRY · ${(rates.SYP ?? fallbackRates.SYP).toFixed(6)} SYP</div>
  `;
}

function renderConversion(amount, from, to, rate) {
  const result = amount * rate;
  convertedAmount.textContent = formatCurrency(result, to);
  conversionMeta.innerHTML = `
    <div>${formatCurrency(amount, from)} = ${formatCurrency(result, to)}</div>
    <div>سعر الصرف المستخدم: 1 ${from} = ${rate.toFixed(6)} ${to} · ${getCurrencyLabel(to)}</div>
    <div>آخر تحديث: ${lastUpdatedText}</div>
  `;
}

function convertCurrency() {
  const amount = parseFloat(amountInput.value);
  const from = fromCurrency.value;
  const to = toCurrency.value;

  if (!amount || amount <= 0 || Number.isNaN(amount)) {
    convertedAmount.textContent = "0.00";
    conversionMeta.textContent = "يرجى إدخال مبلغ صحيح أكبر من الصفر.";
    setStatus("إدخال غير صالح. الرجاء إدخال مبلغ صحيح.", "error");
    return;
  }

  const rate = getRate(from, to);
  renderConversion(amount, from, to, rate);
  setStatus(
    usingFallback
      ? `تم استخدام أسعار بديلة لأن البيانات من API غير متاحة حالياً. آخر تحديث: ${lastUpdatedText}`
      : `تم التحويل بنجاح باستخدام أحدث سعر متوفر. آخر تحديث: ${lastUpdatedText}`,
    "success",
  );
}

function resetForm() {
  amountInput.value = "100";
  fromCurrency.value = "USD";
  toCurrency.value = "EUR";
  convertedAmount.textContent = "0.00";
  conversionMeta.textContent = "اختر المبلغ وابدأ التحويل";
  setStatus("تمت إعادة تعيين النموذج. يمكنك البدء من جديد.", "success");
}

function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  refreshTimer = setInterval(
    () => {
      loadRates();
    },
    10 * 60 * 1000,
  );
}

async function loadRates() {
  setStatus("جاري تحميل أسعار الصرف الحية من ExchangeRate API...", "success");

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");

    if (!response.ok) {
      throw new Error("فشل جلب البيانات من الخادم");
    }

    const data = await response.json();

    if (!data || !data.rates) {
      throw new Error("لا توجد أسعار متاحة من API");
    }

    rates = { ...fallbackRates };
    Object.entries(data.rates).forEach(([currency, value]) => {
      if (typeof value === "number") {
        rates[currency] = value;
      }
    });

    if (!rates.SYP) {
      rates.SYP = fallbackRates.SYP;
    }

    const updateTimestamp = data.time_last_update_utc
      ? new Date(data.time_last_update_utc)
      : new Date();
    lastUpdatedText = updateTimestamp.toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    usingFallback = false;
    renderRateSummary();
    setStatus(
      `تم تحميل أسعار الصرف الحية بنجاح. آخر تحديث: ${lastUpdatedText}`,
      "success",
    );
    convertCurrency();
  } catch (error) {
    console.error(error);
    rates = { ...fallbackRates };
    lastUpdatedText = "لا توجد بيانات حديثة";
    usingFallback = true;
    renderRateSummary();
    setStatus(
      "تعذر الاتصال بالـ API. سيتم استخدام أسعار بديلة مؤقتاً حتى يعود الاتصال.",
      "error",
    );
    convertCurrency();
  }
}

authForm.addEventListener("submit", handleAuthSubmit);
toggleAuthModeBtn.addEventListener("click", () =>
  showAuthMode(authMode !== "signup"),
);
logoutBtn.addEventListener("click", () => {
  showAuthScreen();
  showAuthMode(false);
  authForm.reset();
});

convertBtn.addEventListener("click", convertCurrency);
refreshBtn.addEventListener("click", () => {
  loadRates();
});
swapBtn.addEventListener("click", () => {
  const temp = fromCurrency.value;
  fromCurrency.value = toCurrency.value;
  toCurrency.value = temp;
  convertCurrency();
});
resetBtn.addEventListener("click", resetForm);
[amountInput, fromCurrency, toCurrency].forEach((element) => {
  element.addEventListener("input", convertCurrency);
  element.addEventListener("change", convertCurrency);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    loadRates();
  }
});

window.addEventListener("focus", () => {
  loadRates();
});

function populateCurrencyOptions() {
  const options = currencyOrder
    .map(
      (currency) =>
        `<option value="${currency}">${currency} — ${supportedCurrencies[currency].ar} / ${supportedCurrencies[currency].en}</option>`,
    )
    .join("");

  fromCurrency.innerHTML = options;
  toCurrency.innerHTML = options;
  fromCurrency.value = "USD";
  toCurrency.value = "EUR";
}

const savedUser = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || "null");
populateCurrencyOptions();
if (savedUser) {
  showMainApp(savedUser);
} else {
  showAuthScreen();
  showAuthMode(false);
}

renderRateSummary();

// رفع كومينت
