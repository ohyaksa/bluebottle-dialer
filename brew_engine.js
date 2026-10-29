/**
 * brew_engine.js
 * 드립 커피 추출 프로그램 작동 엔진 파일 (버전 1.5 최종 수정본)
 * - 사용자 인증(마스터 / 지인 모드) 및 권한 관리 안전성 강화
 * - 1줄 2개 배치 조작창 (막대 슬라이더 + 직접 숫자 입력 + 🔒 잠금 시스템)
 * - 7단계 중량 × 4개 추출 모드 실시간 물 투입량 계산
 * - 그라인더 13종 시작값 및 캘리브레이션 관리
 * - SCA 골든컵 차트 및 시간별 용출 차트 렌더링
 * - 3D 실사 추출 애니메이션, 물소리 ASMR 효과음, 3단계 음성 안내
 * - 앱 내부 저장 + 단일 기본 엑셀(.csv) 자동 강제 저장 및 백업·복원 시스템
 */

// ============================================================================
// 1. 전역 상태 및 변수 관리
// ============================================================================
let isMaster = false;
let currentUserName = "오찬욱";
let currentDripper = "bluebottle";
let currentWeightIdx = 3; // 기본 30g
let currentModeKey = "standard";
let uploadMode = "default";

// 세팅 고정(잠금) 상태 객체
const lockStates = {
  dose: false,
  water: false,
  temp: false,
  time: false,
  grinder: false,
  grind: false
};
let isAllLocked = false;

// ============================================================================
// 2. 앱 초기화 및 인증 (Auth) 로직 (안전성 보완)
// ============================================================================
window.addEventListener("DOMContentLoaded", () => {
  try {
    // 1) URL 파라미터(?name=이름) 체크
    const params = new URLSearchParams(window.location.search);
    const invitedName = params.get("name");
    if (invitedName && invitedName.trim() !== "") {
      currentUserName = invitedName.trim();
      const guestBanner = document.getElementById("url-guest-banner");
      const guestTitle = document.getElementById("url-guest-title");
      const manualZone = document.getElementById("manual-guest-zone");
      if (guestBanner) guestBanner.style.display = "block";
      if (guestTitle) guestTitle.textContent = `${currentUserName} 님, 환영합니다!`;
      const nameInput = document.getElementById("guest-name-input");
      if (nameInput) nameInput.value = currentUserName;
      if (manualZone) manualZone.style.display = "none";
    }

    // 2) 셀렉트 박스 데이터 채우기 (coffee_recipes.js 로드 확인 후 실행)
    if (typeof window.COFFEE_GRINDERS !== "undefined") {
      populateGrinderSelect();
    }
    if (typeof window.ORIGIN_DB !== "undefined") {
      populateOriginSelect();
      populatePresetSelect();
    }

    // 3) 초기 다이얼 연동
    applyOriginMatrix();
    renderRecipeBoard();
  } catch (err) {
    console.error("초기화 중 오류 발생:", err);
  }
});

function showMasterInput() {
  const btnShow = document.getElementById("btn-show-master");
  const codeZone = document.getElementById("master-code-zone");
  const codeInput = document.getElementById("master-code-input");
  if (btnShow) btnShow.style.display = "none";
  if (codeZone) codeZone.style.display = "block";
  if (codeInput) codeInput.focus();
}

function enterWithUrlName() {
  completeLogin(false, currentUserName);
}

function loginGuestManual() {
  const nameInput = document.getElementById("guest-name-input");
  const inputVal = nameInput ? nameInput.value.trim() : "";
  if (!inputVal) {
    alert("방문자 성함을 입력해 주세요.");
    if (nameInput) nameInput.focus();
    return;
  }
  completeLogin(false, inputVal);
}

function loginMaster() {
  const codeInput = document.getElementById("master-code-input");
  const code = codeInput ? codeInput.value.trim() : "";
  // 마스터 보안 코드 (7777)
  const _realMasterKey = String.fromCharCode(55, 55, 55, 55);
  if (code !== _realMasterKey) {
    alert("마스터 입장 코드가 올바르지 않습니다.");
    if (codeInput) {
      codeInput.value = "";
      codeInput.focus();
    }
    return;
  }
  completeLogin(true, "오찬욱");
}

function completeLogin(masterFlag, nameStr) {
  isMaster = masterFlag;
  currentUserName = isMaster ? "오찬욱" : nameStr;

  const authOverlay = document.getElementById("authOverlay");
  const mainContainer = document.getElementById("mainContainer");
  if (authOverlay) authOverlay.style.display = "none";
  if (mainContainer) mainContainer.style.display = "block";

  const roleBadge = document.getElementById("user-role-badge");
  const headerTitle = document.getElementById("header-barista-title");
  const subTitle = document.getElementById("welcome-subtitle");
  const boardTitle = document.getElementById("recipe-board-title");
  const fileInfo = document.getElementById("excel-file-info");
  const inviteBtn = document.getElementById("btn-invite-link");

  if (isMaster) {
    if (roleBadge) {
      roleBadge.textContent = "👑 마스터 모드";
      roleBadge.className = "role-badge badge-master";
    }
    if (headerTitle) headerTitle.textContent = "오찬욱 바리스타 마스터 다이얼러";
    if (subTitle) subTitle.textContent = "오찬욱 바리스타님, 환영합니다! 모든 사용자의 레시피를 열람하고 지인 초대 링크를 만들 수 있습니다.";
    if (inviteBtn) inviteBtn.style.display = "inline-block";
    if (boardTitle) boardTitle.textContent = "👑 마스터 통합 레시피 보관함 (전체 사용자 열람)";
    if (fileInfo) fileInfo.textContent = "저장 시 [마스터_오찬욱_기본레시피.csv] 단일 파일에 누적 강제 저장됩니다.";
  } else {
    if (roleBadge) {
      roleBadge.textContent = `☕ ${currentUserName} 바리스타`;
      roleBadge.className = "role-badge badge-guest";
    }
    if (headerTitle) headerTitle.textContent = `${currentUserName} 님의 브루잉 다이얼러`;
    if (subTitle) subTitle.textContent = `${currentUserName} 님, 환영합니다! 드리퍼에 [${currentUserName} 바리스타] 전용 명패가 각인되었습니다.`;
    if (inviteBtn) inviteBtn.style.display = "none";
    if (boardTitle) boardTitle.textContent = `📔 ${currentUserName} 님의 전용 레시피 보관함`;
    if (fileInfo) fileInfo.textContent = `저장 시 [개별링크_${currentUserName}_기본레시피.csv] 단일 파일에 누적 강제 저장됩니다.`;
  }

  applyOriginMatrix();
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
  prompt(`아래 개별 초대 링크가 생성되었습니다! 복사해서 지인께 전달해 주세요:\n(접속 시 첫 화면에 "${friendName.trim()} 님, 환영합니다!"가 표시됩니다)`, inviteUrl);
}

// ============================================================================
// 3. 셀렉트 박스 및 UI 동적 채우기
// ============================================================================
function populateOriginSelect() {
  const selectEl = document.getElementById("origin-select");
  if (!selectEl) return;
  selectEl.innerHTML = "";

  const db = window.ORIGIN_DB || {};
  Object.keys(db).forEach(key => {
    const bean = db[key];
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = bean.name;
    selectEl.appendChild(opt);
  });
}

function populateGrinderSelect() {
  const selectEl = document.getElementById("grinder-select");
  if (!selectEl) return;
  selectEl.innerHTML = "";

  const grinders = window.COFFEE_GRINDERS || [];
  grinders.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name;
    if (g.id === "feima_600n") opt.selected = true;
    selectEl.appendChild(opt);
  });
  // 초기 그라인더 정보 반영
  onGrinderChange();
}

function populatePresetSelect() {
  const selectEl = document.getElementById("preset-select");
  if (!selectEl) return;

  const presets = window.BARISTA_PRESETS || [];
  presets.forEach(p => {
    const exists = Array.from(selectEl.options).some(opt => opt.value === p.id);
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `🧑‍🍳 [바리스타 프리셋] ${p.baristaName} — ${p.recipeName} (${p.coffeeDose}g:${p.waterAmount}g)`;
      selectEl.appendChild(opt);
    }
  });
}

