/**
 * ============================================================================
 * brew_engine.js — [3/3] 드립 커피 브루잉 프로그램 작동 엔진
 * 기준일: 2026-10-29
 *
 * [담당 기능]
 * 1. 사용자 인증(마스터 코드 보안 처리 / 개별 초대링크 자동 환영)
 * 2. coffee_recipes.js 연동 (원두 24종, 드리퍼 3종, 중량 7단계, 추출모드 4종, 프리셋 16종, 그라인더 13종)
 * 3. 1줄 2개 조작부 제어 (큰 단위 막대 ↔ 미세 숫자 직접 입력 동기화 + 개별/전체 🔒 잠금)
 * 4. 눈금·수치·9개 구역 라벨이 복원된 2종 브루잉 차트 (시간별 용출 개념도 & SCA 골든컵 차트)
 * 5. 비이커 글씨가 제거된 깔끔한 3D 실사 추출 렌더링 + 물 따르는 ASMR + 단계별 차별화 알람 + 3단계 음성 코칭
 * 6. 단일 기본 엑셀(.csv) 강제 누적 저장, 수동 백업, 2종 불러오기 및 향후 Firebase 서버 연동 어댑터
 * ============================================================================
 */

// ============================================================================
// 1. 전역 상태 관리 및 초기화
// ============================================================================
const _MASTER_KEY = String.fromCharCode(55, 55, 55, 55); // 마스터 코드 화면/소스 노출 방지
const STORAGE_KEY = "ohBaristaCumulativeRecipesDB_v3";

let isMaster = false;
let currentUserName = "오찬욱";
let currentDripper = "bluebottle";
let currentOriginId = "geisha";
let currentWeightIdx = 3; // 기본 30g (WEIGHTS: [15, 20, 25, 30, 35, 40, 50])
let currentBrewMode = "standard"; // strong(1:14), standard(1:16), light(1:18), bypass(1:12+1:4)
let currentPresetSelection = "common_mode"; // 'common_mode' | 'dripper:...' | 'barista:...'
let currentGrinderId = "feima_600n";
let uploadMode = "default";

// 개별 항목 잠금(고정) 상태
const lockState = {
  dose: false,
  water: false,
  temp: false,
  time: false,
  grinder: false,
  grind: false
};
let isAllLocked = false;

// 향후 Firebase 등 클라우드 서버 연결을 위한 어댑터 인터페이스
const CloudSyncAdapter = {
  enabled: false,
  endpointUrl: null,
  async syncRecipeToServer(recipeEntry) {
    if (!this.enabled) return false;
    // 추후 Firebase Firestore / Realtime DB 연동 시 이 함수 내부만 구현하면 전체 앱에 즉시 적용됩니다.
    return true;
  }
};
window.CloudSyncAdapter = CloudSyncAdapter;

window.addEventListener("DOMContentLoaded", () => {
  initSelectorsFromData();
  checkInvitedUrlParam();
});

function checkInvitedUrlParam() {
  const params = new URLSearchParams(window.location.search);
  const invitedName = params.get("name");
  if (invitedName && invitedName.trim() !== "") {
    currentUserName = invitedName.trim();
    const banner = document.getElementById("url-guest-banner");
    const title = document.getElementById("url-guest-title");
    const input = document.getElementById("guest-name-input");
    const manualZone = document.getElementById("manual-guest-zone");
    if (banner && title) {
      banner.style.display = "block";
      title.textContent = `${currentUserName} 님, 환영합니다!`;
    }
    if (input) input.value = currentUserName;
    if (manualZone) manualZone.style.display = "none";
  }
}

