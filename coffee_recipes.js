/**
 * ============================================================================
 * coffee_recipes.js — [1부 / Part 1]
 * 드립 커피 추출 프로그램용 원두별 레시피 · 드리퍼 프로파일 · 추출 모드 데이터
 * 기준일: 2026-10-29
 *
 * [구성 안내]
 * - 1부: 공통 중량(7단계), 공통 4모드(1:14 / 1:16 / 1:18 / 바이패스 1:12+1:4),
 *        드리퍼 3종 프로파일 및 공식·로스터리 프리셋, 원두 24종 개별 데이터
 * - 2부: 전문 바리스타 프리셋(Hoffmann, Kasuya, Hedrick, Rao 등),
 *        그라인더 13종 레지스트리(Feima 600N 4.5, Baratza Encore 14 등),
 *        데이터 검증 및 전역 내보내기 인터페이스
 * ============================================================================
 */

// ============================================================================
// 1. 지원 원두 중량 (7단계: 15g, 20g, 25g, 30g, 35g, 40g, 50g)
// ============================================================================
const WEIGHTS = [15, 20, 25, 30, 35, 40, 50];
window.WEIGHTS = WEIGHTS;

// ============================================================================
// 2. 공통 4가지 추출 모드 (진하게 1:14, 표준 1:16, 연하게 1:18, 바이패스 1:12+1:4=1:16)
// ============================================================================
const BREW_MODES = {
  strong: {
    id: "strong",
    name: "진하게 (1:14)",
    shortName: "진하게",
    targetRatio: 14.0,
    brewRatio: 14.0,
    bypassAddRatio: 0,
    isBypass: false,
    recipeType: "general_starting_point",
    verificationStatus: "recommendation_not_tested",
    description: "물 투입량을 원두 대비 1:14로 줄여 농도와 바디감을 높이는 출발점입니다. 특정 TDS 수치를 보장하지 않습니다."
  },
  standard: {
    id: "standard",
    name: "표준 (1:16)",
    shortName: "표준",
    targetRatio: 16.0,
    brewRatio: 16.0,
    bypassAddRatio: 0,
    isBypass: false,
    recipeType: "general_starting_point",
    verificationStatus: "recommendation_not_tested",
    description: "프로그램 공통 비교 기준인 1:16 비율입니다. 각 브랜드/바리스타의 원본 공식 레시피와 구분됩니다."
  },
  light: {
    id: "light",
    name: "연하게 (1:18)",
    shortName: "연하게",
    targetRatio: 18.0,
    brewRatio: 18.0,
    bypassAddRatio: 0,
    isBypass: false,
    recipeType: "general_starting_point",
    verificationStatus: "recommendation_not_tested",
    description: "물 투입량을 원두 대비 1:18로 늘려 농도를 낮추고 가벼운 질감을 추구하는 출발점입니다."
  },
  bypass: {
    id: "bypass",
    name: "바이패스 (드리퍼 1:12 + 온수 1:4 = 1:16)",
    shortName: "바이패스",
    targetRatio: 16.0,
    brewRatio: 12.0,
    bypassAddRatio: 4.0,
    isBypass: true,
    recipeType: "general_starting_point",
    verificationStatus: "recommendation_not_tested",
    description: "드리퍼에 원두 대비 1:12의 물을 먼저 투입해 추출한 뒤, 서버에 온수를 추가하여 최종 총 투입수량을 표준(1:16)과 맞추는 방식입니다. 특정 성분만 선택 추출하거나 떫은맛을 원천 차단하는 기법이 아닙니다."
  }
};
window.BREW_MODES = BREW_MODES;

/**
 * 원두 중량(doseGrams)과 추출 모드(modeId)에 따른 물 투입량 계산 함수
 * - 배전도나 원두별 기본 비율을 중복 적용하지 않습니다.
 * - 모든 물의 양은 정수(1g) 단위로 반올림합니다.
 * - 총 투입수량(totalInputWaterG)과 실제 추출 음료 무게는 서로 다른 값으로 구분합니다.
 */
function calculateBrewModeWater(doseGrams, modeId = "standard") {
  const dose = Number(doseGrams) || 30;
  const mode = BREW_MODES[modeId] || BREW_MODES.standard;

  const finalTargetWaterG = Math.round(dose * mode.targetRatio);
  const dripperInputWaterG = mode.isBypass
    ? Math.round(dose * mode.brewRatio)
    : finalTargetWaterG;
  const bypassHotWaterG = mode.isBypass
    ? Math.max(0, finalTargetWaterG - dripperInputWaterG)
    : 0;

  return {
    modeId: mode.id,
    modeName: mode.name,
    doseGrams: dose,
    targetRatio: mode.targetRatio,
    brewRatio: mode.brewRatio,
    isBypass: mode.isBypass,
    dripperInputWaterG: dripperInputWaterG,
    bypassHotWaterG: bypassHotWaterG,
    totalInputWaterG: finalTargetWaterG,
    waterBasisNote: "모든 수치는 드리퍼/서버에 붓는 '물 투입량(g)' 기준이며, 원두·필터에 남는 물로 인해 실제 완성 음료 무게는 투입수량보다 작습니다.",
    tdsEyMeasurementStatus: "unmeasured_requires_refractometer_and_beverage_mass"
  };
}
window.calculateBrewModeWater = calculateBrewModeWater;

// 7단계 중량 × 4가지 모드 사전 계산 검증 테이블
const BREW_MODE_TABLE = {};
WEIGHTS.forEach(dose => {
  BREW_MODE_TABLE[dose] = {
    strong: calculateBrewModeWater(dose, "strong"),
    standard: calculateBrewModeWater(dose, "standard"),
    light: calculateBrewModeWater(dose, "light"),
    bypass: calculateBrewModeWater(dose, "bypass")
  };
});
window.BREW_MODE_TABLE = BREW_MODE_TABLE;

// ============================================================================
// 3. 드리퍼 3종 프로파일 및 브랜드/로스터리 원본 레시피
//    - Blue Bottle Dripper, HARIO V60, Kalita Wave를 별도 프로파일로 지원
//    - 하나의 푸어 패턴을 모든 드리퍼에 일괄 적용하지 않음
// ============================================================================
const DRIPPERS = {
  bluebottle: {
    id: "bluebottle",
    dripperCode: "blue_bottle_pourover",
    name: "블루보틀",
    fullName: "Blue Bottle Dripper (블루보틀 드리퍼)",
    shortTag: "플랫베드 · 40리브 · 단일 추출구",
    badge: "B",
    themeColor: "#00a1e4",
    themeDark: "#0077ac",
    themeSoft: "#e7f5ff",
    grindOffset: 0,
    timeOffset: 0,
    retention: 2.0,
    acidityBias: 1.0,
    sweetBias: 1.12,
    bodyBias: 1.05,
    recommendedDoseRangeG: [20, 30],
    defaultStandardDoseG: 22,
    defaultWaterG: 350,
    defaultRatio: 16.0,
    recommendedTempRangeC: [90.6, 96.1], // 195-205°F
    grindGuidance: "중간 분쇄 (Medium / 바다소금~고운 소금 사이, 사용 그라인더별 시작점 참조)",
    expectedBrewTimeRangeSec: [150, 210], // 2:30 ~ 3:30
    // 프로그램 공통 모드(1:16 등) 사용 시 적용되는 블루보틀 전용 4단계 푸어 패턴
    standardPourPattern: {
      patternName: "Blue Bottle 4-Pour Pattern",
      totalPours: 4,
      bloomWaitSec: 40,
      steps: [
        { step: 1, phase: "bloom", timeSec: 0, waitUntilSec: 40, cumulativeRatioOfTotal: 0.143, fixedBloomRule: "원두량의 약 2배 또는 공식 가이드 기준 50g 블루밍 (약 10초 내 투입 후 30~40초 대기)" },
        { step: 2, phase: "pour_1", timeSec: 40, waitUntilSec: 70, cumulativeRatioOfTotal: 0.43, note: "0:40 전후 총 투입량의 약 43%까지 나선형 푸어링" },
        { step: 3, phase: "pour_2", timeSec: 70, waitUntilSec: 100, cumulativeRatioOfTotal: 0.71, note: "1:10 전후 총 투입량의 약 71%까지 푸어링" },
        { step: 4, phase: "pour_3", timeSec: 100, waitUntilSec: 180, cumulativeRatioOfTotal: 1.00, note: "1:40 전후 최종 목표 물량 100%까지 투입 후 배수" }
      ]
    },
    sourceUrls: [
      "https://bluebottlecoffee.com/us/eng/brew-guides/pour-over",
      "https://kr.bluebottlecoffee.com/blogs/%EB%B8%8C%EB%A3%A8%EC%9E%89-%EA%B0%80%EC%9D%B4%EB%93%9C/%EC%99%84%EB%B2%BD%ED%95%9C-%ED%91%B8%EC%96%B4-%EC%98%A4%EB%B2%84%EB%A5%BC-%EC%9C%84%ED%95%B4",
      "https://blog.bluebottlecoffee.com/posts/brew-theory-extraction-strength-and-finding-the-sweet-spot-for-pour-over-coffee"
    ],
    recipeType: "manufacturer",
    verificationStatus: "source_linked"
  },

  hario: {
    id: "hario",
    dripperCode: "hario_v60",
    name: "하리오V60",
    fullName: "HARIO V60 (01 / 02)",
    shortTag: "60도 원추형 · 나선형 리브 · 대구경 추출구",
    badge: "V",
    themeColor: "#e03131",
    themeDark: "#c92a2a",
    themeSoft: "#fff5f5",
    grindOffset: -60,
    timeOffset: -20,
    retention: 1.9,
    acidityBias: 1.15,
    sweetBias: 1.0,
    bodyBias: 0.92,
    recommendedDoseRangeG: [15, 30],
    defaultStandardDoseG: 15,
    defaultWaterG: 250,
    defaultRatio: 16.0,
    brandOfficialRatioReference: 16.7,
    recommendedTempRangeC: [92.0, 96.0],
    grindGuidance: "중간~중간보다 고운 분쇄 (Medium-Fine, 사용 그라인더별 시작점 참조)",
    expectedBrewTimeRangeSec: [150, 210], // 2:30 ~ 3:30 (공식 15g 가이드는 2:30~3:00)
    // 프로그램 공통 모드(1:16 등) 사용 시 적용되는 V60 5단계 균등 푸어 패턴 (20% -> 40% -> 60% -> 80% -> 100%)
    standardPourPattern: {
      patternName: "HARIO V60 5-Step 20% Increment Pattern",
      totalPours: 5,
      bloomWaitSec: 45,
      steps: [
        { step: 1, phase: "bloom", timeSec: 0, waitUntilSec: 45, cumulativeRatioOfTotal: 0.20, note: "0:00 총 목표수량의 20%까지 블루밍 후 30~45초 대기" },
        { step: 2, phase: "pour_1", timeSec: 45, waitUntilSec: 70, cumulativeRatioOfTotal: 0.40, note: "0:45 누적 40%까지 붓기" },
        { step: 3, phase: "pour_2", timeSec: 70, waitUntilSec: 90, cumulativeRatioOfTotal: 0.60, note: "1:10 누적 60%까지 붓기" },
        { step: 4, phase: "pour_3", timeSec: 90, waitUntilSec: 110, cumulativeRatioOfTotal: 0.80, note: "1:30 누적 80%까지 붓기" },
        { step: 5, phase: "pour_4", timeSec: 110, waitUntilSec: 180, cumulativeRatioOfTotal: 1.00, note: "1:50 누적 100%까지 붓고 2:00 전후 가볍게 스월" }
      ]
    },
    sourceUrls: [
      "https://www.hario.co.uk/pages/brew-guides-v60-basic",
      "https://www.hario.co.uk/pages/brew-guides-v60-expert",
      "https://hariokorea.com/v60/"
    ],
    recipeType: "manufacturer",
    verificationStatus: "source_linked"
  },

  kalita: {
    id: "kalita",
    dripperCode: "kalita_wave",
    name: "칼리타",
    fullName: "Kalita Wave (155 / 185)",
    shortTag: "플랫베드 · 웨이브 필터 · 3공 추출구",
    badge: "K",
    themeColor: "#d9480f",
    themeDark: "#b43c0c",
    themeSoft: "#fff4e6",
    grindOffset: 40,
    timeOffset: 10,
    retention: 2.1,
    acidityBias: 0.93,
    sweetBias: 1.14,
    bodyBias: 1.10,
    recommendedDoseRangeG: [15, 35],
    defaultStandardDoseG: 20,
    defaultWaterG: 320,
    defaultRatio: 16.0,
    recommendedTempRangeC: [91.0, 96.0],
    grindGuidance: "중간~중간보다 약간 굵은 분쇄 (Medium / Medium-Coarse)",
    expectedBrewTimeRangeSec: [120, 210], // 공식 지침 2:00~3:00, 로스터리 가이드 2:30~3:30
    // 프로그램 공통 모드(1:16) 사용 시 적용되는 칼리타 웨이브 4단계 푸어 패턴
    standardPourPattern: {
      patternName: "Kalita Wave 4-Pour Pattern (20g:320g 기준 비율)",
      totalPours: 4,
      bloomWaitSec: 45,
      steps: [
        { step: 1, phase: "bloom", timeSec: 0, waitUntilSec: 45, cumulativeRatioOfTotal: 0.125, note: "0:00 총량의 12.5%(20g 기준 40g) 블루밍 후 30~45초 대기" },
        { step: 2, phase: "pour_1", timeSec: 45, waitUntilSec: 105, cumulativeRatioOfTotal: 0.469, note: "0:45 전후 누적 약 47%(320g 기준 150g)까지 푸어링" },
        { step: 3, phase: "pour_2", timeSec: 105, waitUntilSec: 120, cumulativeRatioOfTotal: 0.750, note: "1:45 전후 누적 75%(320g 기준 240g)까지 푸어링" },
        { step: 4, phase: "pour_3", timeSec: 120, waitUntilSec: 180, cumulativeRatioOfTotal: 1.000, note: "2:00 전후 최종 목표 물량 100%(320g)까지 투입" }
      ]
    },
    sourceUrls: [
      "https://ep-shopify.s3.amazonaws.com/related-documents/kalita/kalita-wave-brewing-instructions.pdf",
      "https://help.partnerscoffee.com/en-US/kalita-wave-4302305",
      "https://www.copancoffeeroasters.com/pages/brew-guide-kalita",
      "https://fuglencoffee.kr/sub/brew.html/brew.html",
      "https://beanbrothers.co.kr/info/coffeewiki_detail?cateCd=006009004&cateNm=&goodsNo=1000000576"
    ],
    recipeType: "manufacturer",
    verificationStatus: "source_linked"
  }
};
window.DRIPPERS = DRIPPERS;