// ============================================================================
// 4. 조작 패널 관리 (직접 입력, 막대 슬라이더, 🔒 잠금 시스템)
// ============================================================================
function toggleLock(field) {
  if (isAllLocked) return;
  lockStates[field] = !lockStates[field];
  
  const box = document.getElementById("box-" + field);
  const btn = document.getElementById("lock-" + field);
  const input = document.getElementById(field + "-num");
  const slider = document.getElementById(field);
  const minusBtn = document.getElementById("minus-" + field);
  const plusBtn = document.getElementById("plus-" + field);

  if (box) box.classList.toggle("is-locked", lockStates[field]);
  if (btn) {
    btn.textContent = lockStates[field] ? "🔒 잠김" : "🔓 고정";
    btn.classList.toggle("locked", lockStates[field]);
  }
  if (input) input.disabled = lockStates[field];
  if (slider) slider.disabled = lockStates[field];
  if (minusBtn) minusBtn.disabled = lockStates[field];
  if (plusBtn) plusBtn.disabled = lockStates[field];
}

function toggleLockAll() {
  isAllLocked = !isAllLocked;
  const btnAll = document.getElementById("btn-lock-all");
  if (btnAll) {
    btnAll.textContent = isAllLocked ? "🔒 전체 세팅 잠김 해제" : "🔓 전체 세팅 고정하기";
    btnAll.classList.toggle("locked", isAllLocked);
  }

  const fields = ["dose", "water", "temp", "time", "grinder", "grind"];
  fields.forEach(f => {
    lockStates[f] = isAllLocked;
    const box = document.getElementById("box-" + f);
    const btn = document.getElementById("lock-" + f);
    const input = document.getElementById(f + "-num");
    const slider = document.getElementById(f);
    const minusBtn = document.getElementById("minus-" + f);
    const plusBtn = document.getElementById("plus-" + f);

    if (box) box.classList.toggle("is-locked", isAllLocked);
    if (btn) {
      btn.textContent = isAllLocked ? "🔒 잠김" : "🔓 고정";
      btn.classList.toggle("locked", isAllLocked);
    }
    if (input) input.disabled = isAllLocked;
    if (slider) slider.disabled = isAllLocked;
    if (minusBtn) minusBtn.disabled = isAllLocked;
    if (plusBtn) plusBtn.disabled = isAllLocked;
  });
}

function stepControl(field, delta) {
  if (lockStates[field] || isAllLocked) return;
  const input = document.getElementById(field + "-num");
  const slider = document.getElementById(field);
  if (!input) return;

  let val = parseFloat(input.value) + delta;
  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 1000;
  if (val < min) val = min;
  if (val > max) val = max;

  input.value = val;
  if (slider) slider.value = val;
  updateDial();
}

function onSliderInput(field) {
  if (lockStates[field] || isAllLocked) return;
  const slider = document.getElementById(field);
  const input = document.getElementById(field + "-num");
  if (slider && input) {
    input.value = slider.value;
  }
  updateDial();
}

function onDirectInput(field) {
  if (lockStates[field] || isAllLocked) return;
  const input = document.getElementById(field + "-num");
  const slider = document.getElementById(field);
  if (input && slider) {
    let val = parseFloat(input.value);
    if (isNaN(val)) val = parseFloat(slider.value) || 0;
    slider.value = val;
  }
  updateDial();
}

function stepGrinderDial(delta) {
  if (lockStates["grinder"] || isAllLocked) return;
  const input = document.getElementById("grinder-dial-num");
  if (!input) return;
  let val = parseFloat(input.value) + delta;
  if (val < 0) val = 0;
  input.value = val.toFixed(1);
  updateDial();
}

function onGrinderDialDirectInput() {
  if (lockStates["grinder"] || isAllLocked) return;
  updateDial();
}

function onGrinderChange() {
  const selectEl = document.getElementById("grinder-select");
  if (!selectEl) return;
  const grinderId = selectEl.value;
  const info = window.getGrinderDisplayInfo ? window.getGrinderDisplayInfo(grinderId) : { startVal: 4.5, unit: "다이얼", badgeText: "실사용", shortSummary: "", sourceUrls: [] };

  const dialInput = document.getElementById("grinder-dial-num");
  const unitTxt = document.getElementById("grinder-unit-txt");
  const summaryTxt = document.getElementById("grinder-summary-txt");
  const sourceLink = document.getElementById("grinder-source-link");

  if (dialInput) dialInput.value = info.startVal;
  if (unitTxt) unitTxt.textContent = info.sourceUrls && info.sourceUrls.length > 0 ? "클릭/다이얼" : "눈금";
  if (summaryTxt) summaryTxt.textContent = `${info.badgeText} (${info.shortSummary || ""})`;

  if (sourceLink) {
    if (info.sourceUrls && info.sourceUrls.length > 0) {
      sourceLink.href = info.sourceUrls[0];
      sourceLink.style.display = "inline";
    } else {
      sourceLink.style.display = "none";
    }
  }
  updateDial();
}

// ============================================================================
// 5. 드리퍼 · 원두 · 중량 · 모드 선택 핸들러
// ============================================================================
function selectDripper(dripperKey) {
  currentDripper = dripperKey;
  const d = (window.DRIPPERS || {})[dripperKey];
  if (!d) return;

  document.documentElement.style.setProperty("--theme-color", d.themeColor);
  document.documentElement.style.setProperty("--theme-dark", d.themeDark);
  document.documentElement.style.setProperty("--theme-soft", d.themeSoft);

  const logoBadge = document.getElementById("logo-badge");
  if (logoBadge) logoBadge.textContent = d.badge;

  ["bluebottle", "hario", "kalita"].forEach(k => {
    const card = document.getElementById("card-" + k);
    if (card) card.classList.toggle("active", k === dripperKey);
  });

  applyOriginMatrix();
}

function selectWeightPreset(idx) {
  currentWeightIdx = idx;
  const weights = window.WEIGHTS || [15, 20, 25, 30, 35, 40, 50];
  for (let i = 0; i < weights.length; i++) {
    const btn = document.getElementById("wbtn-" + i);
    if (btn) btn.classList.toggle("active", i === idx);
  }
  applyOriginMatrix();
}

function selectBrewMode(modeKey) {
  currentModeKey = modeKey;
  ["strong", "standard", "light", "bypass"].forEach(m => {
    const btn = document.getElementById("mbtn-" + m);
    if (btn) btn.classList.toggle("active", m === modeKey);
  });

  const presetSel = document.getElementById("preset-select");
  if (presetSel) presetSel.value = "common_mode";

  applyOriginMatrix();
}

function onOriginChange() {
  const presetSel = document.getElementById("preset-select");
  if (presetSel) presetSel.value = "common_mode";
  applyOriginMatrix();
}

function onPresetSelectChange() {
  const presetSel = document.getElementById("preset-select");
  if (!presetSel) return;
  const val = presetSel.value;

  if (val === "common_mode") {
    applyOriginMatrix();
    return;
  }

  const doseNumInput = document.getElementById("dose-num");
  const currentDose = doseNumInput ? doseNumInput.value : 30;
  const scaled = window.getBaristaPresetWithScaling ? window.getBaristaPresetWithScaling(val, currentDose) : null;
  if (!scaled) return;

  const active = scaled.activeRecipe;
  const doseInput = document.getElementById("dose-num");
  const doseSlider = document.getElementById("dose");
  const waterInput = document.getElementById("water-num");
  const waterSlider = document.getElementById("water");
  const tempInput = document.getElementById("temp-num");
  const tempSlider = document.getElementById("temp");
  const timeInput = document.getElementById("time-num");
  const timeSlider = document.getElementById("time");

  if (doseInput && !lockStates["dose"] && !isAllLocked) { doseInput.value = active.coffeeDose; doseSlider.value = active.coffeeDose; }
  if (waterInput && !lockStates["water"] && !isAllLocked) { waterInput.value = active.waterAmount; waterSlider.value = active.waterAmount; }
  if (tempInput && !lockStates["temp"] && !isAllLocked) { tempInput.value = active.temperature.recommendedC; tempSlider.value = active.temperature.recommendedC; }
  if (timeInput && !lockStates["time"] && !isAllLocked) { timeInput.value = active.targetTime.targetSec; timeSlider.value = active.targetTime.targetSec; }

  const diagTitle = document.getElementById("diag-title");
  const diagDesc = document.getElementById("diag-desc");
  const sourceLink = document.getElementById("recipe-source-link");

  if (diagTitle) diagTitle.textContent = `[바리스타 프리셋] ${scaled.baristaName} — ${scaled.recipeName}`;
  if (diagDesc) diagDesc.textContent = scaled.scalingNotice;
  if (sourceLink && scaled.sourceUrl) {
    sourceLink.href = scaled.sourceUrl;
    sourceLink.style.display = "inline";
  }

  updateDial();
}