// coffee_recipes.js 데이터를 읽어 드롭다운 메뉴 동적 생성
function initSelectorsFromData() {
  // 1) 원두 24종 셀렉트 박스 구성
  const originSel = document.getElementById("origin-select");
  if (originSel && window.COFFEE_BEANS) {
    const groups = {
      약배전: [],
      중배전: [],
      강배전: []
    };
    window.COFFEE_BEANS.forEach(bean => {
      const rKey = bean.roast || "중배전";
      if (!groups[rKey]) groups[rKey] = [];
      groups[rKey].push(bean);
    });

    originSel.innerHTML = "";
    const groupLabels = {
      약배전: "🌸 약배전 (Light / Light-Medium)",
      중배전: "🍯 중배전 (Medium)",
      강배전: "🍫 중강~강배전 (Medium-Dark / Dark)"
    };

    ["약배전", "중배전", "강배전"].forEach(gKey => {
      if (!groups[gKey] || groups[gKey].length === 0) return;
      const optGroup = document.createElement("optgroup");
      optGroup.label = groupLabels[gKey];
      groups[gKey].forEach(bean => {
        const opt = document.createElement("option");
        opt.value = bean.id;
        opt.textContent = `${bean.name} [${bean.recommendedTemperature.minC}~${bean.recommendedTemperature.maxC}°C]`;
        if (bean.id === "yirgacheffe") opt.selected = true;
        optGroup.appendChild(opt);
      });
      originSel.appendChild(optGroup);
    });
    currentOriginId = originSel.value || "yirgacheffe";
  }

  // 2) 레시피 기준 프리셋(공통 4모드 + 바리스타 프리셋 + 드리퍼 원본 프리셋) 구성
  const presetSel = document.getElementById("preset-select");
  if (presetSel) {
    presetSel.innerHTML = `<option value="common_mode">공통 4모드 (1:14 / 1:16 / 1:18 / 바이패스)</option>`;

    if (window.BARISTA_PRESETS && window.BARISTA_PRESETS.length > 0) {
      const bg = document.createElement("optgroup");
      bg.label = "🏆 전문 바리스타 공개 프리셋 (원본 비율 보존)";
      window.BARISTA_PRESETS.forEach(bp => {
        const opt = document.createElement("option");
        opt.value = `barista:${bp.id}`;
        opt.textContent = `${bp.baristaName} — ${bp.recipeName} (${bp.coffeeDose}g:${bp.waterAmount}g, 1:${bp.ratio})`;
        bg.appendChild(opt);
      });
      presetSel.appendChild(bg);
    }

    if (window.DRIPPER_ORIGINAL_PRESETS && window.DRIPPER_ORIGINAL_PRESETS.length > 0) {
      const dg = document.createElement("optgroup");
      dg.label = "📘 제조사 공식 & 로스터리 원본 프리셋";
      window.DRIPPER_ORIGINAL_PRESETS.forEach(dp => {
        const opt = document.createElement("option");
        opt.value = `dripper:${dp.id}`;
        opt.textContent = `${dp.name} (${dp.coffeeDoseG}g:${dp.waterAmountG}g, 1:${dp.ratio})`;
        dg.appendChild(opt);
      });
      presetSel.appendChild(dg);
    }
  }

  // 3) 그라인더 13종 셀렉트 박스 구성
  const grinderSel = document.getElementById("grinder-select");
  if (grinderSel && window.COFFEE_GRINDERS) {
    grinderSel.innerHTML = "";
    window.COFFEE_GRINDERS.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.id;
      const startDisp = g.userConfirmed
        ? `실사용 ${g.userConfirmed.pourOverStandard}`
        : (g.standardPourOverSetting !== null ? `시작 ${g.standardPourOverSetting}` : `범위 ${g.recommendedRange.min}~${g.recommendedRange.max}`);
      opt.textContent = `${g.name} (${startDisp})`;
      grinderSel.appendChild(opt);
    });
    currentGrinderId = "feima_600n";
    grinderSel.value = currentGrinderId;
  }
}

// ============================================================================
// 2. 로그인 및 권한 처리 (마스터 / 개별 링크 지인)
// ============================================================================
function showMasterInput() {
  document.getElementById("btn-show-master").style.display = "none";
  document.getElementById("master-code-zone").style.display = "block";
  document.getElementById("master-code-input").focus();
}

function enterWithUrlName() {
  completeLogin(false, currentUserName);
}

function loginGuestManual() {
  const inputVal = document.getElementById("guest-name-input").value.trim();
  if (!inputVal) {
    alert("방문자 성함을 입력해 주세요.");
    return;
  }
  completeLogin(false, inputVal);
}

function loginMaster() {
  const code = document.getElementById("master-code-input").value.trim();
  if (code !== _MASTER_KEY) {
    alert("마스터 입장 코드가 올바르지 않습니다.");
    return;
  }
  completeLogin(true, "오찬욱");
}