/**
 * 드리퍼별 제조사 공식 레시피 및 로스터리 공개 레시피 프리셋 (원본 수치 보존)
 * - 공통 1:16 비율로 강제 덮어쓰지 않고 각 출처의 원본 원두량·물량·스케줄을 그대로 보존합니다.
 */
const DRIPPER_ORIGINAL_PRESETS = [
  {
    id: "bluebottle_official_single_origin",
    name: "Blue Bottle 공식 푸어오버 — 싱글 오리진",
    dripper: "bluebottle",
    dripperModel: "Blue Bottle Dripper / Pour-OverCone",
    recipeType: "manufacturer",
    coffeeDoseG: 22,
    recommendedDoseRangeG: [20, 27],
    waterAmountG: 350,
    ratio: 15.9,
    temperatureC: 93.0,
    temperatureRangeC: [90.6, 96.1],
    grindGuidance: "중간 분쇄 (Medium)",
    bloomWaterG: 50,
    bloomTimeSec: 40,
    pourSchedule: [
      { timeSec: 0, cumulativeWaterG: 50, action: "50g(또는 60g) 블루밍, 약 10초 내 붓고 30~40초 대기" },
      { timeSec: 40, cumulativeWaterG: 150, action: "0:40 누적 150g까지 나선형 푸어링" },
      { timeSec: 70, cumulativeWaterG: 250, action: "1:10 누적 250g까지 푸어링" },
      { timeSec: 100, cumulativeWaterG: 350, action: "1:40 누적 350g까지 최종 푸어링" }
    ],
    targetTimeRangeSec: [150, 210],
    sourceName: "Blue Bottle Coffee — How to Make Pour Over Coffee",
    sourceUrl: "https://bluebottlecoffee.com/us/eng/brew-guides/pour-over",
    secondarySourceUrl: "https://blog.bluebottlecoffee.com/posts/brew-theory-extraction-strength-and-finding-the-sweet-spot-for-pour-over-coffee",
    verificationStatus: "source_linked"
  },
  {
    id: "bluebottle_official_blend",
    name: "Blue Bottle 공식 푸어오버 — 블렌드 (고농도 예시)",
    dripper: "bluebottle",
    dripperModel: "Blue Bottle Dripper",
    recipeType: "manufacturer",
    coffeeDoseG: 30,
    recommendedDoseRangeG: [28, 30],
    waterAmountG: 350,
    ratio: 11.7,
    temperatureC: 91.0,
    temperatureRangeC: [88.0, 93.0],
    grindGuidance: "중간 분쇄 (Medium)",
    bloomWaterG: 60,
    bloomTimeSec: 40,
    pourSchedule: [
      { timeSec: 0, cumulativeWaterG: 60, action: "60g 블루밍 후 30~40초 대기" },
      { timeSec: 40, cumulativeWaterG: 150, action: "누적 150g까지 푸어링" },
      { timeSec: 70, cumulativeWaterG: 250, action: "누적 250g까지 푸어링" },
      { timeSec: 100, cumulativeWaterG: 350, action: "누적 350g까지 최종 푸어링" }
    ],
    targetTimeRangeSec: [150, 210],
    sourceName: "Blue Bottle Coffee Lab — Extraction, Strength and Finding the Sweet Spot",
    sourceUrl: "https://blog.bluebottlecoffee.com/posts/brew-theory-extraction-strength-and-finding-the-sweet-spot-for-pour-over-coffee",
    verificationStatus: "source_linked"
  },
  {
    id: "hario_uk_official_v60_basic",
    name: "HARIO UK 공식 V60 기본/전문가 가이드",
    dripper: "hario",
    dripperModel: "HARIO V60 01 / 02",
    recipeType: "manufacturer",
    coffeeDoseG: 15,
    waterAmountG: 250,
    ratio: 16.7,
    temperatureC: 94.0,
    temperatureRangeC: [92.0, 96.0],
    grindGuidance: "중간보다 고운 분쇄 (Medium-Fine)",
    bloomWaterG: 45,
    bloomTimeSec: 35,
    pourSchedule: [
      { timeSec: 0, cumulativeWaterG: 45, action: "45g 전후 블루밍, 30~45초 대기" },
      { timeSec: 35, cumulativeWaterG: 150, action: "원을 그리며 1차 분할 푸어링" },
      { timeSec: 75, cumulativeWaterG: 250, action: "최종 250g까지 나누어 붓기" }
    ],
    targetTimeRangeSec: [150, 180],
    sourceName: "HARIO UK — Basic & Expert V60 Brew Guide",
    sourceUrl: "https://www.hario.co.uk/pages/brew-guides-v60-expert",
    secondarySourceUrl: "https://www.hario.co.uk/pages/brew-guides-v60-basic",
    verificationStatus: "source_linked"
  },
  {
    id: "hario_korea_official_v60",
    name: "HARIO Korea 공식 V60 기본법 (3회 분할)",
    dripper: "hario",
    dripperModel: "HARIO V60",
    recipeType: "manufacturer",
    coffeeDoseG: 15,
    waterAmountG: 240,
    ratio: 16.0,
    temperatureC: 93.0,
    temperatureRangeC: [92.0, 95.0],
    grindGuidance: "중간 분쇄 (Medium)",
    bloomWaterG: 30,
    bloomTimeSec: 30,
    pourSchedule: [
      { timeSec: 0, cumulativeWaterG: 30, action: "원두량의 약 2배 물로 블루밍 후 30초 대기" },
      { timeSec: 30, cumulativeWaterG: 100, action: "나머지 물을 3회로 나누어 1차 투입" },
      { timeSec: 65, cumulativeWaterG: 170, action: "2차 투입" },
      { timeSec: 100, cumulativeWaterG: 240, action: "3차 최종 투입" }
    ],
    targetTimeRangeSec: [150, 180],
    sourceName: "HARIO Korea — V60 기본 사용법 및 레시피",
    sourceUrl: "https://hariokorea.com/v60/",
    verificationStatus: "source_linked"
  },
  {
    id: "kalita_wave_official_manual",
    name: "Kalita Wave 제조사 공식 사용 설명서",
    dripper: "kalita",
    dripperModel: "Kalita Wave 155 / 185",
    recipeType: "manufacturer",
    coffeeDoseG: 20,
    waterAmountG: 320,
    ratio: 16.0,
    temperatureC: 93.0,
    temperatureRangeC: [91.0, 96.0],
    grindGuidance: "중간 분쇄 (Medium)",
    bloomWaterG: 40,
    bloomTimeSec: 35,
    pourSchedule: [
      { timeSec: 0, cumulativeWaterG: 40, action: "블루밍 30~45초 대기" },
      { timeSec: 40, cumulativeWaterG: 320, action: "중심에서 바깥으로 나누어 부어 총 320g 맞춤 (1:15~1:17 조절 가능)" }
    ],
    targetTimeRangeSec: [120, 180],
    sourceName: "Kalita Wave Official Brewing Instructions (PDF)",
    sourceUrl: "https://ep-shopify.s3.amazonaws.com/related-documents/kalita/kalita-wave-brewing-instructions.pdf",
    verificationStatus: "source_linked"
  },
  {
    id: "kalita_wave_partners_coffee",
    name: "Partners Coffee — Kalita Wave 로스터리 가이드",
    dripper: "kalita",
    dripperModel: "Kalita Wave",
    recipeType: "roaster",
    coffeeDoseG: 20,
    waterAmountG: 320,
    ratio: 16.0,
    temperatureC: 93.3,
    temperatureRangeC: [90.6, 96.1],
    grindGuidance: "중간 분쇄 (Medium)",
    bloomWaterG: 40,
    bloomTimeSec: 40,
    pourSchedule: [
      { timeSec: 0, cumulativeWaterG: 40, action: "40g 블루밍 후 40초 대기" },
      { timeSec: 40, cumulativeWaterG: 200, action: "0:40부터 누적 200g까지 푸어링" },
      { timeSec: 75, cumulativeWaterG: 260, action: "1:15에 누적 260g까지 푸어링" },
      { timeSec: 105, cumulativeWaterG: 320, action: "최종 320g까지 붓고 마지막에 가볍게 스월" }
    ],
    targetTimeRangeSec: [160, 175], // 약 2:45
    sourceName: "Partners Coffee Support — Kalita Wave Brew Guide",
    sourceUrl: "https://help.partnerscoffee.com/en-US/kalita-wave-4302305",
    verificationStatus: "source_linked"
  },
  {
    id: "kalita_wave_copan_roasters",
    name: "Copan Coffee Roasters — Kalita Wave 가이드",
    dripper: "kalita",
    dripperModel: "Kalita Wave",
    recipeType: "roaster",
    coffeeDoseG: 20,
    waterAmountG: 320,
    ratio: 16.0,
    temperatureC: 96.0,
    temperatureRangeC: [95.0, 96.5],
    grindGuidance: "중간-굵은 분쇄 (Medium-Coarse)",
    bloomWaterG: 40,
    bloomTimeSec: 45,
    pourSchedule: [
      { timeSec: 0, cumulativeWaterG: 40, action: "40g 블루밍" },
      { timeSec: 45, cumulativeWaterG: 150, action: "0:45에 누적 150g까지" },
      { timeSec: 105, cumulativeWaterG: 240, action: "1:45에 누적 240g까지" },
      { timeSec: 120, cumulativeWaterG: 320, action: "2:00에 최종 320g까지 투입" }
    ],
    targetTimeRangeSec: [150, 210],
    sourceName: "Copan Coffee Roasters — Kalita Wave Brew Guide",
    sourceUrl: "https://www.copancoffeeroasters.com/pages/brew-guide-kalita",
    verificationStatus: "source_linked"
  },
  {
    id: "kalita_wave_155_fuglen_korea",
    name: "Fuglen Korea — Kalita Wave 155 (소량 15g)",
    dripper: "kalita",
    dripperModel: "Kalita Wave 155",
    recipeType: "roaster",
    coffeeDoseG: 15,
    waterAmountG: 250,
    ratio: 16.7,
    temperatureC: 92.0,
    temperatureRangeC: [91.0, 93.0],
    grindGuidance: "중간 분쇄 (Medium)",
    bloomWaterG: 40,
    bloomTimeSec: 40,
    pourSchedule: [
      { timeSec: 0, cumulativeWaterG: 40, action: "40g 블루밍 후 40초 대기" },
      { timeSec: 40, cumulativeWaterG: 250, action: "이후 나누어 부어 최종 250g까지 추출" }
    ],
    targetTimeRangeSec: [120, 150], // 2:00 ~ 2:30
    sourceName: "Fuglen Korea — Brew Guide (Wave 155)",
    sourceUrl: "https://fuglencoffee.kr/sub/brew.html/brew.html",
    verificationStatus: "source_linked"
  },
  {
    id: "kalita_wave_185_fuglen_korea",
    name: "Fuglen Korea — Kalita Wave 185 (대량 30g)",
    dripper: "kalita",
    dripperModel: "Kalita Wave 185",
    recipeType: "roaster",
    coffeeDoseG: 30,
    waterAmountG: 500,
    ratio: 16.7,
    temperatureC: 92.0,
    temperatureRangeC: [91.0, 93.0],
    grindGuidance: "중간~약간 굵은 분쇄",
    bloomWaterG: 90,
    bloomTimeSec: 30,
    pourSchedule: [
      { timeSec: 0, cumulativeWaterG: 90, action: "90g 블루밍 후 30초 대기" },
      { timeSec: 30, cumulativeWaterG: 300, action: "누적 300g까지 1차 투입" },
      { timeSec: 80, cumulativeWaterG: 400, action: "누적 400g까지 2차 투입" },
      { timeSec: 120, cumulativeWaterG: 500, action: "누적 500g까지 최종 투입" }
    ],
    targetTimeRangeSec: [200, 220], // 약 3:30
    sourceName: "Fuglen Korea — Brew Guide (Wave 185)",
    sourceUrl: "https://fuglencoffee.kr/sub/brew.html/brew.html",
    verificationStatus: "source_linked"
  },
  {
    id: "kalita_wave_bean_brothers",
    name: "Bean Brothers — Kalita Wave 브루 가이드 예시",
    dripper: "kalita",
    dripperModel: "Kalita Wave",
    recipeType: "roaster",
    coffeeDoseG: 20,
    waterAmountG: 320,
    ratio: 16.0,
    temperatureC: 93.0,
    temperatureRangeC: [92.0, 94.0],
    grindGuidance: "해당 원두 안내 기준 중간 분쇄",
    bloomWaterG: 50,
    bloomTimeSec: 30,
    pourSchedule: [
      { timeSec: 0, cumulativeWaterG: 50, action: "50g 블루밍 후 30초 대기" },
      { timeSec: 40, cumulativeWaterG: 150, action: "0:40에 누적 150g까지" },
      { timeSec: 70, cumulativeWaterG: 230, action: "1:10에 누적 230g까지" },
      { timeSec: 100, cumulativeWaterG: 320, action: "1:40에 누적 320g까지 투입" }
    ],
    targetTimeRangeSec: [150, 195],
    sourceName: "Bean Brothers — Colombia Laureles Kalita Wave Guide",
    sourceUrl: "https://beanbrothers.co.kr/info/coffeewiki_detail?cateCd=006009004&cateNm=&goodsNo=1000000576",
    verificationStatus: "source_linked"
  }
];
window.DRIPPER_ORIGINAL_PRESETS = DRIPPER_ORIGINAL_PRESETS;