function applyOriginMatrix() {
  const selectEl = document.getElementById("origin-select");
  const originKey = selectEl ? selectEl.value : "geisha";
  const origin = (window.ORIGIN_DB || {})[originKey];
  if (!origin) return;

  const weights = window.WEIGHTS || [15, 20, 25, 30, 35, 40, 50];
  const dose = weights[currentWeightIdx] || 30;
  const waterRes = window.calculateBrewModeWater ? window.calculateBrewModeWater(dose, currentModeKey) : { totalInputWaterG: dose * 16 };
  
  const doseInput = document.getElementById("dose-num");
  const doseSlider = document.getElementById("dose");
  const waterInput = document.getElementById("water-num");
  const waterSlider = document.getElementById("water");
  const tempInput = document.getElementById("temp-num");
  const tempSlider = document.getElementById("temp");
  const timeInput = document.getElementById("time-num");
  const timeSlider = document.getElementById("time");

  if (doseInput && !lockStates["dose"] && !isAllLocked) { doseInput.value = dose; doseSlider.value = dose; }
  if (waterInput && !lockStates["water"] && !isAllLocked) { waterInput.value = waterRes.totalInputWaterG; waterSlider.value = waterRes.totalInputWaterG; }
  if (tempInput && !lockStates["temp"] && !isAllLocked) { tempInput.value = origin.temp; tempSlider.value = origin.temp; }

  const defaultTimes = origin.times || [150, 170, 190, 210, 225, 240, 265];
  const recTime = defaultTimes[currentWeightIdx] || 210;
  if (timeInput && !lockStates["time"] && !isAllLocked) { timeInput.value = recTime; timeSlider.value = recTime; }

  const diagTitle = document.getElementById("diag-title");
  const diagDesc = document.getElementById("diag-desc");
  const sourceLink = document.getElementById("recipe-source-link");
  const tempRangeHint = document.getElementById("temp-range-hint");

  if (diagTitle) diagTitle.textContent = `[${origin.name}]`;
  if (diagDesc) diagDesc.textContent = origin.note;
  if (tempRangeHint && origin.recommendedTempRangeC) {
    tempRangeHint.textContent = `권장 ${origin.recommendedTempRangeC[0]}~${origin.recommendedTempRangeC[1]}°C`;
  }

  if (sourceLink && origin.sourceUrls && origin.sourceUrls.length > 0) {
    sourceLink.href = origin.sourceUrls[0];
    sourceLink.style.display = "inline";
  }

  updateDial();
}

// ============================================================================
// 6. 다이얼 연산, 차트 2종 및 실측 TDS·EY 연동
// ============================================================================
function formatSecToKorean(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}분 ${s < 10 ? "0" + s : s}초 (${Math.round(sec)}초)`;
}

function formatMMSS(sec) {
  const absSec = Math.floor(Math.abs(sec));
  const m = Math.floor(absSec / 60);
  const s = absSec % 60;
  const sign = sec < 0 ? "-" : "";
  return `${sign}${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
}

function updateDial() {
  const d = (window.DRIPPERS || {})[currentDripper] || { grindOffset: 0, timeOffset: 0, retention: 2.0, acidityBias: 1.0, sweetBias: 1.12, bodyBias: 1.05, themeColor: "#00a1e4", themeDark: "#0077ac" };
  const dose = parseFloat(document.getElementById("dose-num").value) || 30;
  const water = parseFloat(document.getElementById("water-num").value) || 480;
  const time = parseFloat(document.getElementById("time-num").value) || 210;
  const grind = parseFloat(document.getElementById("grind-num").value) || 780;
  const ratio = water / dose;

  const doseLabel = document.getElementById("dose-label");
  const waterLabel = document.getElementById("water-label");
  const tempLabel = document.getElementById("temp-label");
  const timeLabel = document.getElementById("time-label");
  const grindLabel = document.getElementById("grind-label");
  const tempNumInput = document.getElementById("temp-num");

  if (doseLabel) doseLabel.textContent = `${dose}g`;
  if (waterLabel) waterLabel.textContent = `${water}g (1:${ratio.toFixed(1)})`;
  if (tempLabel && tempNumInput) tempLabel.textContent = `${parseFloat(tempNumInput.value || 95).toFixed(1)}°C`;
  if (timeLabel) timeLabel.textContent = formatSecToKorean(time);
  if (grindLabel) grindLabel.textContent = `${grind}`;

  // KPI 물 투입량 표시 갱신
  const kpiWaterVal = document.getElementById("kpi-water-val");
  const kpiWaterSub = document.getElementById("kpi-water-sub");
  const kpiWaterBadge = document.getElementById("kpi-water-badge");

  if (kpiWaterVal) kpiWaterVal.textContent = `${water}g 투입`;
  if (kpiWaterSub) {
    if (currentModeKey === "bypass") {
      const wRes = window.calculateBrewModeWater ? window.calculateBrewModeWater(dose, "bypass") : { dripperInputWaterG: 360, bypassHotWaterG: 120 };
      kpiWaterSub.textContent = `바이패스: 드리퍼 ${wRes.dripperInputWaterG}g + 서버온수 ${wRes.bypassHotWaterG}g`;
      if (kpiWaterBadge) kpiWaterBadge.textContent = "바이패스";
    } else {
      const modeObj = (window.BREW_MODES || {})[currentModeKey] || { shortName: "표준" };
      kpiWaterSub.textContent = `모드: ${modeObj.shortName} (비율 1:${ratio.toFixed(1)})`;
      if (kpiWaterBadge) kpiWaterBadge.textContent = modeObj.shortName;
    }
  }

  // 실측 TDS 및 음료 무게 계산 확인
  const measuredTdsInput = document.getElementById("measured-tds");
  const measuredBevInput = document.getElementById("measured-bev");
  const measuredEyResult = document.getElementById("measured-ey-result");
  const eyVal = document.getElementById("ey-val");
  const eyBadge = document.getElementById("ey-badge");

  const tdsVal = measuredTdsInput ? measuredTdsInput.value : null;
  const bevVal = measuredBevInput ? measuredBevInput.value : null;
  const measured = window.calculateMeasuredBrewMetrics ? window.calculateMeasuredBrewMetrics(dose, tdsVal, bevVal) : { isMeasured: false };

  let eyDisp = 19.8;
  let tdsDisp = 1.32;

  if (measured.isMeasured) {
    eyDisp = measured.calculatedEY_percent;
    tdsDisp = measured.measuredTDS_percent;
    if (measuredEyResult) measuredEyResult.textContent = `[실측 반영] EY: ${eyDisp}% · TDS: ${tdsDisp}%`;
    if (eyBadge) {
      eyBadge.textContent = measured.withinGoldenCupEY ? "골든컵 수율" : "수율 재조정 필요";
      eyBadge.className = measured.withinGoldenCupEY ? "badge badge-good" : "badge badge-warn";
    }
  } else {
    const baseGrind = 780 + d.grindOffset + (dose - 30) * 4.5;
    const grindFactor = Math.pow(baseGrind / grind, 0.7);
    eyDisp = Math.max(12.0, Math.min(26.0, 20.0 * grindFactor));
    const beverageWeight = Math.max(50, water - dose * d.retention);
    tdsDisp = (dose * (eyDisp / 100.0) / beverageWeight) * 100.0;

    if (measuredEyResult) measuredEyResult.textContent = "미입력 시 교육용 추정치 표시";
    if (eyBadge) { eyBadge.textContent = "미측정 추정치"; eyBadge.className = "badge badge-warn"; }
  }

  if (eyVal) eyVal.textContent = `EY ~${eyDisp.toFixed(1)}% · TDS ~${tdsDisp.toFixed(2)}%`;

  // 향미 밸런스 비율 계산
  const balanceIndex = Math.max(-100, Math.min(100, (eyDisp - 20.0) * 16.5));
  const sourRaw = Math.max(6, (48 - (eyDisp - 16.5) * 7.0) * d.acidityBias);
  const sweetRaw = Math.max(8, (62 - Math.pow(eyDisp - 20.0, 2) * 4.5) * d.sweetBias);
  const bitterRaw = Math.max(6, (18 + (eyDisp - 17.5) * 7.5) * d.bodyBias);
  const sumFlavor = sourRaw + sweetRaw + bitterRaw;
  const sourPct = Math.round((sourRaw / sumFlavor) * 100);
  const sweetPct = Math.round((sweetRaw / sumFlavor) * 100);
  const bitterPct = 100 - sourPct - sweetPct;

  const pointerPos = Math.max(4, Math.min(96, 50 + balanceIndex * 0.45));
  const balancePointer = document.getElementById("balance-pointer");
  const sourEl = document.getElementById("sour-pct");
  const sweetEl = document.getElementById("sweet-pct");
  const bitterEl = document.getElementById("bitter-pct");

  if (balancePointer) balancePointer.style.left = `${pointerPos}%`;
  if (sourEl) sourEl.textContent = `${sourPct}%`;
  if (sweetEl) sweetEl.textContent = `${sweetPct}%`;
  if (bitterEl) bitterEl.textContent = `${bitterPct}%`;

  drawTimeChart(time, eyDisp, d.themeColor);
  drawScaChart(eyDisp, tdsDisp, d.themeColor, d.themeDark);
}