function completeLogin(masterFlag, nameStr) {
  isMaster = masterFlag;
  currentUserName = isMaster ? "오찬욱" : nameStr;

  document.getElementById("authOverlay").style.display = "none";
  document.getElementById("mainContainer").style.display = "block";

  const roleBadge = document.getElementById("user-role-badge");
  const headerTitle = document.getElementById("header-barista-title");
  const subTitle = document.getElementById("welcome-subtitle");
  const boardTitle = document.getElementById("recipe-board-title");
  const fileInfo = document.getElementById("excel-file-info");

  if (isMaster) {
    roleBadge.textContent = "👑 마스터";
    roleBadge.className = "role-badge badge-master";
    headerTitle.textContent = "오찬욱 바리스타 마스터 다이얼러";
    subTitle.textContent = "표준 1:16 · 약국 Feima 600N(4.5) / 가정 Encore(14) 기준 적용 중";
    document.getElementById("btn-invite-link").style.display = "inline-block";
    boardTitle.textContent = "👑 마스터 통합 레시피 보관함 (전체 사용자 열람 · 클릭하여 펼치기)";
    fileInfo.textContent = "마스터_오찬욱_기본레시피.csv 자동저장 연동";
  } else {
    roleBadge.textContent = `☕ ${currentUserName}`;
    roleBadge.className = "role-badge badge-guest";
    headerTitle.textContent = `${currentUserName} 님의 브루잉 다이얼러`;
    subTitle.textContent = `${currentUserName} 님 환영합니다! 표준 비율 1:16 · 모든 수치는 추천 시작점입니다.`;
    document.getElementById("btn-invite-link").style.display = "none";
    boardTitle.textContent = `📔 ${currentUserName} 님의 전용 레시피 보관함 (클릭하여 펼치기)`;
    fileInfo.textContent = `개별링크_${currentUserName}_기본레시피.csv 자동저장 연동`;
  }

  onGrinderChange();
  applyOriginAndModeSettings();
  renderRecipeBoard();
}