// ============================================================================
// 4. 산지 · 품종 · 가공 방식 · 배전도별 개별 원두 데이터베이스 (총 24종)
//    - 서로 다른 산지나 가공 방식을 부당하게 합치지 않고 개별 객체로 분리
//    - 확인되지 않은 지역·품종·가공 방식은 추측하지 않고 null 기록
//    - 기본 비율은 프로그램 공통 표준인 1:16 (defaultRatio: 16.0) 적용
//    - 기존 코드와의 호환을 위해 window.ORIGIN_DB 및 window.COFFEE_BEANS 동시 제공
// ============================================================================
const ORIGIN_DB = {
  // 1. 파나마 에스메랄다 게이샤 워시드 (기존 키 호환: geisha)
  geisha: {
    id: "geisha",
    name: "파나마 에스메랄다 게이샤 (워시드)",
    country: "파나마",
    region: "보케테 (Boquete)",
    variety: "Geisha (Gesha)",
    process: "워시드 (Washed)",
    roastLevel: "약배전 (Light)",
    roast: "약배전",
    tastingNotes: ["자스민", "베르가못", "시트러스", "차(Tea) 같은 질감"],
    tastingNotesDisclaimer: "로스터 표기 경향 참고치이며 실제 향미는 로스팅·생두 로트에 따라 달라집니다.",
    recommendedTemperature: { startC: 95.0, minC: 94.0, maxC: 96.0 },
    temp: 95.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["hario", "bluebottle"],
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "고밀도 라이트 로스트면 94~96°C 고온부터 시작; 향이 얇으면 분쇄를 한 단계 곱게 조정" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "과한 교반을 피하고 4회 분할 푸어링" },
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "1:16 비율 기준 94~96°C에서 테스트" }
    },
    grinds: [660, 700, 740, 760, 790, 820, 870],
    times:  [150, 170, 190, 210, 225, 240, 265],
    sourceUrls: ["https://brewster.co.kr/beans"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 94~96°C · 기본 1:16 | 자스민·베르가못 경향 참고 (V60 / Blue Bottle 추천)"
  },

  // 2. 에티오피아 게샤 빌리지 내추럴
  ethiopia_gesha_natural: {
    id: "ethiopia_gesha_natural",
    name: "에티오피아 게샤 빌리지 (내추럴)",
    country: "에티오피아",
    region: "벤치 마지 (Bench Maji)",
    variety: "Gesha",
    process: "내추럴 (Natural)",
    roastLevel: "약배전 (Light)",
    roast: "약배전",
    tastingNotes: ["베리", "열대과일", "플로럴", "달콤한 여운"],
    tastingNotesDisclaimer: "로스터 및 세부 라벨(블록)에 따라 향미 편차가 큽니다.",
    recommendedTemperature: { startC: 94.0, minC: 92.0, maxC: 95.0 },
    temp: 94.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["hario"],
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "발효·베리 향이 과도하면 수온을 92~93°C로 낮춰 비교; 너무 얇으면 곱게 조정" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "92~95°C 범위에서 1:16 추출" },
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "단맛 강조 시 Kalita 1:16 비교" }
    },
    grinds: [680, 720, 750, 780, 810, 840, 890],
    times:  [150, 170, 190, 210, 225, 240, 265],
    sourceUrls: ["https://brewster.co.kr/guide/origin/ethiopia"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 92~95°C · 기본 1:16 | 발효·베리 향이 과하면 온도를 낮춰 비교 (V60 추천)"
  },

  // 3. 에티오피아 예가체프 G1 워시드 (기존 키 호환: yirgacheffe)
  yirgacheffe: {
    id: "yirgacheffe",
    name: "에티오피아 예가체프 G1 (워시드)",
    country: "에티오피아",
    region: "예가체프 / 게뎁 (Yirgacheffe / Gedeb)",
    variety: "Ethiopian Heirloom (토착 품종군)",
    process: "워시드 (Washed)",
    roastLevel: "약배전 (Light)",
    roast: "약배전",
    tastingNotes: ["자스민", "레몬", "복숭아", "홍차"],
    tastingNotesDisclaimer: "로스터 표기 예시이며 원두 라벨 정보를 우선합니다.",
    recommendedTemperature: { startC: 95.0, minC: 94.0, maxC: 96.0 },
    temp: 95.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["hario"],
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "꽃향·시트러스 투명도 비교에 적합; 산미가 날카로우면 1~2°C 낮추거나 분쇄 조정" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "미분으로 배수가 지연되면 분쇄도를 소폭 굵게 조정" },
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "차분한 단맛 비교 시 선택" }
    },
    grinds: [680, 720, 750, 780, 810, 840, 890],
    times:  [155, 175, 195, 215, 230, 245, 270],
    sourceUrls: ["https://brewster.co.kr/guide/origin/ethiopia"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 94~96°C · 기본 1:16 | 꽃향·시트러스 선명도 비교 (V60 추천)"
  },

  // 4. 에티오피아 코케/코체레 허니
  ethiopia_koke_honey: {
    id: "ethiopia_koke_honey",
    name: "에티오피아 코케 / 코체레 (허니)",
    country: "에티오피아",
    region: "예가체프 코케 / 코체레 (Koke / Kochere)",
    variety: "Ethiopian Heirloom",
    process: "허니 (Honey)",
    roastLevel: "약배전~중약배전 (Light to Light-Medium)",
    roast: "약배전",
    tastingNotes: ["살구", "복숭아", "꿀", "꽃향"],
    tastingNotesDisclaimer: "가공 세부 공정에 따라 향미 편차가 있습니다.",
    recommendedTemperature: { startC: 93.0, minC: 92.0, maxC: 95.0 },
    temp: 93.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["hario", "kalita"],
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "발효 단맛·과일향이 무거우면 온도·교반을 낮춰 시험" },
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "꿀 단맛과 부드러운 질감 강조에 적합" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "92~95°C 범위에서 추출" }
    },
    grinds: [700, 740, 770, 800, 830, 860, 910],
    times:  [150, 170, 190, 210, 225, 240, 265],
    sourceUrls: ["https://brewster.co.kr/guide/origin/ethiopia"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 92~95°C · 기본 1:16 | 발효감이 과하면 온도·교반을 낮춰 시험 (V60 / Kalita 추천)"
  },

  // 5. 에티오피아 시다마/구지 워시드
  ethiopia_sidama_washed: {
    id: "ethiopia_sidama_washed",
    name: "에티오피아 시다마 / 구지 (워시드)",
    country: "에티오피아",
    region: "시다마 / 구지 (Sidama / Guji)",
    variety: "Ethiopian Heirloom",
    process: "워시드 (Washed)",
    roastLevel: "약배전 (Light)",
    roast: "약배전",
    tastingNotes: ["플로럴", "복숭아", "홍차", "시트러스"],
    tastingNotesDisclaimer: "로스터 표기 예시입니다.",
    recommendedTemperature: { startC: 94.0, minC: 93.0, maxC: 96.0 },
    temp: 94.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["hario"],
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "플로럴·티라이크를 목표로 과한 교반을 피함" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "93~96°C에서 깔끔하게 추출" },
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "1:16 비율 적용" }
    },
    grinds: [680, 720, 750, 780, 810, 840, 890],
    times:  [150, 170, 190, 210, 225, 240, 265],
    sourceUrls: ["https://brewster.co.kr/guide/origin/ethiopia"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 93~96°C · 기본 1:16 | 티라이크한 향을 목표로 과한 교반 피하기 (V60 추천)"
  },

  // 6. 에티오피아 구지 내추럴
  ethiopia_guji_natural: {
    id: "ethiopia_guji_natural",
    name: "에티오피아 구지 G1 (내추럴)",
    country: "에티오피아",
    region: "구지 (Guji)",
    variety: "Ethiopian Heirloom",
    process: "내추럴 (Natural)",
    roastLevel: "약배전 (Light)",
    roast: "약배전",
    tastingNotes: ["블루베리", "딸기", "복숭아", "꿀"],
    tastingNotesDisclaimer: "로스터 표기 예시입니다.",
    recommendedTemperature: { startC: 94.0, minC: 92.0, maxC: 96.0 },
    temp: 94.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["hario", "kalita"],
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "발효향/무거운 과실감이 과하면 수온을 조금 낮춤" },
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "과일 단맛 강조 시 92~94°C 테스트" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "1:16 기본 비율 적용" }
    },
    grinds: [700, 740, 770, 800, 830, 860, 910],
    times:  [150, 170, 190, 210, 225, 240, 265],
    sourceUrls: ["https://brewster.co.kr/guide/origin/ethiopia"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 92~96°C · 기본 1:16 | 무거운 과실감이 과하면 수온을 조금 낮춤"
  },

  // 7. 케냐 AA 워시드 (기존 키 호환: kenya)
  kenya: {
    id: "kenya",
    name: "케냐 AA (워시드)",
    country: "케냐",
    region: null, // 원두 포장의 세부 산지(니에리, 키리냐가 등) 확인 권장
    variety: "SL28, SL34 등 (라벨 확인 권장)",
    process: "워시드 (Washed)",
    roastLevel: "약배전~중약배전 (Light to Light-Medium)",
    roast: "약배전",
    tastingNotes: ["자몽", "블랙커런트", "체리", "홍차"],
    tastingNotesDisclaimer: "로스터 표기 예시입니다.",
    recommendedTemperature: { startC: 94.5, minC: 93.0, maxC: 96.0 },
    temp: 94.5,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["hario"],
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "산미가 날카롭고 얇으면 곱게/온도 높게; 건조하고 떫으면 반대로 조정" },
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "산미를 둥글게 다듬고 싶을 때 선택" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "93~96°C 범위 적용" }
    },
    grinds: [700, 740, 770, 800, 830, 860, 910],
    times:  [155, 175, 195, 215, 230, 245, 270],
    sourceUrls: ["https://brewster.co.kr/guide/origin/kenya"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 93~96°C · 기본 1:16 | 날카로운 산미와 건조한 떫은맛을 구분해 조정 (V60 추천)"
  },

  // 8. 르완다 버번 워시드 (부룬디와 분리)
  rwanda_bourbon_washed: {
    id: "rwanda_bourbon_washed",
    name: "르완다 버번 (워시드)",
    country: "르완다",
    region: null,
    variety: "Bourbon",
    process: "워시드 (Washed)",
    roastLevel: "약배전~중배전 (Light to Medium)",
    roast: "약배전",
    tastingNotes: ["시트러스", "홍차", "캐러멜", "붉은 과일"],
    tastingNotesDisclaimer: "로스터 표기 예시입니다.",
    recommendedTemperature: { startC: 93.5, minC: 92.0, maxC: 95.0 },
    temp: 93.5,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["kalita", "hario"],
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "단맛·산미 균형 비교에 적합" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "화사한 홍차 뉘앙스 강조 시 선택" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "92~95°C 시작" }
    },
    grinds: [700, 740, 770, 800, 830, 860, 910],
    times:  [150, 170, 190, 210, 225, 240, 265],
    sourceUrls: ["https://brewster.co.kr/guide/taste/floral"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 92~95°C · 기본 1:16 | 단맛·산미 균형부터 시작 (Kalita / V60 추천)"
  },

  // 9. 부룬디 워시드 (르완다와 분리)
  burundi_washed: {
    id: "burundi_washed",
    name: "부룬디 (워시드)",
    country: "부룬디",
    region: null,
    variety: "Bourbon (라벨 확인 권장)",
    process: "워시드 (Washed)",
    roastLevel: "약배전~중배전 (Light to Medium)",
    roast: "약배전",
    tastingNotes: ["시트러스", "베리", "홍차", "깔끔한 단맛"],
    tastingNotesDisclaimer: "로스터 표기 예시입니다.",
    recommendedTemperature: { startC: 93.5, minC: 92.0, maxC: 95.0 },
    temp: 93.5,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["kalita", "hario"],
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "질감과 바디가 얇으면 표준보다 조금 곱게 시험" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "92~95°C 범위에서 추출" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "1:16 비율 적용" }
    },
    grinds: [700, 740, 770, 800, 830, 860, 910],
    times:  [150, 170, 190, 210, 225, 240, 265],
    sourceUrls: ["https://brewster.co.kr/"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 92~95°C · 기본 1:16 | 바디가 얇으면 분쇄도를 조금 곱게 시험 (Kalita / V60 추천)"
  },

  // 10. 탄자니아 킬리만자로 AA 워시드
  tanzania_kilimanjaro_washed: {
    id: "tanzania_kilimanjaro_washed",
    name: "탄자니아 킬리만자로 AA (워시드)",
    country: "탄자니아",
    region: "킬리만자로 (Kilimanjaro)",
    variety: null, // Bourbon, Kent, Geisha 등 상품 라벨 확인 필수
    process: "워시드 (Washed)",
    roastLevel: "약배전~중배전 (Light to Medium)",
    roast: "중배전",
    tastingNotes: ["시트러스", "차(Tea)", "단맛", "산미·단맛 균형"],
    tastingNotesDisclaimer: "지역/품종에 따라 편차가 크므로 라벨값을 우선합니다.",
    recommendedTemperature: { startC: 93.5, minC: 92.0, maxC: 95.0 },
    temp: 93.5,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["hario", "kalita"],
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "산미·단맛 균형형부터 시작" },
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "92~95°C에서 1:16 비교" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "중간 분쇄 적용" }
    },
    grinds: [710, 750, 770, 790, 820, 850, 900],
    times:  [150, 170, 190, 210, 225, 240, 265],
    sourceUrls: ["https://brewster.co.kr/guide/taste/floral"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 92~95°C · 기본 1:16 | 산미·단맛 균형형부터 시작 (V60 / Kalita 추천)"
  },

  // 11. 콜롬비아 후일라 워시드 (기존 키 호환: colombia)
  colombia: {
    id: "colombia",
    name: "콜롬비아 후일라 / 수프리모 (워시드)",
    country: "콜롬비아",
    region: "후일라 (Huila)",
    variety: "Caturra, Castillo, Colombia (라벨 확인)",
    process: "워시드 (Washed)",
    roastLevel: "중약배전~중배전 (Light-Medium to Medium)",
    roast: "중배전",
    tastingNotes: ["캐러멜", "사과", "초콜릿", "견과"],
    tastingNotesDisclaimer: "로스터 표기 예시입니다.",
    recommendedTemperature: { startC: 93.0, minC: 92.0, maxC: 95.0 },
    temp: 93.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["kalita", "bluebottle"],
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "단맛과 균형에 초점을 맞춘 기본 비교" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "풍부한 단맛과 마일드한 바디감" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "사과 산미를 더 선명하게 표현할 때 선택" }
    },
    grinds: [720, 760, 780, 800, 830, 860, 910],
    times:  [150, 170, 190, 210, 225, 240, 265],
    sourceUrls: [
      "https://brewster.co.kr/guide/origin/colombia",
      "https://beanbrothers.co.kr/info/coffeewiki_detail?cateCd=006009004&cateNm=&goodsNo=1000000576"
    ],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 92~95°C · 기본 1:16 | 단맛과 균형을 기준으로 비교 (Kalita Wave 추천)"
  },

  // 12. 콜롬비아 핑크 버번 (워시드/실험 가공 분리)
  colombia_pink_bourbon: {
    id: "colombia_pink_bourbon",
    name: "콜롬비아 핑크 버번 (워시드 / 허니 / 내추럴)",
    country: "콜롬비아",
    region: "후일라 등 (Huila)",
    variety: "Pink Bourbon",
    process: "원두 라벨의 실제 가공 방식(워시드/허니/무산소 등) 확인 필수",
    roastLevel: "약배전~중약배전 (Light to Light-Medium)",
    roast: "약배전",
    tastingNotes: ["붉은 과일", "체리", "꽃향", "과즙감"],
    tastingNotesDisclaimer: "가공 방식에 따라 향미가 크게 달라집니다.",
    recommendedTemperature: { startC: 94.0, minC: 93.0, maxC: 96.0 },
    temp: 94.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["hario"],
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "가공 방식과 배전도를 확인하여 발효도가 높으면 수온을 92~93°C로 낮춤" },
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "단맛 중심 추출 시 비교" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "1:16 기본 비율 적용" }
    },
    grinds: [700, 740, 770, 790, 820, 850, 900],
    times:  [150, 170, 190, 210, 225, 240, 265],
    sourceUrls: ["https://brewster.co.kr/guide/origin/colombia"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 93~96°C · 기본 1:16 | 가공 방식과 배전도를 별도로 확인 (V60 추천)"
  },

  // 13. 태국 치앙마이 티피카 (기존 키 호환: thailand)
  thailand: {
    id: "thailand",
    name: "태국 치앙마이 티피카 (워시드 / 허니)",
    country: "태국",
    region: "치앙마이 (Chiang Mai)",
    variety: "Typica",
    process: "워시드 또는 허니 (라벨 확인)",
    roastLevel: "중배전 (Medium)",
    roast: "중배전",
    tastingNotes: ["꿀 단맛", "허브", "차(Tea)", "클린컵"],
    tastingNotesDisclaimer: "농장 및 로스터 프로파일에 따라 달라집니다.",
    recommendedTemperature: { startC: 92.0, minC: 90.0, maxC: 94.0 },
    temp: 92.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["kalita", "bluebottle"],
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "배전도·밀도 정보가 부족하면 92°C부터 시작" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "은은한 단맛과 밸런스 추출" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "깔끔한 티 라이크 표현" }
    },
    grinds: [720, 760, 780, 800, 830, 860, 910],
    times:  [150, 170, 185, 205, 220, 235, 260],
    sourceUrls: [],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 90~94°C (92°C 시작) · 기본 1:16 | 배전도 정보 확인 권장 (Kalita 추천)"
  },

  // 14. 과테말라 안티구아 SHB (기존 키 호환: guatemala)
  guatemala: {
    id: "guatemala",
    name: "과테말라 안티구아 SHB (워시드)",
    country: "과테말라",
    region: "안티구아 / 우에우에테낭고 (Antigua / Huehuetenango)",
    variety: "Bourbon, Caturra, Catuai",
    process: "워시드 (Washed)",
    roastLevel: "중배전 (Medium)",
    roast: "중배전",
    tastingNotes: ["초콜릿", "오렌지", "견과", "캐러멜"],
    tastingNotesDisclaimer: "로스터 표기 예시입니다.",
    recommendedTemperature: { startC: 92.0, minC: 91.0, maxC: 94.0 },
    temp: 92.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["kalita"],
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "중배전이면 92°C 전후부터 시작하여 산미와 바디 균형 확인" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "초콜릿 단맛 강조" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "오렌지 산미 강조 시 선택" }
    },
    grinds: [730, 770, 790, 810, 840, 870, 920],
    times:  [150, 170, 185, 205, 220, 235, 260],
    sourceUrls: ["https://brewster.co.kr/guide/origin/guatemala"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 91~94°C (92°C 전후 시작) · 기본 1:16 | 초콜릿·견과 밸런스 (Kalita Wave 추천)"
  },

  // 15. 코스타리카 따라주 허니
  costa_rica_honey: {
    id: "costa_rica_honey",
    name: "코스타리카 따라주 (허니 / 화이트 허니)",
    country: "코스타리카",
    region: "따라주 (Tarrazú)",
    variety: "Caturra, Catuai",
    process: "허니 (Honey / White Honey)",
    roastLevel: "중약배전~중배전 (Light-Medium to Medium)",
    roast: "중배전",
    tastingNotes: ["꿀", "사과", "포도", "시럽 같은 질감"],
    tastingNotesDisclaimer: "허니 공정은 워시드와 별도 데이터로 관리합니다.",
    recommendedTemperature: { startC: 92.0, minC: 91.0, maxC: 94.0 },
    temp: 92.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["kalita", "hario"],
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "허니/발효 특성이 강하면 낮은 쪽(91°C)부터 시험" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "청사과 산미와 깔끔한 단맛 강조" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "1:16 비율 적용" }
    },
    grinds: [730, 770, 790, 810, 840, 870, 920],
    times:  [150, 170, 185, 205, 220, 235, 260],
    sourceUrls: ["https://brewster.co.kr/guide/origin/costa-rica"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 91~94°C · 기본 1:16 | 허니 가공의 단맛·발효감에 따라 온도 조정 (Kalita / V60 추천)"
  },

  // 16. 엘살바도르 파카마라
  el_salvador_pacamara: {
    id: "el_salvador_pacamara",
    name: "엘살바도르 파카마라 (워시드 / 허니)",
    country: "엘살바도르",
    region: null,
    variety: "Pacamara",
    process: "워시드 또는 허니 (라벨 확인)",
    roastLevel: "중약배전~중배전 (Light-Medium to Medium)",
    roast: "중배전",
    tastingNotes: ["오렌지", "자몽", "허브", "바닐라", "풍부한 질감"],
    tastingNotesDisclaimer: "큰 종자/품종만으로 분쇄·수온을 단정하지 않습니다.",
    recommendedTemperature: { startC: 93.0, minC: 92.0, maxC: 95.0 },
    temp: 93.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["hario", "kalita"],
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "배전도에 따라 추출 속도와 수온을 조정" },
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "바닐라 단맛과 큰 질감 강조" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "92~95°C 적용" }
    },
    grinds: [720, 760, 780, 800, 830, 860, 910],
    times:  [150, 170, 190, 210, 225, 240, 265],
    sourceUrls: ["https://brewster.co.kr/"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 92~95°C · 기본 1:16 | 품종과 배전도에 따라 추출 속도 확인 (V60 / Kalita 추천)"
  },

  // 17. 브라질 세하도/산토스 내추럴
  brazil_cerrado: {
    id: "brazil_cerrado",
    name: "브라질 세하도 / 모지아나 (내추럴 · 펄프드 내추럴)",
    country: "브라질",
    region: "세하도 / 모지아나 (Cerrado / Mogiana)",
    variety: null, // Catuai, Mundo Novo, Bourbon 등 상품 라벨 확인
    process: "내추럴 또는 펄프드 내추럴 (Natural / Pulped Natural)",
    roastLevel: "중배전 (Medium)",
    roast: "중배전",
    tastingNotes: ["땅콩", "아몬드", "초콜릿", "캐러멜"],
    tastingNotesDisclaimer: "로스터 표기 예시입니다.",
    recommendedTemperature: { startC: 91.0, minC: 89.0, maxC: 93.0 },
    temp: 91.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["kalita", "bluebottle"],
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "초콜릿·견과류 목표, 지나친 쓴맛이 나면 89~90°C 낮은 수온 시험" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "고소함과 묵직한 바디감 강조" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "깔끔한 여운을 원할 때 선택" }
    },
    grinds: [750, 790, 810, 830, 860, 890, 940],
    times:  [145, 165, 180, 200, 215, 230, 255],
    sourceUrls: ["https://brewster.co.kr/guide/process/natural"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 89~93°C · 기본 1:16 | 초콜릿·견과류 중배전 시작값 (Kalita / Blue Bottle 추천)"
  },

  // 18. 온두라스 마르칼라 워시드/허니
  honduras_marcala: {
    id: "honduras_marcala",
    name: "온두라스 마르칼라 (워시드 / 허니)",
    country: "온두라스",
    region: "마르칼라 (Marcala)",
    variety: null,
    process: "워시드 또는 허니 (라벨 확인)",
    roastLevel: "중배전 (Medium)",
    roast: "중배전",
    tastingNotes: ["캐러멜", "견과", "사과", "초콜릿"],
    tastingNotesDisclaimer: "판매 원두의 로스터 프로파일을 우선합니다.",
    recommendedTemperature: { startC: 92.0, minC: 91.0, maxC: 94.0 },
    temp: 92.0,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["kalita"],
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "배전도에 맞춰 중간 온도(92°C)부터 테스트" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "1:16 비율 적용" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "사과 산미 강조 시 선택" }
    },
    grinds: [730, 770, 790, 810, 840, 870, 920],
    times:  [150, 170, 185, 205, 220, 235, 260],
    sourceUrls: ["https://brewster.co.kr/"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 91~94°C · 기본 1:16 | 배전도에 맞춰 중간 온도부터 테스트 (Kalita Wave 추천)"
  },

  // 19. 페루 카하마르카 워시드
  peru_cajamarca_washed: {
    id: "peru_cajamarca_washed",
    name: "페루 카하마르카 (워시드)",
    country: "페루",
    region: "카하마르카 (Cajamarca)",
    variety: null,
    process: "워시드 (Washed)",
    roastLevel: "중약배전~중배전 (Light-Medium to Medium)",
    roast: "중배전",
    tastingNotes: ["꽃향", "시트러스", "사과", "단맛"],
    tastingNotesDisclaimer: "로스터 표기 예시입니다.",
    recommendedTemperature: { startC: 92.5, minC: 91.0, maxC: 94.0 },
    temp: 92.5,
    defaultRatio: 16.0,
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["hario", "kalita"],
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "가벼운 로스팅이면 93~94°C 사용" },
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "단맛과 클린컵 균형형 비교" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "1:16 기본 비율" }
    },
    grinds: [720, 760, 780, 800, 830, 860, 910],
    times:  [150, 170, 185, 205, 220, 235, 260],
    sourceUrls: ["https://brewster.co.kr/"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 91~94°C · 기본 1:16 | 단맛과 클린컵 균형형 시작값 (V60 / Kalita 추천)"
  },

  // 20. 인도네시아 수마트라 만델링 G1 웻헐드 (기존 키 호환: mandheling)
  mandheling: {
    id: "mandheling",
    name: "인도네시아 수마트라 만델링 G1 (웻헐드)",
    country: "인도네시아",
    region: "수마트라 (Sumatra)",
    variety: null,
    process: "웻헐드 (Wet-Hulled / Giling Basah)",
    roastLevel: "중강배전~강배전 (Medium-Dark to Dark)",
    roast: "강배전",
    tastingNotes: ["허브", "흙내음", "다크초콜릿", "묵직한 바디"],
    tastingNotesDisclaimer: "로스터 표기 예시입니다.",
    recommendedTemperature: { startC: 89.0, minC: 88.0, maxC: 92.0 },
    temp: 89.0,
    defaultRatio: 16.0,
    originReferenceRatioRange: [15.0, 16.0],
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["kalita", "bluebottle"],
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "무거운 바디·허브/흙내가 과하면 낮은 온도(88°C)와 굵은 분쇄 시험" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "너무 낮은 수온은 밋밋할 수 있으므로 맛 확인 후 조정" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "깔끔한 여과를 원할 때 선택" }
    },
    grinds: [780, 820, 850, 880, 910, 940, 990],
    times:  [140, 160, 175, 190, 205, 220, 245],
    sourceUrls: ["https://brewster.co.kr/"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 88~92°C (89°C 시작) · 기본 1:16 | 무거운 건조감이 있으면 수온 낮추고 조금 굵게 (Kalita / Blue Bottle 추천)"
  },

  // 21. 인도네시아 토라자 (만델링과 분리)
  indonesia_toraja: {
    id: "indonesia_toraja",
    name: "인도네시아 술라웨시 토라자 (공정 라벨 확인)",
    country: "인도네시아",
    region: "술라웨시 토라자 (Sulawesi Toraja)",
    variety: null,
    process: "웻헐드 또는 워시드 (실제 원두 라벨 공정 확인 필수)",
    roastLevel: "중배전~중강배전 (Medium to Medium-Dark)",
    roast: "강배전",
    tastingNotes: ["스파이스", "카카오", "허브", "묵직한 단맛"],
    tastingNotesDisclaimer: "토라자 전체를 한 가지 공정으로 단정하지 않습니다.",
    recommendedTemperature: { startC: 90.0, minC: 89.0, maxC: 93.0 },
    temp: 90.0,
    defaultRatio: 16.0,
    originReferenceRatioRange: [15.0, 16.0],
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["kalita"],
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "가공 방식이 표시된 원두 라벨을 우선하여 89~93°C에서 시작" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "중후한 단맛 표현" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "워시드 토라자의 경우 91~93°C 테스트" }
    },
    grinds: [760, 800, 830, 860, 890, 920, 970],
    times:  [145, 165, 180, 195, 210, 225, 250],
    sourceUrls: ["https://brewster.co.kr/"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 89~93°C (90°C 시작) · 기본 1:16 | 실제 가공 방식 라벨 우선 (Kalita 추천)"
  },

  // 22. 인도 몬순 말라바르
  india_monsooned_malabar: {
    id: "india_monsooned_malabar",
    name: "인도 몬순 말라바르 (몬순 가공)",
    country: "인도",
    region: "말라바르 해안 (Malabar Coast)",
    variety: null,
    process: "몬순 가공 (Monsooned Process)",
    roastLevel: "중강배전~강배전 (Medium-Dark to Dark)",
    roast: "강배전",
    tastingNotes: ["낮은 산미", "스파이스", "나무/곡물 계열", "묵직한 바디"],
    tastingNotesDisclaimer: "일반 스페셜티 라이트 로스트 기준과 다릅니다.",
    recommendedTemperature: { startC: 89.0, minC: 87.0, maxC: 91.0 },
    temp: 89.0,
    defaultRatio: 16.0,
    originReferenceRatioRange: [15.0, 16.0],
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["kalita", "bluebottle"],
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "낮은 산미·묵직한 바디; 수온을 너무 높이지 않고 87~91°C에서 시작" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "진하게(1:14) 모드와도 잘 어울림" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "무거운 바디를 가볍게 내릴 때 선택" }
    },
    grinds: [780, 820, 850, 880, 910, 940, 990],
    times:  [140, 160, 175, 190, 205, 220, 245],
    sourceUrls: [],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 87~91°C (89°C 시작) · 기본 1:16 | 저산미·묵직한 바디 (Kalita / Blue Bottle 추천)"
  },

  // 23. 다크 로스트 하우스 블렌드 (기존 키 호환: darkblend)
  darkblend: {
    id: "darkblend",
    name: "다크 초콜릿 계열 하우스 블렌드 (강배전)",
    country: null, // 블렌드 구성은 상품별로 다르므로 개별 상품명 보관 권장
    region: null,
    variety: null,
    process: "블렌드 (상품별 라벨 확인)",
    roastLevel: "강배전 (Dark)",
    roast: "강배전",
    tastingNotes: ["다크초콜릿", "로스티", "흑설탕", "견과"],
    tastingNotesDisclaimer: "블렌드 구성비에 따라 달라집니다.",
    recommendedTemperature: { startC: 88.0, minC: 86.0, maxC: 91.0 },
    temp: 88.0,
    defaultRatio: 16.0,
    originReferenceRatioRange: [14.0, 15.0],
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["bluebottle", "kalita"],
      bluebottle: { presetId: "bluebottle_official_blend", adjustmentNote: "쓴맛·건조감이 크면 낮은 수온(86~88°C)과 굵은 분쇄 시험" },
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "안정적인 바디감과 단맛 추출" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "빠른 배수로 쓴맛을 줄일 때 선택" }
    },
    grinds: [800, 840, 870, 900, 930, 960, 1000],
    times:  [135, 155, 170, 185, 200, 215, 240],
    sourceUrls: [
      "https://blog.bluebottlecoffee.com/posts/brew-theory-extraction-strength-and-finding-the-sweet-spot-for-pour-over-coffee"
    ],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 86~91°C (88°C 시작) · 기본 1:16 | 쓴맛·건조감이 크면 낮은 수온과 굵은 분쇄 시험 (Blue Bottle / Kalita 추천)"
  },

  // 24. 콜롬비아 슈가케인(EA) 디카페인
  colombia_decaf_ea: {
    id: "colombia_decaf_ea",
    name: "콜롬비아 슈가케인(EA) 디카페인 (배전도 확인)",
    country: "콜롬비아",
    region: null,
    variety: null,
    process: "슈가케인 EA 디카페인 (Sugarcane Ethyl Acetate Decaf)",
    decafMethod: "Sugarcane EA (Ethyl Acetate)",
    roastLevel: "로스터 배전도 우선 (통상 중배전~중강배전)",
    roast: "중배전",
    tastingNotes: ["카카오", "견과", "캐러멜", "과일 계열(상품별)"],
    tastingNotesDisclaimer: "디카페인은 배전도가 아니므로 실제 로스트 레벨과 공정을 별도 확인해야 합니다.",
    recommendedTemperature: { startC: 91.0, minC: 88.0, maxC: 93.0 },
    temp: 91.0,
    defaultRatio: 16.0,
    originReferenceRatioRange: [15.0, 16.0],
    ratio: 16.0,
    dripperRecipes: {
      recommendedDrippers: ["kalita", "hario"],
      kalita: { presetId: "kalita_wave_official_manual", adjustmentNote: "디카페인 공정 특성상 물 빠짐이 너무 빠르면 조금 곱게, 미분으로 느리면 조금 굵게 조정" },
      hario: { presetId: "hario_uk_official_v60_basic", adjustmentNote: "88~93°C 범위에서 배전도에 맞춰 선택" },
      bluebottle: { presetId: "bluebottle_official_single_origin", adjustmentNote: "1:16 기본 비율 적용" }
    },
    grinds: [740, 780, 810, 830, 860, 890, 940],
    times:  [145, 165, 180, 200, 215, 230, 255],
    sourceUrls: ["https://brewster.co.kr/guide/origin/colombia"],
    verificationStatus: "general_starting_point",
    note: "[추천 시작값] 권장 88~93°C (91°C 시작) · 기본 1:16 | 실제 배전도 우선 확인, 유속에 따라 분쇄도 조정 (Kalita / V60 추천)"
  }
};