// ----------------------------------------------------------------------------
// 차트 1: 시간별 용출 차트
// ----------------------------------------------------------------------------
function drawTimeChart(targetTime, finalEy, themeColor) {
  const canvas = document.getElementById("timeChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 36, padR = 20, padT = 20, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxT = 300;

  ctx.strokeStyle = "#e9ecef";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (plotH / 4) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
  }

  ctx.fillStyle = "#868e96"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
  [0, 60, 120, 180, 240, 300].forEach(sec => {
    ctx.fillText(`${sec}s`, padL + (sec / maxT) * plotW, H - 8);
  });

  const curves = [
    { color: "#f59f00", fn: t => (t > 10 ? Math.pow((t - 10) / 45, 1.4) * Math.exp(-(t - 10) / 45) : 0) * 1.8 },
    { color: "#37b24d", fn: t => (t > 28 ? Math.pow((t - 28) / 95, 2.0) * Math.exp(-(t - 28) / 60) : 0) * 1.45 },
    { color: "#7950f2", fn: t => (1 / (1 + Math.exp(-(t - 170) / 35))) * 0.82 }
  ];

  curves.forEach(c => {
    ctx.beginPath(); ctx.strokeStyle = c.color; ctx.lineWidth = 2;
    for (let t = 0; t <= maxT; t += 5) {
      const x = padL + (t / maxT) * plotW;
      const y = padT + plotH - Math.min(plotH, c.fn(t) * plotH * 0.85);
      t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  ctx.beginPath(); ctx.strokeStyle = "#212529"; ctx.lineWidth = 2;
  const tau = 110;
  const asymEy = finalEy / (1 - Math.exp(-targetTime / tau));
  for (let t = 0; t <= maxT; t += 5) {
    const x = padL + (t / maxT) * plotW;
    const curEy = t < 15 ? (t / 15) * 2.0 : Math.min(27, asymEy * (1 - Math.exp(-t / tau)));
    const y = padT + plotH - (curEy / 28.0) * plotH;
    t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  const tx = padL + (Math.min(maxT, targetTime) / maxT) * plotW;
  ctx.beginPath(); ctx.setLineDash([4, 4]); ctx.strokeStyle = themeColor; ctx.lineWidth = 2;
  ctx.moveTo(tx, padT); ctx.lineTo(tx, padT + plotH); ctx.stroke();
  ctx.setLineDash([]);
}

// ----------------------------------------------------------------------------
// 차트 2: SCA 골든컵 컨트롤 차트
// ----------------------------------------------------------------------------
function drawScaChart(ey, tds, themeColor, themeDark) {
  const canvas = document.getElementById("scaChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 36, padR = 16, padT = 18, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const minEy = 14, maxEy = 26, minTds = 0.8, maxTds = 2.0;

  ctx.fillStyle = "#868e96"; ctx.font = "9.5px sans-serif"; ctx.textAlign = "center";
  [14, 16, 18, 20, 22, 24, 26].forEach(val => {
    const x = padL + ((val - minEy) / (maxEy - minEy)) * plotW;
    ctx.fillText(`${val}%`, x, H - 8);
    ctx.strokeStyle = "#f1f3f5"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
  });

  ctx.textAlign = "right";
  [0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0].forEach(val => {
    const y = padT + plotH - ((val - minTds) / (maxTds - minTds)) * plotH;
    ctx.fillText(`${val.toFixed(1)}%`, padL - 4, y + 3);
    ctx.strokeStyle = "#f1f3f5"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
  });

  const gx1 = padL + ((18.0 - minEy) / (maxEy - minEy)) * plotW;
  const gx2 = padL + ((22.0 - minEy) / (maxEy - minEy)) * plotW;
  const gy1 = padT + plotH - ((1.35 - minTds) / (maxTds - minTds)) * plotH;
  const gy2 = padT + plotH - ((1.15 - minTds) / (maxTds - minTds)) * plotH;

  ctx.fillStyle = "rgba(0, 161, 228, 0.16)";
  ctx.fillRect(gx1, gy1, gx2 - gx1, gy2 - gy1);
  ctx.strokeStyle = themeColor; ctx.lineWidth = 2;
  ctx.strokeRect(gx1, gy1, gx2 - gx1, gy2 - gy1);

  ctx.fillStyle = themeDark; ctx.font = "bold 10.5px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("SCA Golden Cup Target", (gx1 + gx2) / 2, (gy1 + gy2) / 2 + 4);

  const curX = padL + ((Math.max(minEy, Math.min(maxEy, ey)) - minEy) / (maxEy - minEy)) * plotW;
  const curY = padT + plotH - ((Math.max(minTds, Math.min(maxTds, tds)) - minTds) / (maxTds - minTds)) * plotH;

  ctx.beginPath(); ctx.fillStyle = "#e03131";
  ctx.arc(curX, curY, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = "#212529"; ctx.font = "bold 10px monospace"; ctx.textAlign = "left";
  ctx.fillText(`(${ey.toFixed(1)}%, ${tds.toFixed(2)}%)`, curX + 9, curY + 3);
}

// ============================================================================
// 7. 앱 내부 누적 저장 + 단일 엑셀(.csv) 강제 저장 및 백업·복원 시스템
// ============================================================================
const STORAGE_KEY = "ohBaristaCumulativeRecipesDB_v3";

function getStoredRecipes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function setStoredRecipes(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function getRecommendedRecipeName() {
  const selectEl = document.getElementById("origin-select");
  const originKey = selectEl ? selectEl.value : "geisha";
  const bean = (window.ORIGIN_DB || {})[originKey];
  const beanShort = bean ? bean.name.split(" (")[0] : "원두";
  const dripShort = window.DRIPPERS[currentDripper].name;
  const dose = document.getElementById("dose-num").value;
  const temp = document.getElementById("temp-num").value;
  const now = new Date();
  return `${beanShort}_${dripShort}_${dose}g_${temp}℃ (${now.getMonth() + 1}/${now.getDate()})`;
}

function saveCurrentRecipe() {
  const defaultName = getRecommendedRecipeName();
  const nameInput = prompt("저장할 레시피 이름을 확인해 주세요 (기본 추천 이름 자동 입력):", defaultName);
  if (!nameInput) return;

  const reviewInput = prompt("커피 맛이나 향미 특징을 한 줄로 남겨주세요:", "산미와 단맛의 밸런스가 아주 좋음");
  const dose = parseFloat(document.getElementById("dose-num").value) || 30;
  const water = parseFloat(document.getElementById("water-num").value) || 480;
  const temp = parseFloat(document.getElementById("temp-num").value) || 95.0;
  const time = parseFloat(document.getElementById("time-num").value) || 210;
  const grind = parseFloat(document.getElementById("grind-num").value) || 780;
  const selectEl = document.getElementById("origin-select");
  const originKey = selectEl ? selectEl.value : "geisha";

  const newEntry = {
    id: Date.now(),
    date: new Date().toLocaleString("ko-KR"),
    roleCode: isMaster ? "MASTER_오찬욱" : `GUEST_${currentUserName}`,
    author: currentUserName,
    name: nameInput.trim(),
    dripper: currentDripper,
    origin: originKey,
    dose: dose,
    grind: grind,
    temp: temp,
    time: time,
    water: water,
    ey: document.getElementById("ey-val").textContent,
    review: (reviewInput && reviewInput.trim()) ? reviewInput.trim() : "최고의 세팅"
  };

  const list = getStoredRecipes();
  list.unshift(newEntry);
  setStoredRecipes(list);
  renderRecipeBoard();
  downloadExcelFile("default");
}

function getVisibleRecipes() {
  const all = getStoredRecipes();
  return isMaster ? all : all.filter(r => r.author === currentUserName);
}

function downloadExcelFile(mode) {
  const targetList = getVisibleRecipes();
  if (targetList.length === 0) {
    alert("저장된 레시피 데이터가 없습니다.");
    return;
  }

  const headers = ["고유ID", "저장일시", "구분코드", "작성자", "레시피이름", "드리퍼", "산지키", "원두량(g)", "분쇄지수", "물온도(℃)", "추출시간(초)", "물의양(g)", "수율정보", "맛한줄평"];
  const escapeCsv = val => `"${String(val ?? "").replace(/"/g, '""')}"`;

  const rows = targetList.map(r => [
    r.id, r.date, r.roleCode, r.author, r.name, r.dripper, r.origin,
    r.dose, r.grind, r.temp, r.time, r.water, r.ey, r.review
  ].map(escapeCsv).join(","));

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let fileName = mode === "default"
    ? (isMaster ? "마스터_오찬욱_기본레시피.csv" : `개별링크_${currentUserName}_기본레시피.csv`)
    : (isMaster ? `마스터_오찬욱_백업레시피_${today}.csv` : `개별링크_${currentUserName}_백업레시피_${today}.csv`);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerExcelUpload(mode) {
  uploadMode = mode;
  const fileInput = document.getElementById("excel-file-input");
  if (fileInput) { fileInput.value = ""; fileInput.click(); }
}

function parseCsvLine(line) {
  const result = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function handleExcelFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result.replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
    if (lines.length < 2) {
      alert("유효한 레시피 데이터가 없는 파일입니다.");
      return;
    }

    const existing = getStoredRecipes();
    const existingIds = new Set(existing.map(x => String(x.id)));
    let addedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 10) continue;

      const item = {
        id: Number(cols[0]) || (Date.now() + i),
        date: cols[1] || "",
        roleCode: cols[2] || "",
        author: cols[3] || currentUserName,
        name: cols[4] || "복원된 레시피",
        dripper: window.DRIPPERS[cols[5]] ? cols[5] : "bluebottle",
        origin: (window.ORIGIN_DB || {})[cols[6]] ? cols[6] : "geisha",
        dose: parseFloat(cols[7]) || 30,
        grind: parseFloat(cols[8]) || 780,
        temp: parseFloat(cols[9]) || 95.0,
        time: parseFloat(cols[10]) || 210,
        water: parseFloat(cols[11]) || 480,
        ey: cols[12] || "EY ~19.8%",
        review: cols[13] || ""
      };

      if (!existingIds.has(String(item.id))) {
        existing.push(item);
        existingIds.add(String(item.id));
        addedCount++;
      }
    }

    existing.sort((a, b) => b.id - a.id);
    setStoredRecipes(existing);
    renderRecipeBoard();
    alert(`엑셀 파일에서 새로운 레시피 ${addedCount}건을 성공적으로 복원했습니다!`);
  };
  reader.readAsText(file, "utf-8");
}

function renderRecipeBoard() {
  const visible = getVisibleRecipes();
  const grid = document.getElementById("recipe-grid");
  if (!grid) return;

  if (visible.length === 0) {
    grid.innerHTML = '<div style="color:#868e96; font-size:12px; padding:10px;">저장된 레시피가 없습니다. [⭐ 세팅 저장 (+엑셀)] 버튼을 눌러보세요!</div>';
    return;
  }

  grid.innerHTML = visible.map(r => `
    <div class="recipe-card">
      <div style="font-weight:900; font-size:13px; margin-bottom:3px; color:var(--text-main);">${r.name}</div>
      <div style="font-size:11px; color:#495057; line-height:1.4;">
        • <b>원두/물:</b> ${r.dose}g / ${r.water}g (${r.temp}°C)<br/>
        • <b>추출:</b> ${formatSecToKorean(r.time)} · ${r.ey}<br/>
        • <b>메모:</b> <span style="color:#d9480f; font-weight:700;">"${r.review}"</span>
      </div>
      <button class="excel-btn load1" style="width:100%; margin-top:6px; padding:4px;" onclick="loadRecipeToDial(${r.id})">🔄 이 세팅으로 불러오기</button>
    </div>
  `).join("");
}

function loadRecipeToDial(id) {
  const all = getStoredRecipes();
  const r = all.find(x => x.id === id);
  if (!r) return;

  const originSel = document.getElementById("origin-select");
  if (originSel && (window.ORIGIN_DB || {})[r.origin]) originSel.value = r.origin;
  selectDripper(r.dripper || "bluebottle");

  const doseInput = document.getElementById("dose-num");
  const doseSlider = document.getElementById("dose");
  const waterInput = document.getElementById("water-num");
  const waterSlider = document.getElementById("water");
  const tempInput = document.getElementById("temp-num");
  const tempSlider = document.getElementById("temp");
  const timeInput = document.getElementById("time-num");
  const timeSlider = document.getElementById("time");
  const grindInput = document.getElementById("grind-num");
  const grindSlider = document.getElementById("grind");

  if (doseInput) { doseInput.value = r.dose; doseSlider.value = r.dose; }
  if (waterInput) { waterInput.value = r.water; waterSlider.value = r.water; }
  if (tempInput) { tempInput.value = r.temp; tempSlider.value = r.temp; }
  if (timeInput) { timeInput.value = r.time; timeSlider.value = r.time; }
  if (grindInput) { grindInput.value = r.grind; grindSlider.value = r.grind; }

  updateDial();
  const details = document.getElementById("recipe-board-details");
  if (details) details.open = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================================
// 9. 3D 실사 추출 애니메이션 & 음성·ASMR 사운드 엔진
// ============================================================================
let audioCtx = null;
let pourNoiseNode = null;
let pourGainNode = null;
let isPourSoundPlaying = false;
let soundEnabled = true;

let brewRunning = false;
let brewElapsed = -10.0;
let brewLastTick = 0;
let brewAnimReq = null;
let pourStages = [];
let lastBeepSec = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  if (audioCtx && !pourGainNode) {
    setupPouringSoundEngine();
  }
}

function setupPouringSoundEngine() {
  const bufferSize = audioCtx.sampleRate * 2;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    output[i] = (lastOut + (0.04 * white)) / 1.04;
    lastOut = output[i];
    output[i] *= 3.0;
  }

  pourNoiseNode = audioCtx.createBufferSource();
  pourNoiseNode.buffer = noiseBuffer;
  pourNoiseNode.loop = true;

  const bandpass = audioCtx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 720;
  bandpass.Q.value = 1.6;

  const lfo = audioCtx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 5.5;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 220;
  lfo.connect(bandpass.frequency);
  lfo.start();

  pourGainNode = audioCtx.createGain();
  pourGainNode.gain.value = 0.0001;

  pourNoiseNode.connect(bandpass);
  bandpass.connect(pourGainNode);
  pourGainNode.connect(audioCtx.destination);
  pourNoiseNode.start();
}

function setPouringWaterSound(active) {
  if (!audioCtx || !pourGainNode) return;
  const shouldPlay = active && soundEnabled && brewRunning;
  if (shouldPlay && !isPourSoundPlaying) {
    isPourSoundPlaying = true;
    pourGainNode.gain.setTargetAtTime(0.085, audioCtx.currentTime, 0.15);
  } else if (!shouldPlay && isPourSoundPlaying) {
    isPourSoundPlaying = false;
    pourGainNode.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.1);
  }
}

function playStageAlarm(alarmType, stageIndex = 1) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  if (alarmType === "countdown") {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  } else if (alarmType === "prep_start") {
    [440, 554.37].forEach((f, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, now + idx * 0.14);
      gain.gain.setValueAtTime(0.2, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.38);
    });
  } else if (alarmType === "pour_start") {
    const pitchShift = Math.pow(1.06, stageIndex - 1);
    const notes = [523.25 * pitchShift, 659.25 * pitchShift, 783.99 * pitchShift];
    notes.forEach((f, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + idx * 0.11);
      gain.gain.setValueAtTime(0.24, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.38);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.4);
    });
  } else if (alarmType === "wait_start") {
    const notes = [783.99, 523.25];
    notes.forEach((f, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, now + idx * 0.16);
      gain.gain.setValueAtTime(0.22, now + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.42);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.45);
    });
  } else if (alarmType === "finish") {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + idx * 0.13);
      gain.gain.setValueAtTime(0.25, now + idx * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.13 + 0.55);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + idx * 0.13);
      osc.stop(now + idx * 0.13 + 0.58);
    });
  }
}