function createInviteLink() {
  const friendName = prompt("초대할 지인의 성함을 입력해 주세요:");
  if (!friendName || !friendName.trim()) return;
  const baseUrl = window.location.origin + window.location.pathname;
  const inviteUrl = `${baseUrl}?name=${encodeURIComponent(friendName.trim())}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(inviteUrl);
  }
  prompt(`개별 초대 링크가 생성되었습니다! 복사해서 전달해 주세요:\n(접속 시 "${friendName.trim()} 님, 환영합니다!"가 표시됩니다)`, inviteUrl);
}

// ============================================================================
// 3. 막대(큰 단위) ↔ 숫자 직접 입력(세밀한 단위) 동기화 및 🔒 잠금(고정) 제어
// ============================================================================
function setControlValue(key, val) {
  if (lockState[key]) return; // 잠긴 항목은 값 변경 차단
  const numEl = document.getElementById(`${key}-num`);
  const sliderEl = document.getElementById(key);
  const rounded = key === "temp" ? Number(Number(val).toFixed(1)) : (key === "dose" ? Number(Number(val).toFixed(1)) : Math.round(Number(val)));

  if (numEl) numEl.value = rounded;
  if (sliderEl) sliderEl.value = rounded;
}

function getControlValue(key) {
  const numEl = document.getElementById(`${key}-num`);
  return numEl ? parseFloat(numEl.value) || 0 : 0;
}

// 막대(슬라이더)를 움직였을 때 -> 직접 입력칸에 즉시 반영
function onSliderInput(key) {
  if (lockState[key]) return;
  const sliderEl = document.getElementById(key);
  const numEl = document.getElementById(`${key}-num`);
  if (sliderEl && numEl) {
    numEl.value = sliderEl.value;
  }
  if (key === "dose") {
    syncWeightButtonsWithDose(parseFloat(sliderEl.value));
    if (!lockState.water && currentPresetSelection === "common_mode") {
      const calc = window.calculateBrewModeWater(parseFloat(sliderEl.value), currentBrewMode);
      setControlValue("water", calc.totalInputWaterG);
    }
  }
  updateDial();
}

// 숫자를 직접 타이핑했을 때 -> 슬라이더 위치 동기화 및 정밀 반영
function onDirectInput(key) {
  if (lockState[key]) return;
  const numEl = document.getElementById(`${key}-num`);
  const sliderEl = document.getElementById(key);
  if (!numEl) return;

  let val = parseFloat(numEl.value);
  const min = parseFloat(numEl.min) || 0;
  const max = parseFloat(numEl.max) || 1000;
  if (isNaN(val)) val = min;
  val = Math.max(min, Math.min(max, val));
  numEl.value = key === "temp" ? val.toFixed(1) : val;

  if (sliderEl) {
    sliderEl.value = val;
  }
  if (key === "dose") {
    syncWeightButtonsWithDose(val);
    if (!lockState.water && currentPresetSelection === "common_mode") {
      const calc = window.calculateBrewModeWater(val, currentBrewMode);
      setControlValue("water", calc.totalInputWaterG);
    }
  }
  updateDial();
}

// [-] [+] 미세 증감 버튼 클릭 시
function stepControl(key, delta) {
  if (lockState[key]) return;
  const current = getControlValue(key);
  const numEl = document.getElementById(`${key}-num`);
  const min = numEl ? parseFloat(numEl.min) : 0;
  const max = numEl ? parseFloat(numEl.max) : 1000;
  const nextVal = Math.max(min, Math.min(max, Number((current + delta).toFixed(1))));
  setControlValue(key, nextVal);

  if (key === "dose") {
    syncWeightButtonsWithDose(nextVal);
    if (!lockState.water && currentPresetSelection === "common_mode") {
      const calc = window.calculateBrewModeWater(nextVal, currentBrewMode);
      setControlValue("water", calc.totalInputWaterG);
    }
  }
  updateDial();
}

// 개별 항목 잠금(고정) 토글
function toggleLock(key) {
  lockState[key] = !lockState[key];
  applyLockUI(key);
  checkAllLockedStatus();
}

// 전체 세팅 일괄 고정 토글
function toggleLockAll() {
  isAllLocked = !isAllLocked;
  Object.keys(lockState).forEach(k => {
    lockState[k] = isAllLocked;
    applyLockUI(k);
  });
  checkAllLockedStatus();
}

function applyLockUI(key) {
  const locked = lockState[key];
  const box = document.getElementById(`box-${key}`);
  const btn = document.getElementById(`lock-${key}`);
  const minusBtn = document.getElementById(`minus-${key}`);
  const plusBtn = document.getElementById(`plus-${key}`);

  if (box) box.classList.toggle("is-locked", locked);
  if (btn) {
    btn.classList.toggle("locked", locked);
    btn.textContent = locked ? "🔒 고정됨" : "🔓 고정";
  }
  if (minusBtn) minusBtn.disabled = locked;
  if (plusBtn) plusBtn.disabled = locked;

  if (key === "grinder") {
    const gSel = document.getElementById("grinder-select");
    const gNum = document.getElementById("grinder-dial-num");
    if (gSel) gSel.disabled = locked;
    if (gNum) gNum.disabled = locked;
  } else {
    const numEl = document.getElementById(`${key}-num`);
    const sliderEl = document.getElementById(key);
    if (numEl) numEl.disabled = locked;
    if (sliderEl) sliderEl.disabled = locked;
  }
}

function checkAllLockedStatus() {
  const allLockedNow = Object.values(lockState).every(Boolean);
  isAllLocked = allLockedNow;
  const allBtn = document.getElementById("btn-lock-all");
  if (allBtn) {
    allBtn.classList.toggle("locked", allLockedNow);
    allBtn.textContent = allLockedNow ? "🔒 전체 고정 해제하기" : "🔓 전체 세팅 고정하기";
  }
}

// ============================================================================
// 4. 드리퍼 · 원두 · 중량(7단계) · 추출 모드(4종) · 바리스타 프리셋 · 그라인더 연동
// ============================================================================
function selectDripper(dripperKey) {
  currentDripper = dripperKey;
  const d = window.DRIPPERS[dripperKey];
  if (!d) return;

  document.documentElement.style.setProperty("--theme-color", d.themeColor);
  document.documentElement.style.setProperty("--theme-dark", d.themeDark);
  document.documentElement.style.setProperty("--theme-soft", d.themeSoft);
  document.getElementById("logo-badge").textContent = d.badge;

  ["bluebottle", "hario", "kalita"].forEach(k => {
    const tab = document.getElementById("card-" + k);
    if (tab) tab.classList.toggle("active", k === dripperKey);
  });

  applyOriginAndModeSettings();
}

function onOriginChange() {
  currentOriginId = document.getElementById("origin-select").value;
  applyOriginAndModeSettings();
}

function selectWeightPreset(idx) {
  if (lockState.dose) {
    alert("원두량이 [🔒 고정됨] 상태입니다. 변경하려면 고정을 해제해 주세요.");
    return;
  }
  currentWeightIdx = idx;
  for (let i = 0; i < window.WEIGHTS.length; i++) {
    const btn = document.getElementById("wbtn-" + i);
    if (btn) btn.classList.toggle("active", i === idx);
  }
  applyOriginAndModeSettings();
}

function syncWeightButtonsWithDose(doseVal) {
  for (let i = 0; i < window.WEIGHTS.length; i++) {
    const btn = document.getElementById("wbtn-" + i);
    if (btn) btn.classList.toggle("active", window.WEIGHTS[i] === doseVal);
    if (window.WEIGHTS[i] === doseVal) currentWeightIdx = i;
  }
}

function selectBrewMode(modeKey) {
  currentBrewMode = modeKey;
  currentPresetSelection = "common_mode";
  const presetSel = document.getElementById("preset-select");
  if (presetSel) presetSel.value = "common_mode";

  ["strong", "standard", "light", "bypass"].forEach(m => {
    const btn = document.getElementById("mbtn-" + m);
    if (btn) btn.classList.toggle("active", m === modeKey);
  });

  applyOriginAndModeSettings();
}

function onPresetSelectChange() {
  const val = document.getElementById("preset-select").value;
  currentPresetSelection = val;

  if (val === "common_mode") {
    selectBrewMode(currentBrewMode);
    return;
  }

  ["strong", "standard", "light", "bypass"].forEach(m => {
    const btn = document.getElementById("mbtn-" + m);
    if (btn) btn.classList.remove("active");
  });

  if (val.startsWith("barista:")) {
    const presetId = val.split(":")[1];
    const bp = window.BARISTA_PRESETS.find(p => p.id === presetId);
    if (bp) {
      if (bp.dripper && window.DRIPPERS[bp.dripper]) {
        currentDripper = bp.dripper;
        ["bluebottle", "hario", "kalita"].forEach(k => {
          document.getElementById("card-" + k).classList.toggle("active", k === currentDripper);
        });
      }
      setControlValue("dose", bp.coffeeDose);
      syncWeightButtonsWithDose(bp.coffeeDose);
      setControlValue("water", bp.waterAmount);
      setControlValue("temp", bp.temperature.recommendedC);
      setControlValue("time", bp.targetTime.targetSec);
    }
  } else if (val.startsWith("dripper:")) {
    const presetId = val.split(":")[1];
    const dp = window.DRIPPER_ORIGINAL_PRESETS.find(p => p.id === presetId);
    if (dp) {
      if (dp.dripper && window.DRIPPERS[dp.dripper]) {
        currentDripper = dp.dripper;
        ["bluebottle", "hario", "kalita"].forEach(k => {
          document.getElementById("card-" + k).classList.toggle("active", k === currentDripper);
        });
      }
      setControlValue("dose", dp.coffeeDoseG);
      syncWeightButtonsWithDose(dp.coffeeDoseG);
      setControlValue("water", dp.waterAmountG);
      setControlValue("temp", dp.temperatureC);
      const midTime = Math.round((dp.targetTimeRangeSec[0] + dp.targetTimeRangeSec[1]) / 2);
      setControlValue("time", midTime);
    }
  }

  updateDial();
}

function applyOriginAndModeSettings() {
  const origin = window.ORIGIN_DB[currentOriginId] || window.COFFEE_BEANS[0];
  const d = window.DRIPPERS[currentDripper];

  if (currentPresetSelection !== "common_mode") {
    onPresetSelectChange();
    return;
  }

  const dose = lockState.dose ? getControlValue("dose") : window.WEIGHTS[currentWeightIdx];
  setControlValue("dose", dose);

  const waterCalc = window.calculateBrewModeWater(dose, currentBrewMode);
  setControlValue("water", waterCalc.totalInputWaterG);

  const startTemp = origin.recommendedTemperature ? origin.recommendedTemperature.startC : origin.temp;
  setControlValue("temp", startTemp);

  const wIdx = Math.max(0, window.WEIGHTS.indexOf(dose));
  const idxToUse = wIdx >= 0 ? wIdx : 3;
  const recGrindSim = (origin.grinds[idxToUse] || 780) + d.grindOffset;
  const recTime = (origin.times[idxToUse] || 210) + d.timeOffset;

  setControlValue("grind", recGrindSim);
  setControlValue("time", currentBrewMode === "bypass" ? Math.max(120, recTime - 25) : recTime);

  const hintEl = document.getElementById("temp-range-hint");
  if (hintEl && origin.recommendedTemperature) {
    hintEl.textContent = `권장 ${origin.recommendedTemperature.minC}~${origin.recommendedTemperature.maxC}°C`;
  }

  updateDial();
}

// 그라인더 선택 변경 시 (μm 임의 환산 없이 해당 그라인더 고유 눈금 표시)
function onGrinderChange() {
  if (lockState.grinder) return;
  const sel = document.getElementById("grinder-select");
  if (!sel) return;
  currentGrinderId = sel.value;
  const info = window.getGrinderDisplayInfo(currentGrinderId);

  const dialInput = document.getElementById("grinder-dial-num");
  const unitTxt = document.getElementById("grinder-unit-txt");
  const summaryTxt = document.getElementById("grinder-summary-txt");
  const linkEl = document.getElementById("grinder-source-link");

  const startSetting = info.standardPourOverSetting !== null ? info.standardPourOverSetting : 38;
  if (dialInput) {
    dialInput.min = info.dialMin ?? 0;
    dialInput.max = info.dialMax ?? 240;
    dialInput.step = info.adjustmentType.includes("clicks") ? 1 : 0.5;
    dialInput.value = startSetting;
  }
  if (unitTxt) {
    unitTxt.textContent = info.adjustmentType.includes("clicks") ? "클릭" : "다이얼";
  }
  if (summaryTxt) {
    summaryTxt.textContent = info.shortSummary;
  }
  if (linkEl) {
    if (info.sourceUrls && info.sourceUrls.length > 0) {
      linkEl.href = info.sourceUrls[0];
      linkEl.style.display = "inline";
    } else {
      linkEl.style.display = "none";
    }
  }

  updateGrinderKPI(info, startSetting);
}

function stepGrinderDial(delta) {
  if (lockState.grinder) return;
  const dialInput = document.getElementById("grinder-dial-num");
  if (!dialInput) return;
  const stepUnit = parseFloat(dialInput.step) || 0.5;
  const actualDelta = delta > 0 ? stepUnit : -stepUnit;
  const cur = parseFloat(dialInput.value) || 0;
  const min = parseFloat(dialInput.min) || 0;
  const max = parseFloat(dialInput.max) || 240;
  const next = Math.max(min, Math.min(max, Number((cur + actualDelta).toFixed(1))));
  dialInput.value = next;
  onGrinderDialDirectInput();
}

function onGrinderDialDirectInput() {
  if (lockState.grinder) return;
  const dialInput = document.getElementById("grinder-dial-num");
  const info = window.getGrinderDisplayInfo(currentGrinderId);
  updateGrinderKPI(info, dialInput ? dialInput.value : info.standardPourOverSetting);
}

function updateGrinderKPI(info, currentDialVal) {
  const badge = document.getElementById("kpi-grinder-badge");
  const valEl = document.getElementById("kpi-grinder-val");
  const subEl = document.getElementById("kpi-grinder-sub");

  if (badge) badge.textContent = info.badgeText;
  if (valEl) valEl.textContent = `${info.model}: ${currentDialVal}`;
  if (subEl) subEl.textContent = info.shortSummary;
}

// ============================================================================
// 5. 실시간 계산 & KPI & 2종 브루잉 차트 (눈금 및 골든컵 9구역 완벽 복원)
// ============================================================================
function formatSecShort(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}분 ${s < 10 ? "0" + s : s}초`;
}