// 배열 형태의 원두 목록과 기존 키 형태(ORIGIN_DB)를 모두 내보내어 완벽한 호환성 확보
const COFFEE_BEANS = Object.values(ORIGIN_DB);
window.ORIGIN_DB = ORIGIN_DB;
window.COFFEE_BEANS = COFFEE_BEANS;

// ================= [1부 끝 — 이어서 2부 코드가 연결됩니다] =================
// ============================================================================
// 5. 바리스타 전문 레시피 프리셋 (BARISTA_PRESETS)
//    - James Hoffmann, Tetsu Kasuya, Lance Hedrick, Scott Rao 원본 수치 및 순서 보존
//    - 공통 4모드(1:16 등)로 덮어쓰지 않고 독립 프리셋으로 관리
//    - 확인된 전체 원문/영상 URL 연결
// ============================================================================
const BARISTA_PRESETS = [
  {
    id: "hoffmann_1cup_v60",
    baristaName: "James Hoffmann",
    recipeName: "A Better 1 Cup V60 Technique",
    dripper: "hario",
    dripperModel: "HARIO V60 (01 / 02, 1인분 기준)",
    coffeeDose: 15,
    waterAmount: 250,
    ratio: 16.7,
    temperature: {
      recommendedC: 97.0,
      rangeC: [95.0, 100.0],
      note: "밝은 배전(Light Roast)은 갓 끓인 물(약 95~100°C) 권장, 배전도에 따라 조정"
    },
    grindGuidance: "중간보다 약간 고운 분쇄 (Medium-Fine — 특정 그라인더 클릭으로 일괄 환산하지 않음)",
    pourSchedule: [
      { step: 1, phase: "bloom", startTimeSec: 0, endTimeSec: 15, waitUntilSec: 45, cumulativeWaterG: 50, pourAmountG: 50, instruction: "0:00에 50g 블루밍 후 10~15초 사이 가볍게 스월(Swirl), 0:45까지 대기" },
      { step: 2, phase: "pour_1", startTimeSec: 45, endTimeSec: 60, waitUntilSec: 70, cumulativeWaterG: 100, pourAmountG: 50, instruction: "0:45~1:00 사이 누적 100g까지(총량의 40%) 붓고 10초 대기" },
      { step: 3, phase: "pour_2", startTimeSec: 70, endTimeSec: 80, waitUntilSec: 90, cumulativeWaterG: 150, pourAmountG: 50, instruction: "1:10~1:20 사이 누적 150g까지(총량의 60%) 붓고 10초 대기" },
      { step: 4, phase: "pour_3", startTimeSec: 90, endTimeSec: 100, waitUntilSec: 110, cumulativeWaterG: 200, pourAmountG: 50, instruction: "1:30~1:40 사이 누적 200g까지(총량의 80%) 붓고 10초 대기" },
      { step: 5, phase: "pour_4", startTimeSec: 110, endTimeSec: 120, waitUntilSec: 180, cumulativeWaterG: 250, pourAmountG: 50, instruction: "1:50~2:00 사이 누적 250g까지(100%) 붓고 2:00 전후 가볍게 스월 후 배수" }
    ],
    targetTime: {
      targetSec: 180,
      rangeSec: [165, 195],
      note: "약 3:00 전후 종료 참고 (원두와 그라인더에 따라 변동)"
    },
    sourceUrl: "https://www.youtube.com/watch?v=1oB1oDrDkHM",
    sourceUrls: [
      "https://www.youtube.com/watch?v=1oB1oDrDkHM",
      "https://www.hario-usa.com/blogs/recipes-and-more-from-friends/james-hoffmann-1-cup-v60-technique",
      "https://baristat.com/ko/recipes/v60-hoffmann-one-cup/"
    ],
    sourceType: "barista_original_recipe",
    verificationStatus: "source_linked"
  },

  {
    id: "kasuya_4_6_method",
    baristaName: "Tetsu Kasuya",
    recipeName: "4:6 Method (2016 World Brewers Cup Champion Recipe)",
    dripper: "hario",
    dripperModel: "HARIO V60 (세라믹 / Kasuya 모델 포함)",
    coffeeDose: 20,
    waterAmount: 300,
    ratio: 15.0,
    temperature: {
      recommendedC: 92.0,
      rangeC: [91.0, 93.0],
      note: "92°C 전후 권장"
    },
    grindGuidance: "굵은 분쇄 (Coarse — 일반 푸어오버보다 굵게 설정)",
    pourSchedule: [
      { step: 1, phase: "bloom_40pct_1", startTimeSec: 0, endTimeSec: 15, waitUntilSec: 45, cumulativeWaterG: 50, pourAmountG: 50, instruction: "0:00 첫 푸어 50g (또는 균등 분할 시 60g) 투입 후 0:45까지 완전히 배수 대기" },
      { step: 2, phase: "flavor_40pct_2", startTimeSec: 45, endTimeSec: 60, waitUntilSec: 90, cumulativeWaterG: 120, pourAmountG: 70, instruction: "0:45에 70g 추가(누적 120g, 총량의 40% — 앞 두 번의 물 배분으로 산미·단맛 균형 조절)" },
      { step: 3, phase: "strength_60pct_1", startTimeSec: 90, endTimeSec: 105, waitUntilSec: 130, cumulativeWaterG: 180, pourAmountG: 60, instruction: "1:30에 60g 추가(누적 180g — 후반 60%는 60g씩 3회 나누어 농도 조절)" },
      { step: 4, phase: "strength_60pct_2", startTimeSec: 130, endTimeSec: 145, waitUntilSec: 160, cumulativeWaterG: 240, pourAmountG: 60, instruction: "2:10(또는 2:15)에 60g 추가(누적 240g)" },
      { step: 5, phase: "strength_60pct_3", startTimeSec: 160, endTimeSec: 175, waitUntilSec: 210, cumulativeWaterG: 300, pourAmountG: 60, instruction: "2:40(또는 3:00)에 마지막 60g 추가(누적 300g), 약 3:30 드리퍼 제거" }
    ],
    alternateEqualPourNote: "본인 채널 시연에서는 60g × 5회(0:00, 0:45, 1:30, 2:15, 3:00) 균등 푸어링도 함께 안내됨",
    targetTime: {
      targetSec: 210,
      rangeSec: [210, 240],
      note: "약 3:30~4:00 참고"
    },
    sourceUrl: "https://www.hario-europe.com/blogs/hario-community/v60-ambassadors-tetsu-kasuya",
    sourceUrls: [
      "https://www.hario-europe.com/blogs/hario-community/v60-ambassadors-tetsu-kasuya",
      "https://www.youtube.com/watch?v=123zLI3JoRQ",
      "https://www.youtube.com/watch?v=Gr-QoaJERiw",
      "https://coffeemaster.app/recipes/tetsu-kasuya-46-method"
    ],
    sourceType: "barista_original_recipe",
    verificationStatus: "source_linked"
  },

  {
    id: "hedrick_v60_4pour",
    baristaName: "Lance Hedrick",
    recipeName: "HARIO V60 4-Pour Brewguide",
    dripper: "hario",
    dripperModel: "HARIO V60",
    coffeeDose: 20,
    waterAmount: 340,
    ratio: 17.0,
    temperature: {
      recommendedC: 98.0,
      rangeC: [90.0, 100.0],
      note: "끓는 물 기준 출발; 다크 로스트는 수온을 먼저 낮추고, 라이트 로스트는 푸어 수/교반으로 추출 조절"
    },
    grindGuidance: "중간 분쇄 (원본 영상에서 약 720μm를 출발 예시로 언급하나, Feima 600N이나 다른 그라인더 눈금으로 직접 환산 금지)",
    pourSchedule: [
      { step: 1, phase: "bloom_1", startTimeSec: 0, endTimeSec: 10, waitUntilSec: 30, cumulativeWaterG: 50, pourAmountG: 50, instruction: "0:00에 50g 붓고 가볍게 스월, 30초 간격 대기" },
      { step: 2, phase: "bloom_2", startTimeSec: 30, endTimeSec: 40, waitUntilSec: 60, cumulativeWaterG: 100, pourAmountG: 50, instruction: "0:30에 다시 50g 추가(누적 100g) 후 스월" },
      { step: 3, phase: "main_pour_1", startTimeSec: 60, endTimeSec: 75, waitUntilSec: 90, cumulativeWaterG: 220, pourAmountG: 120, instruction: "1:00에 120g 추가(누적 220g) 후 스월" },
      { step: 4, phase: "main_pour_2", startTimeSec: 90, endTimeSec: 105, waitUntilSec: 180, cumulativeWaterG: 340, pourAmountG: 120, instruction: "1:30에 마지막 120g 추가(누적 340g) 후 스월 및 배수" }
    ],
    targetTime: {
      targetSec: 180,
      rangeSec: [150, 210],
      note: "약 2:30~3:30 참고"
    },
    sourceUrl: "https://www.youtube.com/watch?v=Ji4lZTtRAoo",
    sourceUrls: [
      "https://www.youtube.com/watch?v=Ji4lZTtRAoo"
    ],
    sourceType: "barista_original_recipe",
    verificationStatus: "source_linked"
  },

  {
    id: "scott_rao_v60",
    baristaName: "Scott Rao",
    recipeName: "HARIO V60 Ambassador Recipe",
    dripper: "hario",
    dripperModel: "Plastic HARIO V60 02 (열 손실 최소화를 위해 플라스틱 모델 권장)",
    coffeeDose: 20,
    waterAmount: 330,
    ratio: 16.5,
    temperature: {
      recommendedC: 97.0,
      rangeC: [96.0, 98.0],
      note: "97°C 고온 유지 권장"
    },
    grindGuidance: "중간-고운 분쇄 (Medium-Fine)",
    pourSchedule: [
      { step: 1, phase: "bloom", startTimeSec: 0, endTimeSec: 12, waitUntilSec: 40, cumulativeWaterG: 60, pourAmountG: 60, instruction: "0:00에 60g 블루밍 후 모든 커피가 젖도록 강하게 스핀(Spin), 40초 대기" },
      { step: 2, phase: "main_pour_1", startTimeSec: 40, endTimeSec: 65, waitUntilSec: 110, cumulativeWaterG: 200, pourAmountG: 140, instruction: "0:40부터 누적 200g까지 붓고 매우 가볍게 스핀 후, 물이 약 70% 빠질 때까지 대기" },
      { step: 3, phase: "main_pour_2", startTimeSec: 110, endTimeSec: 135, waitUntilSec: 255, cumulativeWaterG: 330, pourAmountG: 130, instruction: "커피층이 완전히 드러나기 전(약 70% 배수 시점) 누적 330g까지 붓고 다시 가볍게 스핀" }
    ],
    targetTime: {
      targetSec: 255,
      rangeSec: [240, 270],
      note: "원문 인터뷰 기준 4:00~4:30 참고"
    },
    sourceUrl: "https://www.hario.co.uk/blogs/hario-ambassadors/hario-v60-recipe-interview-with-hario-ambassador-scott-rao",
    sourceUrls: [
      "https://www.hario.co.uk/blogs/hario-ambassadors/hario-v60-recipe-interview-with-hario-ambassador-scott-rao"
    ],
    sourceType: "barista_original_recipe",
    verificationStatus: "source_linked"
  },

  // [특수 도구/대회 조건부 참고 프리셋 1] George Jinyang Peng (2025 WBrC)
  {
    id: "george_peng_wbrc_2025",
    baristaName: "George Jinyang Peng",
    recipeName: "2025 World Brewers Cup Champion Recipe (특수 도구 조건부)",
    dripper: "special_solo_dripper_melodrip",
    dripperModel: "Solo Dripper + Melodrip (일반 V60 기본값으로 자동 적용 금지)",
    requiresSpecialEquipment: true,
    coffeeDose: 15,
    waterAmount: 210,
    ratio: 14.0,
    temperature: {
      recommendedC: 96.0,
      stageTemperaturesC: [96.0, 96.0, 80.0],
      note: "블룸 및 1차 푸어 96°C, 마지막 푸어 80°C 온도 단계 조절"
    },
    grindGuidance: "대회용 파나마 게이샤 및 Melodrip 사용 기준 세팅",
    pourSchedule: [
      { step: 1, phase: "bloom", startTimeSec: 0, endTimeSec: 10, waitUntilSec: 30, cumulativeWaterG: 30, pourAmountG: 30, instruction: "96°C 물 30g 블루밍" },
      { step: 2, phase: "pour_1", startTimeSec: 30, endTimeSec: 55, waitUntilSec: 65, cumulativeWaterG: 120, pourAmountG: 90, instruction: "96°C 물 90g 추가 (누적 120g)" },
      { step: 3, phase: "pour_2_melodrip", startTimeSec: 65, endTimeSec: 90, waitUntilSec: 105, cumulativeWaterG: 210, pourAmountG: 90, instruction: "80°C 물 90g을 Melodrip으로 통과시켜 투입 (누적 210g)" }
    ],
    targetTime: {
      targetSec: 105,
      rangeSec: [100, 120],
      note: "보도된 총 추출 시간 약 1:45"
    },
    sourceUrl: "https://sprudge.com/how-to-brew-coffee-like-the-2025-world-brewers-cup-champion-338576.html",
    sourceUrls: [
      "https://sprudge.com/how-to-brew-coffee-like-the-2025-world-brewers-cup-champion-338576.html"
    ],
    sourceType: "competition_barista_recipe",
    verificationStatus: "source_linked"
  },

  // [특수 도구/대회 조건부 참고 프리셋 2] 박준성 (2026 KBrC Hario Switch)
  {
    id: "park_junseong_kbrc_2026_switch",
    baristaName: "박준성 (Park Junseong)",
    recipeName: "2026 Korea Brewers Cup 시연 기반 Hario Switch 하이브리드",
    dripper: "hario_switch",
    dripperModel: "HARIO Switch (침지+여과 하이브리드 — 일반 V60에 자동 적용 금지)",
    requiresSpecialEquipment: true,
    coffeeDose: 15,
    waterAmount: 210,
    ratio: 14.0,
    temperature: {
      recommendedC: 95.0,
      stageTemperaturesC: [95.0, 95.0, 80.0],
      note: "블루밍/여과 95°C, 마지막 침지 단계 80°C"
    },
    grindGuidance: "Hario Switch 하이브리드 시연 기준",
    pourSchedule: [
      { step: 1, phase: "switch_closed_bloom", startTimeSec: 0, endTimeSec: 15, waitUntilSec: 40, cumulativeWaterG: 60, pourAmountG: 60, instruction: "스위치 밸브를 닫고 95°C 물 60g 블루밍" },
      { step: 2, phase: "switch_open_percolation", startTimeSec: 40, endTimeSec: 75, waitUntilSec: 95, cumulativeWaterG: 150, pourAmountG: 90, instruction: "스위치를 열어 여과하며 95°C 물 90g 추가 (누적 150g)" },
      { step: 3, phase: "switch_closed_steep", startTimeSec: 95, endTimeSec: 110, waitUntilSec: 130, cumulativeWaterG: 210, pourAmountG: 60, instruction: "다시 스위치를 닫고 80°C 물 60g 투입해 침지(누적 210g), 약 2:10에 완전 개방" }
    ],
    targetTime: {
      targetSec: 160,
      rangeSec: [145, 175],
      note: "약 2:10 밸브 완전 개방 후 배수 완료 (2차 요약 자료 기반이므로 원본 시연 재확인 권장)"
    },
    sourceUrl: "https://omydrip.bizplano.com/r/park-junseong-kbrc-2026",
    sourceUrls: [
      "https://omydrip.bizplano.com/r/park-junseong-kbrc-2026"
    ],
    sourceType: "secondary_summary_from_demonstration",
    verificationStatus: "source_linked_secondary"
  }
];