function speakGuide(text, totalTimeSec, alarmType, stageIndex = 1) {
  if (!soundEnabled || !text) return;
  playStageAlarm(alarmType, stageIndex);
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ko-KR";
    utter.rate = totalTimeSec <= 120 ? 1.16 : (totalTimeSec <= 180 ? 1.08 : 1.02);
    window.speechSynthesis.speak(utter);
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById("btn-sound-toggle");
  if (btn) btn.textContent = soundEnabled ? "🔊 소리 켜짐" : "🔇 소리 꺼짐";
  if (!soundEnabled) {
    setPouringWaterSound(false);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
}

function buildPourStages() {
  const dose = parseFloat(document.getElementById("dose-num").value) || 30;
  const water = parseFloat(document.getElementById("water-num").value) || 480;
  const totalTime = parseFloat(document.getElementById("time-num").value) || 210;

  let w1 = Math.min(Math.round(water * 0.24), Math.round(dose * 2.2));
  let w2 = Math.round(water * 0.45);
  let w3 = Math.round(water * 0.74);
  let w4 = water;

  if (currentModeKey === "bypass") {
    const bRes = window.calculateBrewModeWater(dose, "bypass");
    w4 = bRes.dripperInputWaterG;
    w1 = Math.min(Math.round(w4 * 0.3), Math.round(dose * 2.2));
    w2 = Math.round(w4 * 0.6);
    w3 = Math.round(w4 * 0.85);
  }

  const add1 = w1;
  const add2 = w2 - w1;
  const add3 = w3 - w2;
  const add4 = w4 - w3;

  const t1 = 0;
  const t2 = Math.min(40, Math.round(totalTime * 0.20));
  const t3 = Math.round(totalTime * 0.44);
  const t4 = Math.round(totalTime * 0.68);

  const p1 = Math.max(8, Math.round((t2 - t1) * 0.45));
  const p2 = Math.max(10, Math.round((t3 - t2) * 0.52));
  const p3 = Math.max(10, Math.round((t4 - t3) * 0.52));
  const p4 = Math.max(10, Math.round((totalTime - t4) * 0.45));

  const bypassNoticeText = currentModeKey === "bypass"
    ? ` (※ 바이패스 모드: 드리퍼 추출 ${w4}g 완료 후 서버에 온수 ${Math.round(water - w4)}g 추가)`
    : "";

  const msg = {
    prep: `${currentUserName} 바리스타님, 저울을 확인하세요. 10초 후 추출을 시작합니다.`,
    s1_start: `뜸들이기입니다. 중심부터 물 ${add1}그램을 ${p1}초 안에 부으세요.`,
    s1_mid: `물 붓기를 멈추고 1차 추출까지 기다리세요.`,
    s2_start: `1차 추출입니다. 물 ${add2}그램을 추가해 저울 기준 ${w2}그램까지 부으세요.`,
    s2_mid: `물 붓기를 멈추고 2차 추출까지 기다리세요.`,
    s3_start: `2차 추출입니다. 물 ${add3}그램을 추가해 저울 기준 ${w3}그램까지 부으세요.`,
    s3_mid: `물 붓기를 멈추고 마지막 추출까지 기다리세요.`,
    s4_start: `마지막 추출입니다. 남은 물 ${add4}그램을 부어 드리퍼 기준 ${w4}그램을 맞춰주세요.`,
    s4_mid: `물 붓기를 멈추고 주전자를 내려놓으세요.`,
    finish: `추출이 모두 끝났습니다. 이제 드리퍼를 치워주세요.${bypassNoticeText} 정성껏 내린 커피가 완성되었습니다.`
  };

  pourStages = [
    {
      id: "prep",
      name: "0. 추출 준비 (10초 카운트다운)",
      startSec: -10,
      pourEndSec: 0,
      endSec: 0,
      startWater: 0,
      targetWater: 0,
      addWater: 0,
      voiceStart: msg.prep,
      voiceMid: null,
      spokenStart: false,
      spokenMid: false
    },
    {
      id: "bloom",
      name: "1) 뜸들이기",
      startSec: t1,
      pourEndSec: t1 + p1,
      endSec: t2,
      startWater: 0,
      targetWater: w1,
      addWater: add1,
      voiceStart: msg.s1_start,
      voiceMid: msg.s1_mid,
      spokenStart: false,
      spokenMid: false
    },
    {
      id: "pour1",
      name: "2) 1차 추출",
      startSec: t2,
      pourEndSec: t2 + p2,
      endSec: t3,
      startWater: w1,
      targetWater: w2,
      addWater: add2,
      voiceStart: msg.s2_start,
      voiceMid: msg.s2_mid,
      spokenStart: false,
      spokenMid: false
    },
    {
      id: "pour2",
      name: "3) 2차 추출",
      startSec: t3,
      pourEndSec: t3 + p3,
      endSec: t4,
      startWater: w2,
      targetWater: w3,
      addWater: add3,
      voiceStart: msg.s3_start,
      voiceMid: msg.s3_mid,
      spokenStart: false,
      spokenMid: false
    },
    {
      id: "pour3",
      name: "4) 마지막 추출",
      startSec: t4,
      pourEndSec: t4 + p4,
      endSec: totalTime,
      startWater: w3,
      targetWater: w4,
      addWater: add4,
      voiceStart: msg.s4_start,
      voiceMid: msg.s4_mid,
      spokenStart: false,
      spokenMid: false
    }
  ];

  pourStages.finishVoice = msg.finish;
  pourStages.finishSpoken = false;

  const badgeEl = document.getElementById("modal-bypass-badge");
  if (badgeEl) badgeEl.textContent = currentModeKey === "bypass" ? "[바이패스: 서버 온수 추가 대기]" : "";

  const listEl = document.getElementById("schedule-list");
  if (!listEl) return;
  listEl.innerHTML = pourStages.slice(1).map((s, idx) => `
    <div class="schedule-item" id="sched-row-${idx + 1}">
      <div style="font-weight:800; color:var(--theme-dark);">${formatMMSS(s.startSec)} ~ ${formatMMSS(s.endSec)}</div>
      <div>${s.name} <span style="font-size:11px; color:#868e96;">(+${s.addWater}g)</span></div>
      <div style="text-align:right; font-weight:900;">누적 ${s.targetWater}g</div>
    </div>
  `).join("");
}

function openBrewModal() {
  const d = (window.DRIPPERS || {})[currentDripper] || { fullName: "드리퍼" };
  const dose = parseFloat(document.getElementById("dose-num").value) || 30;
  const temp = parseFloat(document.getElementById("temp-num").value) || 95.0;
  const time = parseFloat(document.getElementById("time-num").value) || 210;
  const water = parseFloat(document.getElementById("water-num").value) || 480;

  const modalTitle = document.getElementById("modal-title");
  const modalSub = document.getElementById("modal-subtitle");
  if (modalTitle) modalTitle.textContent = `${currentUserName} 바리스타 3D 브루잉 가이드 (${d.fullName})`;
  if (modalSub) modalSub.textContent = `원두 ${dose}g · 물 투입량 ${water}g · ${temp.toFixed(1)}°C · 목표 시간 ${formatSecToKorean(time)}`;

  buildPourStages();
  resetBrewTimer();
  const modal = document.getElementById("brewModal");
  if (modal) modal.classList.add("open");
}

function closeBrewModal() {
  brewRunning = false;
  setPouringWaterSound(false);
  if (brewAnimReq) cancelAnimationFrame(brewAnimReq);
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  const modal = document.getElementById("brewModal");
  if (modal) modal.classList.remove("open");
}

function syncStartButtonsText(label) {
  const topBtn = document.getElementById("btn-brew-top");
  const botBtn = document.getElementById("btn-brew-bottom");
  if (topBtn) topBtn.textContent = `${label} (상단)`;
  if (botBtn) botBtn.textContent = `${label} (하단)`;
}

function resetBrewTimer() {
  brewRunning = false;
  brewElapsed = -10.0;
  lastBeepSec = null;
  setPouringWaterSound(false);
  if (brewAnimReq) cancelAnimationFrame(brewAnimReq);
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();

  pourStages.forEach(s => { s.spokenStart = false; s.spokenMid = false; });
  pourStages.finishSpoken = false;

  syncStartButtonsText("▶ 추출 시작");
  const banner = document.getElementById("stage-banner");
  if (banner) banner.className = "stage-alert-banner";
  const bTitle = document.getElementById("stage-banner-title");
  const bDesc = document.getElementById("stage-banner-desc");
  if (bTitle) bTitle.textContent = "준비 완료: [▶ 추출 시작]을 눌러주세요";
  if (bDesc) bDesc.textContent = "10초 준비 카운트다운 후 물 붓기와 멈춤 대기를 안내합니다.";

  for (let i = 1; i <= 4; i++) {
    const row = document.getElementById("sched-row-" + i);
    if (row) row.className = "schedule-item";
  }

  draw3DScene(-10, "prep", 0, 0, "추출 대기 중 (-10초 준비)", "상단 또는 하단 [추출 시작]을 누르세요");
}

function toggleBrewTimer() {
  initAudio();
  const totalTime = parseFloat(document.getElementById("time-num").value) || 210;
  if (brewElapsed >= totalTime) {
    resetBrewTimer();
  }

  brewRunning = !brewRunning;
  if (brewRunning) {
    syncStartButtonsText("⏸ 일시정지");
    brewLastTick = performance.now();
    brewLoop(brewLastTick);
  } else {
    setPouringWaterSound(false);
    syncStartButtonsText("▶ 이어서 추출");
  }
}

function brewLoop(now) {
  if (!brewRunning) return;
  const dt = (now - brewLastTick) / 1000;
  brewLastTick = now;
  brewElapsed += dt;

  const totalTime = parseFloat(document.getElementById("time-num").value) || 210;
  const water = parseFloat(document.getElementById("water-num").value) || 480;
  let targetRefWater = water;
  if (currentModeKey === "bypass") {
    const bRes = window.calculateBrewModeWater(parseFloat(document.getElementById("dose-num").value) || 30, "bypass");
    targetRefWater = bRes.dripperInputWaterG;
  }

  if (brewElapsed >= totalTime) {
    brewElapsed = totalTime;
    brewRunning = false;
    setPouringWaterSound(false);
    syncStartButtonsText("↺ 다시 추출");
  }

  if (brewElapsed >= -3.2 && brewElapsed < -0.1) {
    const secInt = Math.ceil(brewElapsed);
    if (secInt !== lastBeepSec) {
      lastBeepSec = secInt;
      playStageAlarm("countdown");
    }
  }

  let activeIdx = 0;
  for (let i = 0; i < pourStages.length; i++) {
    if (brewElapsed >= pourStages[i].startSec) activeIdx = i;
  }
  const curStage = pourStages[activeIdx];

  if (!curStage.spokenStart && brewElapsed < totalTime) {
    curStage.spokenStart = true;
    const alarmKind = activeIdx === 0 ? "prep_start" : "pour_start";
    speakGuide(curStage.voiceStart, totalTime, alarmKind, activeIdx);
  }

  if (activeIdx >= 1 && !curStage.spokenMid && brewElapsed >= curStage.pourEndSec && brewElapsed < curStage.endSec) {
    curStage.spokenMid = true;
    speakGuide(curStage.voiceMid, totalTime, "wait_start", activeIdx);
  }

  let phaseMode = "prep";
  let currentWater = 0;
  let phaseProgress = 0;
  let hudStageTitle = "";
  let hudSubText = "";
  const bannerEl = document.getElementById("stage-banner");

  if (brewElapsed < 0) {
    phaseMode = "prep";
    currentWater = 0;
    phaseProgress = (10 + brewElapsed) / 10;
    setPouringWaterSound(false);
    if (bannerEl) bannerEl.className = "stage-alert-banner";
    hudStageTitle = `⏳ 추출 준비 (${Math.ceil(Math.abs(brewElapsed))}초 전)`;
    hudSubText = "저울 영점 확인 및 주전자를 준비하세요";
    document.getElementById("stage-banner-title").textContent = hudStageTitle;
    document.getElementById("stage-banner-desc").textContent = curStage.voiceStart;
  } else if (brewElapsed >= totalTime) {
    phaseMode = "done";
    currentWater = targetRefWater;
    phaseProgress = 1;
    setPouringWaterSound(false);
    if (bannerEl) bannerEl.className = "stage-alert-banner";
    hudStageTitle = "🎉 추출 완료!";
    hudSubText = pourStages.finishVoice;
    if (!pourStages.finishSpoken) {
      pourStages.finishSpoken = true;
      speakGuide(pourStages.finishVoice, totalTime, "finish", 4);
    }
    document.getElementById("stage-banner-title").textContent = hudStageTitle;
    document.getElementById("stage-banner-desc").textContent = pourStages.finishVoice;
  } else {
    const isPouringNow = brewElapsed >= curStage.startSec && brewElapsed < curStage.pourEndSec;
    if (isPouringNow) {
      phaseMode = "pouring";
      phaseProgress = Math.max(0, Math.min(1, (brewElapsed - curStage.startSec) / Math.max(1, curStage.pourEndSec - curStage.startSec)));
      currentWater = curStage.startWater + (curStage.targetWater - curStage.startWater) * phaseProgress;
      const remainPourSec = Math.ceil(curStage.pourEndSec - brewElapsed);

      setPouringWaterSound(true);
      if (bannerEl) bannerEl.className = "stage-alert-banner pouring-mode";
      hudStageTitle = `💧 [물 붓는 중] ${curStage.name} (${remainPourSec}초)`;
      hudSubText = `목표 ${curStage.targetWater}g까지 부으세요 (현재 ${Math.round(currentWater)}g)`;
      document.getElementById("stage-banner-title").textContent = hudStageTitle;
      document.getElementById("stage-banner-desc").textContent = curStage.voiceStart;
    } else {
      phaseMode = "waiting";
      phaseProgress = Math.max(0, Math.min(1, (brewElapsed - curStage.pourEndSec) / Math.max(1, curStage.endSec - curStage.pourEndSec)));
      currentWater = curStage.targetWater;
      const remainWaitSec = Math.ceil(curStage.endSec - brewElapsed);

      setPouringWaterSound(false);
      if (bannerEl) bannerEl.className = "stage-alert-banner waiting-mode";
      hudStageTitle = `✋ [멈춤·대기 중] 다음 단계까지 ${remainWaitSec}초`;
      hudSubText = `주전자를 내려놓고 대기하세요 (현재 ${curStage.targetWater}g)`;
      document.getElementById("stage-banner-title").textContent = hudStageTitle;
      document.getElementById("stage-banner-desc").textContent = curStage.voiceMid;
    }
  }

  for (let i = 1; i <= 4; i++) {
    const row = document.getElementById("sched-row-" + i);
    if (!row) continue;
    if (brewElapsed >= totalTime || i < activeIdx) {
      row.className = "schedule-item done";
    } else if (i === activeIdx) {
      row.className = phaseMode === "pouring" ? "schedule-item active-pouring" : "schedule-item active-waiting";
    } else {
      row.className = "schedule-item";
    }
  }

  draw3DScene(brewElapsed, phaseMode, currentWater, phaseProgress, hudStageTitle, hudSubText);

  if (brewRunning) {
    brewAnimReq = requestAnimationFrame(brewLoop);
  }
}

// ----------------------------------------------------------------------------
// 3D 실사 애니메이션 캔버스 (비이커 글씨 완전 제거 버전)
// ----------------------------------------------------------------------------
function draw3DScene(elapsed, phaseMode, currentWater, phaseProgress, hudTitle, hudSub) {
  const canvas = document.getElementById("brewAnimCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const d = (window.DRIPPERS || {})[currentDripper] || { grindOffset: 0, timeOffset: 0, retention: 2.0, themeColor: "#00a1e4" };
  const totalTime = parseFloat(document.getElementById("time-num").value) || 210;
  const water = parseFloat(document.getElementById("water-num").value) || 480;
  let targetRefWater = water;
  if (currentModeKey === "bypass") {
    const bRes = window.calculateBrewModeWater(parseFloat(document.getElementById("dose-num").value) || 30, "bypass");
    targetRefWater = bRes.dripperInputWaterG;
  }

  const waterRatio = Math.max(0, Math.min(1, currentWater / Math.max(1, targetRefWater)));
  const cx = W / 2;
  const isPouring = (phaseMode === "pouring");
  const isWaiting = (phaseMode === "waiting");

  // 배경 그라데이션
  const bgGrad = ctx.createRadialGradient(cx, 190, 15, cx, 220, 260);
  if (isPouring) {
    bgGrad.addColorStop(0, "#0c3c5c");
    bgGrad.addColorStop(0.55, "#0b1e33");
    bgGrad.addColorStop(1, "#060c17");
  } else if (isWaiting) {
    bgGrad.addColorStop(0, "#4a2c11");
    bgGrad.addColorStop(0.55, "#26160a");
    bgGrad.addColorStop(1, "#120a05");
  } else {
    bgGrad.addColorStop(0, "#2b3445");
    bgGrad.addColorStop(0.6, "#151a24");
    bgGrad.addColorStop(1, "#090c12");
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 대기 중 보케 효과
  if (isWaiting) {
    ctx.save();
    for (let i = 0; i < 8; i++) {
      const bx = (cx - 120) + ((i * 37) % 240) + Math.sin(elapsed * 1.2 + i) * 10;
      const by = 280 - ((elapsed * 18 + i * 28) % 200);
      const br = 6 + (i % 3) * 4;
      ctx.fillStyle = "rgba(255, 212, 59, 0.1)";
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // 상단 HUD 오버레이
  ctx.save();
  ctx.fillStyle = isPouring ? "rgba(0, 161, 228, 0.32)" : (isWaiting ? "rgba(245, 159, 0, 0.3)" : "rgba(255, 255, 255, 0.1)");
  ctx.strokeStyle = isPouring ? "#4dabf7" : (isWaiting ? "#ffd43b" : "rgba(255, 255, 255, 0.25)");
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(12, 10, W - 24, 54, 10); ctx.fill(); ctx.stroke();

  ctx.fillStyle = "#ffffff"; ctx.font = "900 13.5px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(hudTitle || "추출 대기 중", cx, 30);

  ctx.fillStyle = isPouring ? "#a5d8ff" : "#ffe066"; ctx.font = "700 11px sans-serif";
  ctx.fillText(hudSub || "", cx, 48);
  ctx.restore();

  // 구즈넥 주전자 스파우트 & 물줄기
  ctx.save();
  if (isPouring) {
    const spoutSway = Math.sin(elapsed * 5.2) * 16;
    ctx.strokeStyle = "#adb5bd"; ctx.lineWidth = 9; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(W - 10, 78); ctx.quadraticCurveTo(cx + 55, 96, cx + spoutSway, 86); ctx.stroke();

    const streamGrad = ctx.createLinearGradient(cx, 88, cx, 150);
    streamGrad.addColorStop(0, "rgba(165, 216, 255, 0.98)");
    streamGrad.addColorStop(1, "rgba(51, 154, 240, 0.85)");
    ctx.strokeStyle = streamGrad; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(cx + spoutSway, 88); ctx.quadraticCurveTo(cx + spoutSway * 0.4, 118, cx + spoutSway * 0.5, 150); ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(173, 181, 189, 0.4)"; ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(W + 10, 72); ctx.quadraticCurveTo(W - 20, 80, W - 42, 74); ctx.stroke();
  }
  ctx.restore();

  // 하단 3D 전자저울 (시간 및 물 무게 표시)
  const scaleY = 372;
  const scaleW = 330;
  const scaleH = 64;
  const scaleX = cx - scaleW / 2;

  ctx.save();
  const scaleBodyGrad = ctx.createLinearGradient(0, scaleY, 0, scaleY + scaleH);
  scaleBodyGrad.addColorStop(0, "#212529"); scaleBodyGrad.addColorStop(1, "#0b0d0e");
  ctx.fillStyle = scaleBodyGrad; ctx.strokeStyle = isPouring ? "#00a1e4" : (isWaiting ? "#f59f00" : "#495057");
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(scaleX, scaleY, scaleW, scaleH, 12); ctx.fill(); ctx.stroke();

  // 좌측 타이머 LED
  ctx.fillStyle = "#05070a"; ctx.strokeStyle = "#1864ab"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(scaleX + 12, scaleY + 9, 140, 46, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#74c0fc"; ctx.font = "800 10px sans-serif"; ctx.textAlign = "left";
  ctx.fillText("TIME", scaleX + 20, scaleY + 22);
  ctx.fillStyle = elapsed < 0 ? "#ff8787" : "#3bc9db"; ctx.font = "900 21px monospace";
  ctx.fillText(formatMMSS(elapsed), scaleX + 20, scaleY + 47);

  // 우측 무게 LED
  ctx.fillStyle = "#05070a"; ctx.strokeStyle = "#2b8a3e";
  ctx.beginPath(); ctx.roundRect(scaleX + scaleW - 152, scaleY + 9, 140, 46, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = isPouring ? "#66d9e8" : "#8ce99a"; ctx.font = "800 10px sans-serif"; ctx.textAlign = "right";
  ctx.fillText(isPouring ? "POURING..." : "WEIGHT (g)", scaleX + scaleW - 20, scaleY + 22);
  ctx.fillStyle = "#ffd43b"; ctx.font = "900 21px monospace";
  ctx.fillText(`${Math.round(currentWater)} g`, scaleX + scaleW - 20, scaleY + 47);
  ctx.restore();

  // 서버 & 커피 수면 (비이커 위 글씨 완전 제거)
  const srvTopY = 242;
  const srvBotY = 362;
  const srvTopW = 50;
  const srvBotW = 76;

  const fillRatio = Math.min(0.84, waterRatio * 0.84);
  const liquidH = (srvBotY - srvTopY) * fillRatio;
  const liquidTopY = srvBotY - liquidH;
  const liquidTopW = srvTopW + (srvBotW - srvTopW) * ((liquidTopY - srvTopY) / (srvBotY - srvTopY));

  if (liquidH > 3) {
    ctx.save();
    const cofGrad = ctx.createLinearGradient(cx - srvBotW, liquidTopY, cx + srvBotW, srvBotY);
    cofGrad.addColorStop(0, "#8c481e"); cofGrad.addColorStop(0.5, "#4a200a"); cofGrad.addColorStop(1, "#1f0b02");
    ctx.fillStyle = cofGrad;
    ctx.beginPath();
    ctx.moveTo(cx - liquidTopW, liquidTopY); ctx.lineTo(cx + liquidTopW, liquidTopY);
    ctx.lineTo(cx + srvBotW, srvBotY); ctx.lineTo(cx - srvBotW, srvBotY);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = "#b06d3b";
    ctx.beginPath(); ctx.ellipse(cx, liquidTopY, liquidTopW, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 드리퍼에서 서버로 떨어지는 추출 줄기
  if (elapsed > 2 && waterRatio < 1.0) {
    ctx.save();
    ctx.strokeStyle = "#b06d3b"; ctx.lineWidth = isPouring ? 3 : 2;
    ctx.setLineDash(isPouring ? [8, 4] : [4, 8]);
    ctx.lineDashOffset = -elapsed * 50;
    const holes = currentDripper === "kalita" ? [cx - 10, cx, cx + 10] : [cx];
    holes.forEach(hx => {
      ctx.beginPath(); ctx.moveTo(hx, 226); ctx.lineTo(hx, liquidTopY); ctx.stroke();
    });
    ctx.restore();
  }

  // 유리 서버 외곽선
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - srvTopW, srvTopY); ctx.lineTo(cx - srvBotW, srvBotY);
  ctx.moveTo(cx + srvTopW, srvTopY); ctx.lineTo(cx + srvBotW, srvBotY);
  ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, srvBotY, srvBotW, 10, 0, 0, Math.PI); ctx.stroke();
  ctx.restore();

  // 드리퍼 (비이커/드리퍼 위 글씨 완전 제거)
  const dTopY = 120;
  const dBotY = 226;
  const dTopW = 86;
  const dBotW = currentDripper === "hario" ? 20 : 48;

  ctx.save();
  const bodyGrad = ctx.createLinearGradient(cx - dTopW, dTopY, cx + dTopW, dTopY);
  bodyGrad.addColorStop(0, "#dee2e6"); bodyGrad.addColorStop(0.35, "#ffffff"); bodyGrad.addColorStop(1, "#adb5bd");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(cx - dTopW, dTopY); ctx.lineTo(cx + dTopW, dTopY);
  ctx.lineTo(cx + dBotW, dBotY); ctx.lineTo(cx - dBotW, dBotY);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = d.themeDark;
  ctx.beginPath(); ctx.roundRect(cx - 64, dBotY - 2, 128, 8, 3); ctx.fill();

  // 커피 베드 (블루밍)
  ctx.fillStyle = "#3b2210";
  ctx.beginPath(); ctx.ellipse(cx, dTopY, dTopW, 15, 0, 0, Math.PI * 2); ctx.fill();

  const bloomSwell = elapsed > 0 ? Math.sin(elapsed * 3) * 2 + (isPouring ? 3.5 : 1) : 0;
  const foamGrad = ctx.createRadialGradient(cx - 10, dTopY - 2, 4, cx, dTopY, dTopW * 0.8);
  foamGrad.addColorStop(0, isPouring ? "#cfe8ff" : "#e6ccb2");
  foamGrad.addColorStop(0.5, "#9c6644");
  foamGrad.addColorStop(1, "#582f0e");
  ctx.fillStyle = foamGrad;
  ctx.beginPath(); ctx.ellipse(cx, dTopY + 2, dTopW * 0.82, 11 + bloomSwell, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = d.themeColor; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, dTopY, dTopW, 15, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