function formatMMSS(sec) {
  const absSec = Math.floor(Math.abs(sec));
  const m = Math.floor(absSec / 60);
  const s = absSec % 60;
  const sign = sec < 0 ? "-" : "";
  return `${sign}${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
}

function updateDial() {
  const d = window.DRIPPERS[currentDripper];
  const origin = window.ORIGIN_DB[currentOriginId] || window.COFFEE_BEANS[0];

  const dose = getControlValue("dose");
  const water = getControlValue("water");
  const temp = getControlValue("temp");
  const time = getControlValue("time");
  const grindSim = getControlValue("grind");
  const ratio = dose > 0 ? water / dose : 16.0;

  document.getElementById("dose-label").textContent = `${dose}g`;
  document.getElementById("water-label").textContent = `${water}g (1:${ratio.toFixed(1)})`;
  document.getElementById("temp-label").textContent = `${temp.toFixed(1)}°C`;
  document.getElementById("time-label").textContent = `${formatSecShort(time)} (${Math.round(time)}s)`;
  document.getElementById("grind-label").textContent = `${grindSim}`;

  // 1) 물 투입량 KPI 업데이트
  const waterBadge = document.getElementById("kpi-water-badge");
  const waterVal = document.getElementById("kpi-water-val");
  const waterSub = document.getElementById("kpi-water-sub");

  if (currentPresetSelection === "common_mode" && currentBrewMode === "bypass") {
    const bpCalc = window.calculateBrewModeWater(dose, "bypass");
    waterBadge.textContent = "바이패스 (1:12+1:4)";
    waterVal.textContent = `${bpCalc.dripperInputWaterG}g + 온수 ${bpCalc.bypassHotWaterG}g`;
    waterSub.textContent = `드리퍼 ${bpCalc.dripperInputWaterG}g 추출 후 서버 온수 ${bpCalc.bypassHotWaterG}g 추가 (총 투입 ${bpCalc.totalInputWaterG}g)`;
  } else {
    waterBadge.textContent = currentPresetSelection === "common_mode"
      ? window.BREW_MODES[currentBrewMode].name
      : `프리셋 (1:${ratio.toFixed(1)})`;
    waterVal.textContent = `총 ${water}g 투입`;
    waterSub.textContent = `원두 ${dose}g : 투입수 ${water}g (실제 완성 음료 무게는 흡수분만큼 작음)`;
  }

  // 2) 교육용 시뮬레이션 추정치 vs 실측 TDS/EY 구분 계산
  const baseGrind = 780 + d.grindOffset + (dose - 30) * 4.5;
  const baseTime = 205 + d.timeOffset + (dose - 30) * 1.8;
  const startTemp = origin.recommendedTemperature ? origin.recommendedTemperature.startC : origin.temp;

  const grindFactor = Math.pow(baseGrind / Math.max(400, grindSim), 0.68);
  const tempFactor = 1 + 0.015 * (temp - startTemp);
  const timeTau = baseTime * 0.52;
  const timeFactor = (1 - Math.exp(-time / timeTau)) / (1 - Math.exp(-baseTime / timeTau));
  const effectiveBrewWater = (currentPresetSelection === "common_mode" && currentBrewMode === "bypass")
    ? Math.round(dose * 12)
    : water;
  const ratioFactor = Math.pow((effectiveBrewWater / dose) / 16.0, 0.32);

  let simEy = 19.8 * grindFactor * tempFactor * timeFactor * ratioFactor;
  simEy = Math.max(13.0, Math.min(25.5, simEy));

  const estBeverageMass = Math.max(40, water - dose * d.retention);
  const simTds = (dose * (simEy / 100.0) / estBeverageMass) * 100.0;

  const measuredTdsInput = document.getElementById("measured-tds").value;
  const measuredBevInput = document.getElementById("measured-bev").value;
  const measuredMetrics = window.calculateMeasuredBrewMetrics(dose, measuredTdsInput, measuredBevInput);

  const eyBadge = document.getElementById("ey-badge");
  const eyVal = document.getElementById("ey-val");
  const tdsSub = document.getElementById("tds-sub");
  const measuredResultSpan = document.getElementById("measured-ey-result");

  let chartEy = simEy;
  let chartTds = simTds;

  if (measuredMetrics.isMeasured) {
    chartEy = measuredMetrics.calculatedEY_percent;
    chartTds = measuredMetrics.measuredTDS_percent;
    eyBadge.textContent = "실측 계산값";
    eyBadge.className = (measuredMetrics.