window.BARISTA_PRESETS = BARISTA_PRESETS;
window.PUBLIC_BARISTA_RECIPES = BARISTA_PRESETS; // 기존 레거시 변수명 호환

/**
 * 바리스타 프리셋 조회 및 중량 환산 헬퍼 함수
 * - 원본 원두량과 동일할 때는 'original_barista_recipe'로 반환합니다.
 * - 사용자가 다른 원두량으로 환산 요청한 경우 원본 수치(originalRecipe)를 보존한 채
 *   환산된 물 투입량(scaledRecipe)을 별도 객체로 구분하여 반환합니다.
 */
function getBaristaPresetWithScaling(presetId, requestedDoseGrams = null) {
  const preset = BARISTA_PRESETS.find(p => p.id === presetId);
  if (!preset) return null;

  const targetDose = requestedDoseGrams ? Number(requestedDoseGrams) : preset.coffeeDose;
  const isScaled = targetDose !== preset.coffeeDose;
  const scaleFactor = targetDose / preset.coffeeDose;
  const scaledTotalWater = Math.round(targetDose * preset.ratio);

  const scaledSchedule = preset.pourSchedule.map((step, idx, arr) => {
    const isLast = idx === arr.length - 1;
    const scaledCumWater = isLast ? scaledTotalWater : Math.round(step.cumulativeWaterG * scaleFactor);
    return {
      ...step,
      originalCumulativeWaterG: step.cumulativeWaterG,
      cumulativeWaterG: scaledCumWater
    };
  });

  return {
    presetId: preset.id,
    baristaName: preset.baristaName,
    recipeName: preset.recipeName,
    isScaledFromOriginal: isScaled,
    scalingStatus: isScaled ? "scaled_from_original_dose_caution_bed_depth" : "original_unmodified_recipe",
    scalingNotice: isScaled
      ? `원본 레시피(${preset.coffeeDose}g : ${preset.waterAmount}g)를 ${targetDose}g 기준으로 비례 환산한 수치입니다. 커피층 깊이 변화로 인해 추출 시간과 분쇄도는 원본과 달라질 수 있습니다.`
      : `원본 바리스타 레시피(${preset.coffeeDose}g : ${preset.waterAmount}g, 1:${preset.ratio}) 그대로입니다.`,
    originalRecipe: {
      coffeeDose: preset.coffeeDose,
      waterAmount: preset.waterAmount,
      ratio: preset.ratio,
      pourSchedule: preset.pourSchedule
    },
    activeRecipe: {
      coffeeDose: targetDose,
      waterAmount: scaledTotalWater,
      ratio: preset.ratio,
      temperature: preset.temperature,
      grindGuidance: preset.grindGuidance,
      pourSchedule: scaledSchedule,
      targetTime: preset.targetTime
    },
    sourceUrl: preset.sourceUrl,
    sourceType: preset.sourceType,
    verificationStatus: preset.verificationStatus
  };
}
window.getBaristaPresetWithScaling = getBaristaPresetWithScaling;

// ============================================================================
// 6. SCA 골든컵(Golden Cup) 기준 및 실측 TDS · 추출수율(EY) 계산 규칙
//    - 실측 TDS(%)와 실제 음료 질량(g)이 입력되지 않으면 측정값처럼 표시하지 않음
// ============================================================================
const SCA_GOLDEN_CUP_STANDARD = {
  id: "scaa_sca_golden_cup_standard",
  name: "SCAA / SCA Golden Cup Standard",
  targetTDS_percentRange: [1.15, 1.35],
  targetEY_percentRange: [18.0, 22.0],
  referenceBrewRatioText: "물 1L당 커피 55g ± 10% (투입수 기준 약 1:16.5 ~ 1:20.2)",
  formulaText: "EY(%) = TDS(%) × 실제 완성 음료 무게(g) ÷ 원두 사용량(g)",
  sourceUrls: [
    "https://kimcoffee.net/PDF/resources/golden-cup-standard.pdf",
    "https://www.coffearium.org/entries/brewing-control-chart/"
  ],
  verificationStatus: "source_linked",
  scientificNotice: "물 투입량을 실제 음료 질량으로 대체할 수 없으며, 굴절계(Refractometer)로 측정한 TDS와 실제 추출 음료 무게가 없을 때는 '미측정(교육용 시뮬레이션 추정치)'으로 구분해야 합니다."
};
window.SCA_GOLDEN_CUP_STANDARD = SCA_GOLDEN_CUP_STANDARD;

/**
 * 실측 TDS(%)와 실제 완성 음료 무게(beverageMassG)가 주어졌을 때만 정확한 추출수율(EY)을 계산하는 함수
 */
function calculateMeasuredBrewMetrics(doseGrams, measuredTdsPercent = null, measuredBeverageMassG = null) {
  const dose = Number(doseGrams);
  const tds = measuredTdsPercent !== null && measuredTdsPercent !== "" ? Number(measuredTdsPercent) : null;
  const bevMass = measuredBeverageMassG !== null && measuredBeverageMassG !== "" ? Number(measuredBeverageMassG) : null;

  if (!dose || tds === null || bevMass === null || isNaN(tds) || isNaN(bevMass) || tds <= 0 || bevMass <= 0) {
    return {
      isMeasured: false,
      statusText: "측정값 입력 필요 (미측정 시뮬레이션 상태)",
      measuredTDS_percent: null,
      measuredBeverageMassG: null,
      calculatedEY_percent: null,
      withinGoldenCupTDS: null,
      withinGoldenCupEY: null
    };
  }

  const ey = (tds * bevMass) / dose;
  return {
    isMeasured: true,
    statusText: "실측 데이터 기반 계산 완료",
    measuredTDS_percent: Number(tds.toFixed(2)),
    measuredBeverageMassG: Number(bevMass.toFixed(1)),
    calculatedEY_percent: Number(ey.toFixed(2)),
    withinGoldenCupTDS: tds >= 1.15 && tds <= 1.35,
    withinGoldenCupEY: ey >= 18.0 && ey <= 22.0
  };
}
window.calculateMeasuredBrewMetrics = calculateMeasuredBrewMetrics;

// ================= [2부 전반부 끝 — 이어서 2부 후반부 코드가 연결됩니다] =================
// ============================================================================
// 7. 그라인더 설정 데이터 레지스트리 (총 13종 — COFFEE_GRINDERS)
//    - 사용자 실사용 기준값 보존: 페이마 600N = 4.5, 바라짜 엔코(Original) = 14
//    - 제조사 권장값(바라짜 엔코 V60 가이드 = 23 등)은 별도 필드로 분리 보존
//    - 그라인더 눈금·클릭 수와 입자 크기(μm) 임의 환산 금지 (micronCalibration: null)
// ============================================================================
const COFFEE_GRINDERS = [
  {
    id: "feima_600n",
    name: "페이마(Feima) 600N [약국]",
    manufacturer: "Feima (飛馬牌)",
    brand: "Feima",
    model: "600N",
    type: "electric",
    profile: "pharmacy",
    adjustmentType: "numbered_dial",
    dialMin: 1,
    dialMax: 8,
    standardPourOverSetting: 4.5,
    recommendedRange: { min: 4.5, max: 4.5, unit: "dial" },
    adjustment: { kind: "numbered_dial", min: 1, max: 8, step: 0.5, unit: "dial", finerDirection: "lower_number_finer_assumed_confirm_with_user" },
    userConfirmed: { pourOverStandard: 4.5, note: "사용자가 약국에서 실제 사용하는 표준값" },
    pourOver: { start: 4.5, min: 4.5, max: 4.5, unit: "dial", evidence: "user_confirmed", sourceUrl: null },
    manufacturerReference: null,
    micronCalibration: null,
    sourceUrls: [],
    verificationStatus: "user_confirmed_baseline",
    confidence: "user_confirmed_baseline",
    badgeText: "사용자 실사용 (약국 4.5)",
    shortSummary: "약국 실사용 기준: 다이얼 4.5 (1~8 눈금, 제조사 공식값 아님)",
    notes: "사용자 실사용 기준값(4.5). 제조사 권장값으로 표현하지 말 것. 다른 제품 눈금이나 μm로 환산 금지."
  },
  {
    id: "baratza_encore_original",
    name: "Baratza Encore (Original) [가정]",
    manufacturer: "Baratza",
    brand: "Baratza",
    model: "Encore (Original)",
    type: "electric",
    profile: "home",
    adjustmentType: "numbered_dial",
    dialMin: 1,
    dialMax: 40,
    standardPourOverSetting: 14,
    recommendedRange: { min: 14, max: 23, unit: "dial_setting", note: "사용자 실사용 기준 14 / 제조사 V60 가이드 시작값 23 별도 보존" },
    adjustment: { kind: "numbered_dial", min: 1, max: 40, unit: "dial_setting", finerDirection: "lower_number_finer" },
    userConfirmed: { pourOverStandard: 14, note: "사용자가 집에서 실제 사용하는 표준값" },
    pourOver: { start: 14, min: 14, max: 14, unit: "dial_setting", evidence: "user_confirmed", sourceUrl: null },
    manufacturerReference: {
      method: "V60",
      start: 23,
      unit: "dial_setting",
      evidence: "manufacturer_recipe",
      sourceUrl: "https://www.baratza.com/en-us/blog/brew-guides/hario-v60-brew-guide",
      note: "Baratza의 특정 V60 레시피용 시작값(23). 사용자 기준 14를 덮어쓰지 말 것."
    },
    micronCalibration: null,
    sourceUrls: ["https://www.baratza.com/en-us/blog/brew-guides/hario-v60-brew-guide"],
    verificationStatus: "user_confirmed_plus_manufacturer_reference",
    confidence: "user_confirmed_plus_manufacturer_reference",
    badgeText: "사용자 실사용(14) · 제조사 참고(23)",
    shortSummary: "가정 실사용 표준: 14 | 제조사 V60 가이드 참고값: 23 (별도 보존)",
    notes: "Original Encore와 Encore ESP를 구분할 것. 개인 프로필 선택 시 14를 우선 표시하고 제조사 V60 참고값 23을 보조 정보로 제공."
  },
  {
    id: "baratza_encore_esp",
    name: "Baratza Encore ESP",
    manufacturer: "Baratza",
    brand: "Baratza",
    model: "Encore ESP",
    type: "electric",
    adjustmentType: "numbered_dial",
    dialMin: 1,
    dialMax: 40,
    standardPourOverSetting: 25,
    recommendedRange: { min: 21, max: 30, filterZone: "21-40", unit: "dial_setting" },
    adjustment: { kind: "numbered_dial", min: 1, max: 40, unit: "dial_setting", finerDirection: "lower_number_finer", filterRange: "21-40" },
    userConfirmed: null,
    pourOver: { start: 25, min: 21, max: 30, unit: "dial_setting", evidence: "manufacturer_recipe", sourceUrl: "https://www.baratza.com/en-us/blog/brew-guides/hario-v60-brew-guide" },
    micronCalibration: null,
    sourceUrls: [
      "https://www.baratza.com/en-us/blog/brew-guides/hario-v60-brew-guide",
      "https://www.baratza.com/ko-kr/product/ZCG495?sku=ZCG495BLK5CSK1A"
    ],
    verificationStatus: "manufacturer_starting_point",
    confidence: "manufacturer_starting_point",
    badgeText: "제조사 가이드",
    shortSummary: "V60 시작점: 25 (권장 21~30 / 전체 필터 구간 21~40)",
    notes: "25는 Baratza V60 가이드의 시작 설정. 1-20은 에스프레소 구간, 21-40은 필터 구간으로 안내됨."
  },
  {
    id: "comandante_c40_mk4",
    name: "Comandante C40 MK4",
    manufacturer: "Comandante",
    brand: "Comandante",
    model: "C40 MK4",
    type: "manual",
    adjustmentType: "clicks_from_zero",
    dialMin: 0,
    dialMax: 40,
    standardPourOverSetting: 27,
    recommendedRange: { min: 18, max: 35, unit: "clicks_from_zero" },
    adjustment: { kind: "clicks_from_zero", min: 0, max: 40, unit: "clicks", finerDirection: "lower_click_count_finer" },
    userConfirmed: null,
    pourOver: { start: 27, min: 18, max: 35, unit: "clicks_from_zero", evidence: "manufacturer_range_plus_midpoint_start", sourceUrl: "https://comandantegrinder.com/pages/faq" },
    micronCalibration: null,
    sourceUrls: ["https://comandantegrinder.com/pages/faq"],
    verificationStatus: "manufacturer_range",
    confidence: "manufacturer_range",
    badgeText: "제조사 FAQ 범위",
    shortSummary: "제조사 푸어오버 범위: 18~35 clicks (앱 중간 시작점: 27 clicks)",
    notes: "공식 FAQ의 pour-over 시작 범위는 18-35 clicks. 27은 해당 범위의 중간 편의 시작값이지 제조사의 단일 공식값이 아님."
  },
  {
    id: "timemore_c2",
    name: "Timemore Chestnut C2",
    manufacturer: "Timemore",
    brand: "Timemore",
    model: "Chestnut C2",
    type: "manual",
    adjustmentType: "clicks_from_zero",
    dialMin: 0,
    dialMax: 36,
    standardPourOverSetting: 16,
    recommendedRange: { min: 15, max: 18, unit: "clicks" },
    adjustment: { kind: "clicks_from_zero", unit: "clicks", finerDirection: "lower_click_count_finer", zeroConvention: "verify_model_manual" },
    userConfirmed: null,
    pourOver: { start: 16, min: 15, max: 18, unit: "clicks", evidence: "community_starting_range", sourceUrl: "https://www.browncherry.co.kr/article/%EB%89%B4%EC%8A%A4%EC%9D%B4%EB%B2%A4%ED%8A%B8/2/13497/" },
    micronCalibration: null,
    sourceUrls: ["https://www.browncherry.co.kr/article/%EB%89%B4%EC%8A%A4%EC%9D%B4%EB%B2%A4%ED%8A%B8/2/13497/"],
    verificationStatus: "community_estimate",
    confidence: "community_estimate",
    badgeText: "커뮤니티 참고",
    shortSummary: "커뮤니티 시작 범위: 약 15~18 clicks (시작점: 16 clicks)",
    notes: "모델 생산 버전과 클릭 카운트 관행 차이가 있어 시작 범위로만 사용. 공식 제조사 표준으로 표시하지 말 것."
  },
  {
    id: "timemore_c3_c3pro",
    name: "Timemore Chestnut C3 / C3 Pro",
    manufacturer: "Timemore",
    brand: "Timemore",
    model: "Chestnut C3 / C3 Pro",
    type: "manual",
    adjustmentType: "clicks_from_zero",
    dialMin: 0,
    dialMax: 36,
    standardPourOverSetting: 15,
    recommendedRange: { min: 13, max: 18, unit: "clicks" },
    adjustment: { kind: "clicks_from_zero", unit: "clicks", finerDirection: "lower_click_count_finer", zeroConvention: "verify_model_manual" },
    userConfirmed: null,
    pourOver: { start: 15, min: 13, max: 18, unit: "clicks", evidence: "community_starting_range", sourceUrl: "https://brewratio.coffee/grind-settings" },
    micronCalibration: null,
    sourceUrls: [
      "https://brewratio.coffee/grind-settings",
      "https://www.browncherry.co.kr/article/%EB%89%B4%EC%8A%A4%EC%9D%B4%EB%B2%A4%ED%8A%B8/2/13497/"
    ],
    verificationStatus: "community_estimate",
    confidence: "community_estimate",
    badgeText: "커뮤니티 참고",
    shortSummary: "커뮤니티 시작 범위: 약 13~18 clicks (시작점: 15 clicks)",
    notes: "C3/C3 Pro/C3S 및 버전에 따라 세팅 관행이 다를 수 있음. 범위를 초기 참고값으로만 표시."
  },
  {
    id: "1zpresso_k_ultra",
    name: "1Zpresso K-Ultra",
    manufacturer: "1Zpresso",
    brand: "1Zpresso",
    model: "K-Ultra",
    type: "manual",
    adjustmentType: "external_dial_with_subticks",
    dialMin: 0,
    dialMax: 10,
    standardPourOverSetting: 8.5,
    recommendedRange: { min: 8.0, max: 9.0, unit: "dial_setting" },
    adjustment: { kind: "external_dial_with_subticks", unit: "dial_setting", finerDirection: "lower_setting_finer", displayFormat: "8.0" },
    userConfirmed: null,
    pourOver: { start: 8.5, min: 8.0, max: 9.0, unit: "dial_setting", evidence: "compiled_starting_range", sourceUrl: "https://brewratio.coffee/grind-settings" },
    micronCalibration: null,
    sourceUrls: [
      "https://brewratio.coffee/grind-settings",
      "https://www.browncherry.co.kr/article/%EB%89%B4%EC%8A%A4%EC%9D%B4%EB%B2%A4%ED%8A%B8/2/13497/"
    ],
    verificationStatus: "reference_range",
    confidence: "reference_range",
    badgeText: "참고 범위",
    shortSummary: "외부 숫자 다이얼: 약 8.0~9.0 (시작점: 8.5, 원시 클릭수 변환 금지)",
    notes: "다른 1Zpresso 모델의 click count와 혼용하지 말 것. 사용자 영점과 모델별 조절 체계를 확인."
  },
  {
    id: "1zpresso_zp6_special",
    name: "1Zpresso ZP6 Special",
    manufacturer: "1Zpresso",
    brand: "1Zpresso",
    model: "ZP6 Special",
    type: "manual",
    adjustmentType: "external_dial_with_subticks",
    dialMin: 0,
    dialMax: 9,
    standardPourOverSetting: 4.5,
    recommendedRange: { min: 4.0, max: 5.0, unit: "dial_setting", alternateDisplay: "약 40-50 clicks" },
    adjustment: { kind: "external_dial_with_subticks", min: 0, max: 9, unit: "dial_setting", clicksPerRotation: 90, finerDirection: "lower_setting_finer" },
    userConfirmed: null,
    pourOver: { start: 4.5, min: 4.0, max: 5.0, unit: "dial_setting", alternateDisplay: "약 40-50 clicks", evidence: "community_starting_range", sourceUrl: "https://brewmark.io/methods/pour-over" },
    manufacturerReference: { detail: "9 numbered marks and 90 clicks per rotation; designed primarily for pour-over", sourceUrl: "https://1zpresso.coffee/zp6/" },
    micronCalibration: null,
    sourceUrls: [
      "https://1zpresso.coffee/zp6/",
      "https://brewmark.io/methods/pour-over"
    ],
    verificationStatus: "mechanism_manufacturer_range_community_setting",
    confidence: "mechanism_manufacturer_range_community_setting",
    badgeText: "기구규격 + 커뮤니티 시작값",
    shortSummary: "외부 다이얼: 약 4.0~5.0 (시작 4.5 / 보조 표기 약 40~50 clicks)",
    notes: "클릭/숫자 다이얼 표기를 별도 필드로 보관. 숫자에서 clicks를 파생할 경우 모델 설명서와 실제 영점을 확인."
  },
  {
    id: "kingrinder_k6",
    name: "KINGrinder K6",
    manufacturer: "KINGrinder",
    brand: "KINGrinder",
    model: "K6",
    type: "manual",
    adjustmentType: "clicks_from_zero",
    dialMin: 0,
    dialMax: 240,
    standardPourOverSetting: 100,
    recommendedRange: { min: 90, max: 120, unit: "clicks_from_zero" },
    adjustment: { kind: "clicks_from_zero", unit: "clicks", clicksPerRotation: 60, finerDirection: "lower_click_count_finer" },
    userConfirmed: null,
    pourOver: { start: 100, min: 90, max: 120, unit: "clicks_from_zero", evidence: "manual_copy_and_manufacturer_grind_chart", sourceUrl: "https://www.kingrinder.com/_blog" },
    micronCalibration: null,
    sourceUrls: [
      "https://www.kingrinder.com/_blog",
      "https://brewratio.coffee/grind-settings"
    ],
    verificationStatus: "reference_range",
    confidence: "reference_range",
    badgeText: "제조사 차트 참고",
    shortSummary: "0점 기준 약 90~120 clicks (시작점: 100 clicks, 1회전 60 clicks)",
    notes: "0점까지 부드럽게 닫아 기준을 잡되 세게 조이지 말 것. 제조사 차트의 medium-fine/medium 범위 확인."
  },
  {
    id: "fellow_ode_gen2",
    name: "Fellow Ode Gen 2",
    manufacturer: "Fellow",
    brand: "Fellow",
    model: "Ode Brew Grinder Gen 2",
    type: "electric",
    adjustmentType: "numbered_dial_with_subticks",
    dialMin: 1,
    dialMax: 11,
    standardPourOverSetting: 6.0,
    recommendedRange: { min: 5.0, max: 7.0, unit: "dial_setting", smallBatchStart: 8, largeBatchStart: 10 },
    adjustment: { kind: "numbered_dial_with_subticks", min: 1, max: 11, unit: "dial_setting", finerDirection: "lower_setting_finer", burrVersion: "Gen 2 Brew Burrs" },
    userConfirmed: null,
    pourOver: { start: 6.0, min: 5.0, max: 7.0, unit: "dial_setting", evidence: "manufacturer_recipe_range", sourceUrl: "https://fellowproducts.com/blogs/brew-talks/fellows-take-on-house-blend-by-honey-moon-brew-guide" },
    batchAdjustment: { smallBatchStart: 8, largeBatchStart: 10, sourceUrl: "https://help.fellowproducts.com/hc/en-us/articles/29101533994267-How-should-I-dial-in-my-grinder-when-brewing-with-Aiden-Getting-Started-With-Aiden-Pt-3" },
    micronCalibration: null,
    sourceUrls: [
      "https://fellowproducts.com/blogs/brew-talks/fellows-take-on-house-blend-by-honey-moon-brew-guide",
      "https://help.fellowproducts.com/hc/en-us/articles/29101533994267-How-should-I-dial-in-my-grinder-when-brewing-with-Aiden-Getting-Started-With-Aiden-Pt-3"
    ],
    verificationStatus: "manufacturer_recipe_range",
    confidence: "manufacturer_recipe_range",
    badgeText: "제조사 가이드",
    shortSummary: "푸어오버 약 5.0~7.0 (시작 6.0 / 큰 배치는 8~10 더 굵게 시작)",
    notes: "Ode Gen 1과 Gen 2 버를 구분. 에스프레소 분쇄용으로 설계한 제품이 아님."
  },
  {
    id: "fellow_opus",
    name: "Fellow Opus",
    manufacturer: "Fellow",
    brand: "Fellow",
    model: "Opus Conical Burr Grinder",
    type: "electric",
    adjustmentType: "outer_dial_plus_inner_ring",
    dialMin: 1,
    dialMax: 11,
    standardPourOverSetting: 6.5,
    recommendedRange: { min: 5.0, max: 9.0, unit: "outer_dial", innerRingMustBeRecorded: true },
    adjustment: { kind: "outer_dial_plus_inner_ring", min: 1, max: 11, unit: "outer_dial", finerDirection: "lower_setting_finer", innerRingMustBeRecorded: true },
    userConfirmed: null,
    pourOver: { start: 6.5, min: 5.0, max: 9.0, unit: "outer_dial", evidence: "manufacturer_guidance_and_recipe_range", sourceUrl: "https://help.fellowproducts.com/hc/en-us/articles/29101533994267-How-should-I-dial-in-my-grinder-when-brewing-with-Aiden-Getting-Started-With-Aiden-Pt-3", innerRingSetting: "기준 설정/레시피에서 실제 위치 기록" },
    batchAdjustment: { smallBatchStart: 8, largeBatchStart: 10.5, sourceUrl: "https://help.fellowproducts.com/hc/en-us/articles/29101533994267-How-should-I-dial-in-my-grinder-when-brewing-with-Aiden-Getting-Started-With-Aiden-Pt-3" },
    micronCalibration: null,
    sourceUrls: [
      "https://help.fellowproducts.com/hc/en-us/articles/29101533994267-How-should-I-dial-in-my-grinder-when-brewing-with-Aiden-Getting-Started-With-Aiden-Pt-3",
      "https://fellowproducts.com/blogs/brew-talks/fellows-take-on-house-blend-by-honey-moon-brew-guide"
    ],
    verificationStatus: "manufacturer_guidance_and_recipe_range",
    confidence: "manufacturer_guidance_and_recipe_range",
    badgeText: "제조사 가이드 (내부링 기록필수)",
    shortSummary: "외부 다이얼 약 5.0~9.0 (Single 시작 6.5 · 내부 미세조절 링 위치 함께 기록 필수)",
    notes: "외부 숫자만으로 세팅을 식별하지 말 것. 내부 조절 링 위치를 함께 저장해야 같은 세팅을 재현할 수 있음."
  },
  {
    id: "oxo_brew_conical_burr",
    name: "OXO Brew Conical Burr Coffee Grinder",
    manufacturer: "OXO",
    brand: "OXO",
    model: "Brew Conical Burr Grinder",
    type: "electric",
    adjustmentType: "numbered_dial",
    dialMin: 1,
    dialMax: 15,
    standardPourOverSetting: 8,
    recommendedRange: { min: 6, max: 10, unit: "dial_setting" },
    adjustment: { kind: "numbered_dial", min: 1, max: 15, unit: "dial_setting", finerDirection: "lower_number_finer" },
    userConfirmed: null,
    pourOver: { start: 8, min: 6, max: 10, unit: "dial_setting", evidence: "manufacturer_guide", sourceUrl: "https://www.oxo.com/blog/coffee-and-beverages/how-to-use-the-oxo-brew-conical-burr-grinder" },
    micronCalibration: null,
    sourceUrls: ["https://www.oxo.com/blog/coffee-and-beverages/how-to-use-the-oxo-brew-conical-burr-grinder"],
    verificationStatus: "manufacturer_range",
    confidence: "manufacturer_range",
    badgeText: "제조사 가이드",
    shortSummary: "푸어오버/드립 범위: 6~10 (시작점: 8 / 1~5 에스프레소, 11~15 프렌치프레스)",
    notes: "제조사: 1-5 espresso/fine, 6-10 pour-over/drip, 11-15 French press/cold brew. Compact 모델과 혼동하지 말 것."
  },
  {
    id: "breville_smart_grinder_pro",
    name: "Breville / Sage Smart Grinder Pro",
    manufacturer: "Breville / Sage",
    brand: "Breville/Sage",
    model: "Smart Grinder Pro (BCG820)",
    type: "electric",
    adjustmentType: "numbered_dial",
    dialMin: 1,
    dialMax: 60,
    standardPourOverSetting: null,
    recommendedTrialStart: 38,
    recommendedRange: { min: 31, max: 45, unit: "dial_setting", note: "38은 범위 중앙의 앱 시험 시작점이며 제조사 지정 단일값이 아님" },
    adjustment: { kind: "numbered_dial", min: 1, max: 60, unit: "dial_setting", finerDirection: "lower_number_finer" },
    userConfirmed: null,
    pourOver: { start: null, recommendedTrialStart: 38, min: 31, max: 45, unit: "dial_setting", evidence: "manufacturer_manual_range", sourceUrl: "https://assets.breville.com/BCG820/BCG820_BSS_USCM_IB_I23_FA_Online.pdf" },
    micronCalibration: null,
    sourceUrls: ["https://assets.breville.com/BCG820/BCG820_BSS_USCM_IB_I23_FA_Online.pdf"],
    verificationStatus: "manufacturer_range_no_single_official_start",
    confidence: "manufacturer_range_no_single_official_start",
    badgeText: "제조사 설명서 범위(31~45)",
    shortSummary: "종이필터 드립 범위: 31~45 (제조사 단일 지정값 없음 · 앱 시험 시작점 38 참고)",
    notes: "제조사 설명서의 drip filter/paper-filter 범위가 31-45. 38을 앱에서 사용한다면 범위 중앙의 편의 초기값이라고 표시하고 공식 단일 권장값이라 하지 말 것."
  }
];
window.COFFEE_GRINDERS = COFFEE_GRINDERS;

function getGrinderDisplayInfo(grinderId) {
  const g = COFFEE_GRINDERS.find(item => item.id === grinderId) || COFFEE_GRINDERS[0];
  const hasRange = g.recommendedRange && g.recommendedRange.min !== g.recommendedRange.max;
  const rangeText = hasRange
    ? `${g.recommendedRange.min} ~ ${g.recommendedRange.max} (${g.recommendedRange.unit})`
    : `${g.standardPourOverSetting} (${g.recommendedRange ? g.recommendedRange.unit : g.adjustmentType})`;

  let startText = g.standardPourOverSetting !== null
    ? `${g.standardPourOverSetting} (${g.recommendedRange ? g.recommendedRange.unit : ""})`
    : `범위 ${g.recommendedRange.min}~${g.recommendedRange.max} (시험 시작점: ${g.recommendedTrialStart})`;

  if (g.userConfirmed) {
    startText = `${g.userConfirmed.pourOverStandard} [사용자 실사용 기준]`;
  }

  return {
    id: g.id,
    name: g.name,
    manufacturer: g.manufacturer,
    model: g.model,
    typeLabel: g.type === "electric" ? "전동" : "수동",
    adjustmentType: g.adjustmentType,
    dialMin: g.dialMin,
    dialMax: g.dialMax,
    standardPourOverSetting: g.standardPourOverSetting,
    recommendedRangeText: rangeText,
    recommendedStartText: startText,
    badgeText: g.badgeText,
    shortSummary: g.shortSummary,
    userConfirmed: g.userConfirmed,
    manufacturerReference: g.manufacturerReference || null,
    sourceUrls: g.sourceUrls,
    verificationStatus: g.verificationStatus,
    micronCalibration: null,
    notice: "설정값은 출발점입니다. 한 번에 한 단계씩 조정하세요."
  };
}
window.getGrinderDisplayInfo = getGrinderDisplayInfo;

// ============================================================================
// 8. 데이터 무결성 검증 및 통합 내보내기 인터페이스 (window.CoffeeRecipesData)
// ============================================================================
function validateCoffeeRecipesData() {
  const beanIds = COFFEE_BEANS.map(b => b.id);
  const dripperIds = Object.keys(DRIPPERS);
  const dripperPresetIds = DRIPPER_ORIGINAL_PRESETS.map(p => p.id);
  const baristaPresetIds = BARISTA_PRESETS.map(p => p.id);
  const grinderIds = COFFEE_GRINDERS.map(g => g.id);

  const hasDuplicate = arr => new Set(arr).size !== arr.length;

  let bypassNonNegativeAll = true;
  WEIGHTS.forEach(w => {
    const bp = BREW_MODE_TABLE[w].bypass;
    if (bp.bypassHotWaterG < 0 || (bp.dripperInputWaterG + bp.bypassHotWaterG !== bp.totalInputWaterG)) {
      bypassNonNegativeAll = false;
    }
  });

  const feima = COFFEE_GRINDERS.find(g => g.id === "feima_600n");
  const encore = COFFEE_GRINDERS.find(g => g.id === "baratza_encore_original");

  return {
    isValid:
      !hasDuplicate(beanIds) &&
      !hasDuplicate(dripperIds) &&
      !hasDuplicate(dripperPresetIds) &&
      !hasDuplicate(baristaPresetIds) &&
      !hasDuplicate(grinderIds) &&
      bypassNonNegativeAll &&
      feima?.userConfirmed?.pourOverStandard === 4.5 &&
      encore?.userConfirmed?.pourOverStandard === 14 &&
      encore?.manufacturerReference?.start === 23,
    counts: {
      weights: WEIGHTS.length,
      brewModes: Object.keys(BREW_MODES).length,
      beans: COFFEE_BEANS.length,
      drippers: dripperIds.length,
      dripperOriginalPresets: dripperPresetIds.length,
      baristaPresets: baristaPresetIds.length,
      grinders: grinderIds.length
    },
    bypassNonNegativeAll: bypassNonNegativeAll
  };
}
window.validateCoffeeRecipesData = validateCoffeeRecipesData;

const CoffeeRecipesData = {
  version: "2026-10-29-v1",
  WEIGHTS: WEIGHTS,
  BREW_MODES: BREW_MODES,
  BREW_MODE_TABLE: BREW_MODE_TABLE,
  DRIPPERS: DRIPPERS,
  DRIPPER_ORIGINAL_PRESETS: DRIPPER_ORIGINAL_PRESETS,
  ORIGIN_DB: ORIGIN_DB,
  COFFEE_BEANS: COFFEE_BEANS,
  BARISTA_PRESETS: BARISTA_PRESETS,
  PUBLIC_BARISTA_RECIPES: BARISTA_PRESETS,
  SCA_GOLDEN_CUP_STANDARD: SCA_GOLDEN_CUP_STANDARD,
  COFFEE_GRINDERS: COFFEE_GRINDERS,
  calculateBrewModeWater: calculateBrewModeWater,
  getBaristaPresetWithScaling: getBaristaPresetWithScaling,
  calculateMeasuredBrewMetrics: calculateMeasuredBrewMetrics,
  getGrinderDisplayInfo: getGrinderDisplayInfo,
  validateCoffeeRecipesData: validateCoffeeRecipesData
};
window.CoffeeRecipesData = CoffeeRecipesData;

if (typeof module !== "undefined" && module.exports) {
  module.exports = CoffeeRecipesData;
}
