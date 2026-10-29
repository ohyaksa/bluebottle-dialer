/**
 * coffee_recipes.js
 * 드립 커피 브루잉 프로그램용 원두 레시피 · 추출 모드 · 그라인더 레지스트리 통합 데이터 파일
 * 업데이트 일자: 2026-10-29
 *
 * [과학적 검증 및 데이터 설계 원칙]
 * 1. 기존 index.html과 호환되는 전역 식별자(WEIGHTS, ORIGIN_DB, DRIPPERS)를 그대로 유지합니다.
 * 2. 원두별 수온·비율·추출 시간은 확정된 물리 상수가 아닌 '추천 시작값(Starting Point)'입니다.
 * 3. 7가지 원두 중량(15, 20, 25, 30, 35, 40, 50g)과 4가지 추출 모드(진하게 1:14, 표준 1:16.7, 연하게 1:18, 바이패스 1:12+가수)를 지원하며,
 *    모드 선택 시 배전도 보정을 중복 적용하지 않습니다.
 * 4. 총 투입수량(Input Water)과 실제 완성 음료 무게(Final Beverage Weight)를 구분하며,
 *    실측 굴절계(TDS) 및 음료 무게 측정이 없는 수치는 '미측정 시뮬레이션 추정치'로만 다룹니다.
 * 5. 그라인더의 다이얼·클릭 수는 실측 캘리브레이션 없이 입자 크기(μm)로 임의 환산하지 않습니다 (micronCalibration: null).
 * 6. 사용자 실사용 기준값(Feima 600N: 4.5, Baratza Encore Original: 14)과 제조사 가이드 값을 별도 필드로 보존합니다.
 */

// ============================================================================
// 1. 지원 원두 중량 (7단계: 15g, 20g, 25g, 30g, 35g, 40g, 50g)
// ============================================================================
const WEIGHTS = [15, 20, 25, 30, 35, 40, 50];
window.WEIGHTS = WEIGHTS;

// ============================================================================
// 2. 4가지 추출 모드 정의 및 중량별 투입수량 검증 테이블
// ============================================================================
const BREW_MODES = {
  strong: {
    id: "strong",
    name: "진하게",
    targetRatio: 14.0,
    brewRatio: 14.0,
    isBypass: false,
    description: "원두 대비 1:14 비율로 총 투입수량을 줄여 높은 농도(TDS)와 묵직한 바디감을 강조하는 시작점입니다."
  },
  standard: {
    id: "standard",
    name: "표준",
    targetRatio: 16.7,
    brewRatio: 16.7,
    isBypass: false,
    description: "원두 대비 1:16.7(약 60g/L, SCA 골든컵 기준 비율)로 추출하는 표준 시작점입니다."
  },
  light: {
    id: "light",
    name: "연하게",
    targetRatio: 18.0,
    brewRatio: 18.0,
    isBypass: false,
    description: "원두 대비 1:18(약 55.6g/L) 비율로 총 투입수량을 늘려 깔끔하고 부드러운 농도로 마시는 시작점입니다."
  },
  bypass: {
    id: "bypass",
    name: "바이패스 (추출 후 온수 추가)",
    targetRatio: 16.7,
    brewRatio: 12.0,
    isBypass: true,
    description: "드리퍼에는 원두 대비 1:12의 물만 부어 먼저 추출한 뒤, 서버에 온수를 추가하여 표준 모드(1:16.7)와 동일한 총 투입수량을 맞춥니다. 드리퍼 내 후반부 과다 추출 성분의 유입을 줄이고 농도를 조절하는 방식입니다(단, 떫은맛을 원천 차단한다고 단정하지 않음)."
  }
};
window.BREW_MODES = BREW_MODES;

/**
 * 원두 중량(doseG)과 추출 모드(modeKey)에 따른 투입수량 정밀 계산 함수
 * - 배전도 보정을 중복 적용하지 않으며, 정수 단위로 반올림(Math.round)합니다.
 * - 총 투입수량과 미측정 예상 완성 음료 무게를 분리하여 반환합니다.
 */
function calculateBrewModeWater(doseG, modeKey = "standard", customOriginRatio = null) {
  const dose = Number(doseG) || 30;

  // 원두 고유 비율 모드('origin_default')를 명시적으로 요청한 경우에만 원두 고유 비율 단독 사용
  if (modeKey === "origin_default" && customOriginRatio) {
    const totalInputWater = Math.round(dose * Number(customOriginRatio));
    return {
      mode: "origin_default",
      doseG: dose,
      targetRatio: Number(customOriginRatio),
      brewRatio: Number(customOriginRatio),
      dripperInputWaterG: totalInputWater,
      bypassHotWaterG: 0,
      totalInputWaterG: totalInputWater,
      estimatedRetentionG_unverified: Math.round(dose * 2.0),
      estimatedBeverageWeightG_unverified: Math.max(0, totalInputWater - Math.round(dose * 2.0)),
      measurementStatus: "unmeasured_estimate_only"
    };
  }

  const mode = BREW_MODES[modeKey] || BREW_MODES.standard;
  const totalInputWater = Math.round(dose * mode.targetRatio);

  if (mode.isBypass) {
    const dripperInputWater = Math.round(dose * mode.brewRatio); // 1:12
    const bypassWater = totalInputWater - dripperInputWater;     // 표준 총투입수량 - 드리퍼 투입수량
    return {
      mode: mode.id,
      doseG: dose,
      targetRatio: mode.targetRatio,
      brewRatio: mode.brewRatio,
      dripperInputWaterG: dripperInputWater,
      bypassHotWaterG: bypassWater,
      totalInputWaterG: totalInputWater,
      estimatedRetentionG_unverified: Math.round(dose * 2.0),
      estimatedBeverageWeightG_unverified: Math.max(0, (dripperInputWater - Math.round(dose * 2.0)) + bypassWater),
      measurementStatus: "unmeasured_estimate_only"
    };
  }

  return {
    mode: mode.id,
    doseG: dose,
    targetRatio: mode.targetRatio,
    brewRatio: mode.brewRatio,
    dripperInputWaterG: totalInputWater,
    bypassHotWaterG: 0,
    totalInputWaterG: totalInputWater,
    estimatedRetentionG_unverified: Math.round(dose * 2.0),
    estimatedBeverageWeightG_unverified: Math.max(0, totalInputWater - Math.round(dose * 2.0)),
    measurementStatus: "unmeasured_estimate_only"
  };
}
window.calculateBrewModeWater = calculateBrewModeWater;

// 7개 중량 × 4개 추출 모드 사전 계산 검증 테이블
const BREW_MODE_TABLE = {};
WEIGHTS.forEach(w => {
  BREW_MODE_TABLE[w] = {
    strong: calculateBrewModeWater(w, "strong"),
    standard: calculateBrewModeWater(w, "standard"),
    light: calculateBrewModeWater(w, "light"),
    bypass: calculateBrewModeWater(w, "bypass")
  };
});
window.BREW_MODE_TABLE = BREW_MODE_TABLE;

// ============================================================================
// 3. 드리퍼 3종 물리·형상 특성 데이터 (기존 index.html 완벽 호환)
// ============================================================================
const DRIPPERS = {
  bluebottle: {
    name: "블루보틀",
    fullName: "블루보틀 드리퍼",
    badge: "B",
    geometry: "flat_bed_single_hole_40_capillary_ribs",
    themeColor: "#00a1e4",
    themeDark: "#0077ac",
    themeSoft: "#e7f5ff",
    grindOffset: 0,
    timeOffset: 0,
    retention: 2.0,
    acidityBias: 1.0,
    sweetBias: 1.12,
    bodyBias: 1.05,
    note: "플랫베드 구조와 40개 모세관 리브, 단일 추출구를 가진 드리퍼입니다."
  },
  hario: {
    name: "하리오V60",
    fullName: "하리오 V60",
    badge: "V",
    geometry: "cone_60deg_spiral_ribs_large_single_hole",
    themeColor: "#e03131",
    themeDark: "#c92a2a",
    themeSoft: "#fff5f5",
    grindOffset: -60,
    timeOffset: -20,
    retention: 1.9,
    acidityBias: 1.15,
    sweetBias: 1.0,
    bodyBias: 0.92,
    note: "60도 원추형 구조와 나선형 리브, 큰 단일 추출구로 푸어링 속도에 따라 유속 변화 폭이 큽니다."
  },
  kalita: {
    name: "칼리타",
    fullName: "칼리타 웨이브",
    badge: "K",
    geometry: "flat_bed_wave_filter_three_small_holes",
    themeColor: "#d9480f",
    themeDark: "#b43c0c",
    themeSoft: "#fff4e6",
    grindOffset: 40,
    timeOffset: 10,
    retention: 2.1,
    acidityBias: 0.93,
    sweetBias: 1.14,
    bodyBias: 1.10,
    note: "플랫베드 바닥의 3개 소형 추출구와 웨이브 필터가 배수 속도를 완만하게 제어합니다."
  }
};
window.DRIPPERS = DRIPPERS;

// ============================================================================
// 4. 산지별 · 배전도별 표준 시작점 원두 레시피 데이터베이스 (16종)
//    - 기존 index.html의 8개 키(geisha, yirgacheffe, kenya, colombia, thailand, guatemala, mandheling, darkblend) 100% 호환 유지
//    - WEIGHTS 7단계 [15, 20, 25, 30, 35, 40, 50] 대응 배열 탑재
//    - grinds 배열은 기존 index.html의 레거시 시뮬레이션 수식 호환용 참조치이며, 실제 그라인더 눈금과 등가 환산하지 않음
// ============================================================================
const ORIGIN_DB = {
  // [1] 파나마 게이샤 워시드 (기존 키 호환: geisha)
  geisha: {
    id: "geisha",
    name: "파나마 에스메랄다 게이샤 (약배전 · 워시드)",
    country: "파나마 (Panama)",
    region: "보케테 (Boquete)",
    variety: "Geisha (Gesha)",
    process: "워시드 (Washed)",
    roast: "약배전",
    roastLevel: "Light",
    flavorNotes: ["자스민", "베르가못", "백도(화이트 피치)", "실키한 티 라이크 질감"],
    flavorDisclaimer: "일반적인 컵 프로파일 참고치이며 로스터리와 수확 연도(Crop)에 따라 달라질 수 있습니다.",
    temp: 94.5,
    recommendedTempRangeC: [93.0, 96.0],
    ratio: 16.7,
    originReferenceRatio: 17.0,
    grinds: [660, 700, 740, 760, 790, 820, 870], // 레거시 UI 수식 호환용 (그라인더 클릭 환산 금지)
    times:  [150, 170, 190, 210, 225, 240, 265], // 15g, 20g, 25g, 30g, 35g, 40g, 50g 추천 시작 시간(초)
    recommendedTimeRangeSec30g: [195, 225],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "specialty_roaster_and_sca_adapted",
      verified: false,
      note: "고밀도 약배전 워시드 원두의 용출을 돕기 위한 고온 시작점입니다. 추출 시간과 맛을 보고 분쇄도를 조절하세요."
    },
    note: "[추천 시작값] 자스민 플로럴과 화사한 산미를 살리기 위해 93~96°C 고온과 1:16.7(산지 참고 1:17) 비율에서 시작합니다."
  },

  // [2] 에티오피아 게샤 빌리지 내추럴
  ethiopia_gesha_natural: {
    id: "ethiopia_gesha_natural",
    name: "에티오피아 게샤 빌리지 (약배전 · 내추럴)",
    country: "에티오피아 (Ethiopia)",
    region: "벤치 마지 (Bench Maji)",
    variety: "Gori Gesha / Gesha 1931",
    process: "내추럴 (Natural)",
    roast: "약배전",
    roastLevel: "Light",
    flavorNotes: ["열대과일", "딸기", "오렌지 블로썸", "와이니한 여운"],
    flavorDisclaimer: "블록(Block) 및 로트별로 향미 차이가 큽니다.",
    temp: 94.0,
    recommendedTempRangeC: [92.0, 95.0],
    ratio: 16.7,
    originReferenceRatio: 16.5,
    grinds: [680, 720, 750, 780, 810, 840, 890],
    times:  [150, 170, 190, 210, 225, 240, 265],
    recommendedTimeRangeSec30g: [190, 220],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "specialty_roaster_common_guide",
      verified: false,
      note: "내추럴 가공 약배전 원두의 과일 향미와 단맛 균형을 위한 시작점입니다."
    },
    note: "[추천 시작값] 내추럴 특유의 열대과일 아로마와 단맛을 위해 94.0°C 내외에서 시작합니다."
  },

  // [3] 에티오피아 예가체프 G1 워시드 (기존 키 호환: yirgacheffe)
  yirgacheffe: {
    id: "yirgacheffe",
    name: "에티오피아 예가체프 G1 (약배전 · 워시드)",
    country: "에티오피아 (Ethiopia)",
    region: "예가체프 (Yirgacheffe)",
    variety: "Ethiopian Heirloom (토착종)",
    process: "워시드 (Washed)",
    roast: "약배전",
    roastLevel: "Light",
    flavorNotes: ["레몬그라스", "베르가못", "홍차", "깔끔한 시트러스 산미"],
    flavorDisclaimer: "워시드 예가체프의 전형적인 참고 노트입니다.",
    temp: 94.0,
    recommendedTempRangeC: [92.0, 95.0],
    ratio: 16.7,
    originReferenceRatio: 16.5,
    grinds: [680, 720, 750, 780, 810, 840, 890],
    times:  [155, 175, 195, 215, 230, 245, 270],
    recommendedTimeRangeSec30g: [195, 225],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "specialty_roaster_common_guide",
      verified: false,
      note: "에티오피아 토착종은 분쇄 시 미분 발생이 비교적 많아 배수 시간이 길어질 수 있으므로 유속 확인이 필요합니다."
    },
    note: "[추천 시작값] 홍차 같은 여운과 시트러스 산미를 위한 약배전 시작점입니다. 미분으로 물 빠짐이 느려지면 분쇄도를 한 단계 굵게 조절하세요."
  },

  // [4] 에티오피아 예가체프 코케 허니 (기존 예가체프에서 분리)
  ethiopia_koke_honey: {
    id: "ethiopia_koke_honey",
    name: "에티오피아 예가체프 코케 허니 (약~중약배전 · 허니)",
    country: "에티오피아 (Ethiopia)",
    region: "예가체프 코케 (Yirgacheffe Koke)",
    variety: "Ethiopian Heirloom",
    process: "허니 / 내추럴 계열 (Honey Process)",
    roast: "약배전",
    roastLevel: "Light-Medium",
    flavorNotes: ["살구", "황도 복숭아", "꿀 단맛", "부드러운 산미"],
    flavorDisclaimer: "로스터리의 배전 포인트에 따라 산미와 단맛 비중이 달라집니다.",
    temp: 93.0,
    recommendedTempRangeC: [91.0, 94.0],
    ratio: 16.7,
    originReferenceRatio: 16.5,
    grinds: [700, 740, 770, 800, 830, 860, 910],
    times:  [150, 170, 190, 210, 225, 240, 265],
    recommendedTimeRangeSec30g: [190, 220],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "roaster_common_starting_point",
      verified: false,
      note: "워시드보다 점액질 당분이 남아 있어 수온을 93°C 부근으로 한 단계 낮춰 시작합니다."
    },
    note: "[추천 시작값] 핵과류(살구·복숭아) 단맛과 부드러운 산미를 위한 허니 프로세스 시작점입니다."
  },

  // [5] 에티오피아 구지 G1 내추럴
  ethiopia_guji_natural: {
    id: "ethiopia_guji_natural",
    name: "에티오피아 구지 G1 (약~중약배전 · 내추럴)",
    country: "에티오피아 (Ethiopia)",
    region: "구지 (Guji)",
    variety: "Ethiopian Heirloom",
    process: "내추럴 (Natural)",
    roast: "약배전",
    roastLevel: "Light-Medium",
    flavorNotes: ["블루베리", "적포도", "밀크초콜릿 여운", "화사한 꽃향"],
    flavorDisclaimer: "참고용 테이스팅 노트입니다.",
    temp: 93.0,
    recommendedTempRangeC: [91.0, 94.0],
    ratio: 16.7,
    originReferenceRatio: 16.5,
    grinds: [700, 740, 770, 800, 830, 860, 910],
    times:  [150, 170, 190, 210, 225, 240, 265],
    recommendedTimeRangeSec30g: [190, 220],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "roaster_common_starting_point",
      verified: false,
      note: "내추럴 원두의 과일 발효 뉘앙스가 과도해지지 않도록 91~94°C 범위에서 조절합니다."
    },
    note: "[추천 시작값] 베리류 향미와 달콤한 여운을 강조하는 구지 내추럴 추천 시작점입니다."
  },

  // [6] 케냐 AA 워시드 (기존 키 호환: kenya)
  kenya: {
    id: "kenya",
    name: "케냐 AA (약~중약배전 · 워시드)",
    country: "케냐 (Kenya)",
    region: "니에리 / 키리냐가 (Nyeri / Kirinyaga)",
    variety: "SL28, SL34 (일부 Ruiru 11, Batian)",
    process: "워시드 (Double Fermentation Washed)",
    roast: "약배전",
    roastLevel: "Light-Medium",
    flavorNotes: ["자몽", "블랙커런트", "방울토마토", "쥬시한 바디감"],
    flavorDisclaimer: "배전도에 따라 자몽 산미(약배전) 또는 캐러멜·베리 단맛(중배전)으로 달라집니다.",
    temp: 93.5,
    recommendedTempRangeC: [92.0, 95.0],
    ratio: 16.7,
    originReferenceRatio: 16.0,
    grinds: [700, 740, 770, 800, 830, 860, 910],
    times:  [155, 175, 195, 215, 230, 245, 270],
    recommendedTimeRangeSec30g: [195, 225],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "roaster_common_starting_point",
      verified: false,
      note: "고지대 고밀도 원두로 충분한 열량(93.5°C 내외)이 필요하나, 산미가 날카로우면 수온을 높이거나 분쇄도를 조금 가늘게 조정합니다."
    },
    note: "[추천 시작값] 케냐 특유의 쥬시한 과일 산미와 단맛 밸런스를 맞추기 위한 시작점입니다."
  },

  // [7] 콜롬비아 수프리모 워시드 (기존 키 호환: colombia)
  colombia: {
    id: "colombia",
    name: "콜롬비아 수프리모 후일라 (중배전 · 워시드)",
    country: "콜롬비아 (Colombia)",
    region: "후일라 / 안티오키아 (Huila / Antioquia)",
    variety: "Caturra, Castillo, Colombia",
    process: "워시드 (Washed)",
    roast: "중배전",
    roastLevel: "Medium",
    flavorNotes: ["캐러멜", "브라운 슈가", "붉은 사과 산미", "구운 호두"],
    flavorDisclaimer: "수프리모(Supremo)는 품종이 아니라 생두 크기(Screen 17~18 이상) 등급입니다.",
    temp: 91.5,
    recommendedTempRangeC: [90.0, 93.0],
    ratio: 16.7,
    originReferenceRatio: 16.0,
    grinds: [720, 760, 780, 800, 830, 860, 910],
    times:  [150, 170, 190, 210, 225, 240, 265],
    recommendedTimeRangeSec30g: [190, 220],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "sca_and_roaster_medium_roast_baseline",
      verified: false,
      note: "중배전 워시드 원두의 가장 보편적인 시작 온도(91~92°C)와 시간입니다."
    },
    note: "[추천 시작값] 캐러멜 단맛과 은은한 사과 산미, 고소함이 균형을 이루는 중배전 표준 시작점입니다."
  },

  // [8] 콜롬비아 에메랄드 마운틴 워시드 (기존 콜롬비아에서 분리)
  colombia_emerald_mountain: {
    id: "colombia_emerald_mountain",
    name: "콜롬비아 에메랄드 마운틴 (중배전 · 워시드)",
    country: "콜롬비아 (Colombia)",
    region: "안데스 고지대 수선별 구역",
    variety: "Caturra, Typica, Bourbon",
    process: "워시드 (FNC 엄선 수선별 Washed)",
    roast: "중배전",
    roastLevel: "Medium",
    flavorNotes: ["메이플 시럽", "구운 아몬드", "오렌지 뉘앙스", "클린하고 마일드한 여운"],
    flavorDisclaimer: "참고용 컵 노트입니다.",
    temp: 92.0,
    recommendedTempRangeC: [90.0, 93.0],
    ratio: 16.7,
    originReferenceRatio: 16.0,
    grinds: [720, 760, 780, 800, 830, 860, 910],
    times:  [150, 170, 190, 210, 225, 240, 265],
    recommendedTimeRangeSec30g: [190, 220],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "roaster_common_starting_point",
      verified: false,
      note: "결점두가 적은 고밀도 중배전 원두 기준 시작점입니다."
    },
    note: "[추천 시작값] 깔끔한 단맛과 마일드한 산미 밸런스를 위한 92.0°C 중배전 시작점입니다."
  },

  // [9] 태국 치앙마이 티피카 워시드 (기존 키 호환: thailand)
  thailand: {
    id: "thailand",
    name: "태국 치앙마이 티피카 (중배전 · 워시드)",
    country: "태국 (Thailand)",
    region: "치앙마이 도이창 / 매왕 (Chiang Mai)",
    variety: "Typica, Catimor, Catuai",
    process: "워시드 (Washed)",
    roast: "중배전",
    roastLevel: "Medium",
    flavorNotes: ["야생꿀 단맛", "은은한 허브", "홍차", "부드러운 바디"],
    flavorDisclaimer: "농장(예: Akha Ama 등) 및 가공 방식에 따라 프로파일이 달라집니다.",
    temp: 91.5,
    recommendedTempRangeC: [90.0, 93.0],
    ratio: 16.7,
    originReferenceRatio: 16.0,
    grinds: [720, 760, 780, 800, 830, 860, 910],
    times:  [150, 170, 185, 205, 220, 235, 260],
    recommendedTimeRangeSec30g: [185, 215],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "roaster_common_starting_point",
      verified: false,
      note: "중배전 아시아 아라비카 원두의 깔끔한 단맛과 허브 향미를 살리기 위한 시작점입니다."
    },
    note: "[추천 시작값] 은은한 꿀 단맛과 깔끔한 애프터테이스트를 위한 중배전 시작점입니다."
  },

  // [10] 과테말라 안티구아 SHB 워시드 (기존 키 호환: guatemala)
  guatemala: {
    id: "guatemala",
    name: "과테말라 안티구아 SHB (중~중강배전 · 워시드)",
    country: "과테말라 (Guatemala)",
    region: "안티구아 (Antigua)",
    variety: "Bourbon, Caturra, Catuai",
    process: "워시드 (Washed)",
    roast: "중배전",
    roastLevel: "Medium-Dark",
    flavorNotes: ["밀크초콜릿", "구운 견과류", "은은한 스모키", "풍부한 바디감"],
    flavorDisclaimer: "SHB(Strictly Hard Bean)는 해발 약 1,350m 이상 고지대 재배 등급입니다.",
    temp: 90.5,
    recommendedTempRangeC: [89.0, 92.0],
    ratio: 16.7,
    originReferenceRatio: 15.5,
    grinds: [740, 780, 800, 820, 850, 880, 930],
    times:  [150, 170, 185, 205, 220, 235, 260],
    recommendedTimeRangeSec30g: [185, 215],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "roaster_common_starting_point",
      verified: false,
      note: "중~중강배전에서 초콜릿 단맛을 살리고 후반부 쓴맛을 줄이기 위해 90.5°C에서 시작합니다."
    },
    note: "[추천 시작값] 밀크초콜릿 단맛과 고소한 견과류 풍미를 위한 중~중강배전 시작점입니다."
  },

  // [11] 코스타리카 따라주 허니
  costa_rica_honey: {
    id: "costa_rica_honey",
    name: "코스타리카 따라주 (중배전 · 허니)",
    country: "코스타리카 (Costa Rica)",
    region: "따라주 (Tarrazú)",
    variety: "Caturra, Catuai",
    process: "허니 (Yellow / Red Honey)",
    roast: "중배전",
    roastLevel: "Medium",
    flavorNotes: ["메이플 시럽", "오렌지", "건포도", "버터처럼 매끄러운 질감"],
    flavorDisclaimer: "화이트/옐로우/레드/블랙 허니 단계에 따라 발효도와 단맛이 달라집니다.",
    temp: 91.0,
    recommendedTempRangeC: [89.5, 92.5],
    ratio: 16.7,
    originReferenceRatio: 16.0,
    grinds: [730, 770, 790, 810, 840, 870, 920],
    times:  [150, 170, 185, 205, 220, 235, 260],
    recommendedTimeRangeSec30g: [185, 215],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "roaster_common_starting_point",
      verified: false,
      note: "허니 가공 중배전 원두의 당도와 클린컵 균형을 위한 시작점입니다."
    },
    note: "[추천 시작값] 시럽 같은 단맛과 부드러운 과일 산미를 위한 중배전 허니 시작점입니다."
  },

  // [12] 브라질 세하도 NY2 내추럴 (기존 과테말라 통합본에서 분리)
  brazil_cerrado: {
    id: "brazil_cerrado",
    name: "브라질 세하도 NY2 (중~중강배전 · 내추럴)",
    country: "브라질 (Brazil)",
    region: "미나스제라이스 세하도 (Cerrado Mineiro)",
    variety: "Mundo Novo, Catuai, Bourbon",
    process: "내추럴 / 펄프드 내추럴 (Natural / Pulped Natural)",
    roast: "중배전",
    roastLevel: "Medium-Dark",
    flavorNotes: ["피넛버터", "구운 헤이즐넛", "다크초콜릿", "낮은 산미와 편안한 바디"],
    flavorDisclaimer: "NY2는 결점두 혼입 기준 등급 표기입니다.",
    temp: 90.0,
    recommendedTempRangeC: [88.0, 91.5],
    ratio: 16.7,
    originReferenceRatio: 15.5,
    grinds: [750, 790, 810, 830, 860, 890, 940],
    times:  [145, 165, 180, 200, 215, 230, 255],
    recommendedTimeRangeSec30g: [180, 210],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "roaster_common_starting_point",
      verified: false,
      note: "비교적 낮은 고도에서 재배되어 조직이 부드럽고 성분이 잘 녹아나오므로 90°C 내외에서 시작합니다."
    },
    note: "[추천 시작값] 산미가 적고 고소한 견과류·초콜릿 풍미를 편안하게 즐기는 시작점입니다."
  },

  // [13] 엘살바도르 파카마라 워시드
  el_salvador_pacamara: {
    id: "el_salvador_pacamara",
    name: "엘살바도르 파카마라 (중배전 · 워시드)",
    country: "엘살바도르 (El Salvador)",
    region: "산타아나 / 아파네카 (Santa Ana / Apaneca)",
    variety: "Pacamara (Pacas × Maragogipe 교배 대립종)",
    process: "워시드 (Washed)",
    roast: "중배전",
    roastLevel: "Medium",
    flavorNotes: ["자두", "오렌지", "크리미한 바디감", "밀크초콜릿"],
    flavorDisclaimer: "참고용 컵 노트입니다.",
    temp: 91.5,
    recommendedTempRangeC: [90.0, 93.0],
    ratio: 16.7,
    originReferenceRatio: 16.0,
    grinds: [720, 760, 780, 800, 830, 860, 910],
    times:  [150, 170, 190, 210, 225, 240, 265],
    recommendedTimeRangeSec30g: [190, 220],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "roaster_common_starting_point",
      verified: false,
      note: "대립종 중배전 원두의 복합적인 과일 향미와 크리미한 질감을 위한 시작점입니다."
    },
    note: "[추천 시작값] 크리미한 촉감과 복합적인 단맛·산미 균형을 위한 중배전 시작점입니다."
  },

  // [14] 인도네시아 만델링 G1 (기존 키 호환: mandheling)
  mandheling: {
    id: "mandheling",
    name: "인도네시아 수마트라 만델링 G1 (강배전 · 웻헐링)",
    country: "인도네시아 (Indonesia)",
    region: "수마트라 북부 (North Sumatra)",
    variety: "Typica, Catimor, TimTim",
    process: "웻헐링 / 세미워시드 (Wet-Hulled / Giling Basah)",
    roast: "강배전",
    roastLevel: "Dark",
    flavorNotes: ["다크초콜릿", "삼나무 허브", "스파이시", "묵직하고 중후한 바디감"],
    flavorDisclaimer: "웻헐링 가공과 강배전 특성이 결합된 참고 프로파일입니다.",
    temp: 88.0,
    recommendedTempRangeC: [86.0, 90.0],
    ratio: 16.7,
    originReferenceRatio: 14.5,
    grinds: [780, 820, 850, 880, 910, 940, 990],
    times:  [140, 160, 175, 190, 205, 220, 245],
    recommendedTimeRangeSec30g: [170, 205],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "dark_roast_pour_over_starting_point",
      verified: false,
      note: "강배전 원두는 다공성 구조가 발달해 가용 성분이 빠르게 용출되므로, 쓴맛과 떫은맛 과다를 줄이기 위해 88°C 저온에서 시작합니다."
    },
    note: "[추천 시작값] 강배전 특유의 탄 쓴맛 과다 용출을 줄이고 다크초콜릿 바디감을 살리는 88.0°C 저온 시작점입니다."
  },

  // [15] 모카-자바 / 벨라 도노반 스타일 블렌드
  bella_donovan_style: {
    id: "bella_donovan_style",
    name: "모카-자바 / 벨라 도노반 스타일 블렌드 (중강배전)",
    country: "다국적 블렌드 (에티오피아 + 인도네시아 등)",
    region: "에티오피아 + 수마트라/자바 계열 조합",
    variety: "Heirloom + Typica/Catimor Blend",
    process: "내추럴 + 웻헐링/워시드 블렌드",
    roast: "강배전",
    roastLevel: "Medium-Dark",
    flavorNotes: ["라즈베리 뉘앙스", "밀크초콜릿", "몰트(맥아) 단맛", "풍부한 바디감"],
    flavorDisclaimer: "블루보틀의 대표 블렌드 스타일을 참고한 구성입니다.",
    temp: 90.0,
    recommendedTempRangeC: [88.0, 92.0],
    ratio: 16.7,
    originReferenceRatio: 15.5,
    grinds: [750, 790, 820, 840, 870, 900, 950],
    times:  [145, 165, 180, 200, 215, 230, 255],
    recommendedTimeRangeSec30g: [180, 215],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "roaster_blend_guide_reference",
      verified: false,
      note: "에티오피아의 베리 향미와 인도네시아의 바디감을 동시에 살리기 위한 90°C 중강배전 시작점입니다."
    },
    note: "[추천 시작값] 은은한 과일 뉘앙스와 묵직한 초콜릿 단맛을 함께 끌어내는 블렌드 시작점입니다."
  },

  // [16] 시그니처 다크 블렌드 (기존 키 호환: darkblend)
  darkblend: {
    id: "darkblend",
    name: "시그니처 다크 블렌드 (강배전 · 블렌드)",
    country: "다국적 블렌드 (브라질 + 콜롬비아 + 과테말라)",
    region: "중남미 대표 산지 블렌드",
    variety: "Catuai, Caturra, Bourbon Blend",
    process: "내추럴 + 워시드 블렌드",
    roast: "강배전",
    roastLevel: "Dark",
    flavorNotes: ["다크초콜릿", "카카오닙스", "흑당 단맛", "벨벳 같은 묵직한 바디"],
    flavorDisclaimer: "하우스 다크 블렌드 기준 참고 노트입니다.",
    temp: 87.5,
    recommendedTempRangeC: [85.0, 89.0],
    ratio: 16.7,
    originReferenceRatio: 14.0,
    grinds: [800, 840, 870, 900, 930, 960, 1000],
    times:  [135, 155, 170, 185, 200, 215, 240],
    recommendedTimeRangeSec30g: [165, 200],
    evidence: {
      status: "recommended_starting_point",
      sourceType: "dark_roast_pour_over_starting_point",
      verified: false,
      note: "강배전 블렌드에서 후반부 탄 맛을 억제하기 위해 낮은 수온(87.5°C)을 적용하며, 진하게(1:14) 또는 바이패스 모드와 잘 어울립니다."
    },
    note: "[추천 시작값] 낮은 수온(87.5°C)으로 쓴맛을 줄이고 농밀한 단맛과 바디감을 강조하는 강배전 시작점입니다."
  }
};
window.ORIGIN_DB = ORIGIN_DB;

// ============================================================================
// 5. 공개된 공인 / 바리스타 레퍼런스 레시피 보존 데이터 (원형 보존 원칙 준수)
//    - 원래의 원두량, 물의 양, 드리퍼, 수온, 그라인더 설정을 변형 없이 그대로 보존합니다.
//    - 공개 레시피의 분쇄도 숫자를 다른 그라인더에 등가 환산하여 적용하지 않습니다.
// ============================================================================
const PUBLIC_BARISTA_RECIPES = [
  {
    id: "sca_golden_cup_standard",
    title: "SCA Golden Cup Standard (스페셜티 커피 협회 골든컵 기준)",
    sourceOrg: "Specialty Coffee Association (SCA)",
    dripper: "Standard Filter Coffee Brewer / Pour-Over",
    originalDoseG: 30,
    originalWaterG: 500, // 55 g/L (±10%) -> 약 1:16.7 ~ 1:18.2
    originalRatioText: "55 g/L ± 10% (물 1,000mL당 원두 55g, 약 1:16.7 ~ 1:18.2)",
    waterTempC_range: [92.0, 96.0],
    targetTDS_percent: [1.15, 1.35], // SCA 전통 기준 1.15~1.35% (유럽 기준 1.20~1.45%)
    targetEY_percent: [18.0, 22.0],
    originalGrinderSetting: "특정 그라인더 지정 없음 (접촉 시간 4~6분 또는 드리퍼별 적정 추출 수율 18~22% 달성 입도)",
    evidence: "verified_official_standard",
    notes: "TDS(농도)와 EY(추출 수율)는 실제 굴절계(Refractometer)와 추출 음료 무게를 측정해야만 확인 가능합니다."
  },
  {
    id: "baratza_official_v60_recipe",
    title: "Baratza Official Hario V60 Brew Guide",
    sourceOrg: "Baratza",
    sourceUrl: "https://www.baratza.com/en-us/blog/brew-guides/hario-v60-brew-guide",
    dripper: "Hario V60 02",
    originalDoseG: 23,
    originalWaterG: 380,
    originalRatioText: "약 1:16.5 (23g : 380g)",
    waterTempC: 96.0,
    pourStructure: "Blooming 50~60g (30~45초 대기) → 나선형 푸어링으로 380g까지 투입",
    targetBrewTimeSec_range: [150, 210],
    originalGrinderSetting: {
      baratza_encore_original: "다이얼 23 (Baratza V60 가이드 시작점 — 사용자 가정용 기준값 14와 별도 보존)",
      baratza_encore_esp: "다이얼 25"
    },
    evidence: "manufacturer_published_recipe",
    notes: "제조사 공식 V60 가이드의 원형 레시피입니다. 분쇄도 23(Encore) 및 25(ESP)는 해당 그라인더 전용 시작값이며 다른 그라인더에 그대로 적용하지 마세요."
  },
  {
    id: "fellow_house_blend_stagg_x",
    title: "Fellow Stagg [X] Pour-Over Guide (House Blend Reference)",
    sourceOrg: "Fellow Products",
    sourceUrl: "https://fellowproducts.com/blogs/brew-talks/fellows-take-on-house-blend-by-honey-moon-brew-guide",
    dripper: "Fellow Stagg [X] (평저형 드리퍼)",
    originalDoseG: 20,
    originalWaterG: 320,
    originalRatioText: "1:16.0 (20g : 320g)",
    waterTempC: 93.3, // 200°F
    originalGrinderSetting: {
      fellow_ode_gen2: "다이얼 5.0 ~ 7.0 (시작점 6.0 내외)",
      fellow_opus: "다이얼 7.0 ~ 8.0"
    },
    evidence: "manufacturer_published_recipe",
    notes: "Fellow 공식 블로그의 평저 드리퍼 레시피입니다. Ode Gen 2 및 Opus 전용 눈금이므로 타 브랜드 그라인더로 자동 환산하지 않습니다."
  },
  {
    id: "blue_bottle_dripper_official_single_origin",
    title: "Blue Bottle Official Pour-Over Guide (Single Origin & Blend)",
    sourceOrg: "Blue Bottle Coffee",
    dripper: "Blue Bottle Dripper (플랫베드 40리브 단일 추출구)",
    originalDoseG: 30,
    originalWaterG: 350,
    originalRatioText: "약 1:11.7 (블렌드 30g:350g) ~ 1:16.0 (싱글오리진 22~30g 기준)",
    waterTempC: 93.0,
    pourStructure: "1차 60g (40초 블루밍) → 2차 150g까지 → 3차 250g까지 → 4차 350g까지 (4회 분할 푸어링)",
    targetBrewTimeSec_range: [165, 210],
    originalGrinderSetting: "고운 소금~굵은 바다소금 수준 (특정 상업용 그라인더 기준 — 가정용 그라인더에서 별도 다이얼링 필요)",
    evidence: "roaster_published_guide",
    notes: "블루보틀 공식 가이드의 4단계 푸어링 구조를 보존한 레퍼런스입니다."
  },
  {
    id: "kasuya_4_6_method_reference",
    title: "Tetsu Kasuya 4:6 Method (카스야 테츠 4:6 법칙 원형)",
    sourceOrg: "Tetsu Kasuya (2016 World Brewers Cup Champion)",
    dripper: "Hario V60",
    originalDoseG: 20,
    originalWaterG: 300,
    originalRatioText: "1:15.0 (20g : 300g — 앞 40%[120g]로 산미·단맛 조절, 뒤 60%[180g]로 농도 조절)",
    waterTempC: 92.0,
    pourStructure: "0:00 50g → 0:45 120g → 1:30 180g → 2:15 240g → 3:00 300g → 3:30 종료",
    targetBrewTimeSec_range: [210, 210],
    originalGrinderSetting: "일반 핸드드립보다 굵은 분쇄 (Coarse — 사용 그라인더별로 3:30에 배수가 끝나도록 개별 설정)",
    evidence: "competition_barista_published_recipe",
    notes: "원본 20g:300g 비율과 45초 간격 5회 푸어링 구조를 그대로 보존한 참고 데이터입니다."
  }
];
window.PUBLIC_BARISTA_RECIPES = PUBLIC_BARISTA_RECIPES;

// ============================================================================
// 6. 대중적 그라인더 레지스트리 13종 (첨부 명세 100% 통합)
//    - 사용자 실사용 확인값(Feima 600N: 4.5, Baratza Encore Original: 14) 보존
//    - Baratza 제조사 V60 가이드값(23)은 manufacturerReference에 별도 보존
//    - 모든 모델 micronCalibration: null (임의 μm 환산 금지)
// ============================================================================
window.COFFEE_GRINDERS = [
  {
    id: "feima_600n",
    name: "페이마(Feima) 600N",
    brand: "Feima",
    type: "electric",
    profile: "pharmacy",
    adjustment: {
      kind: "numbered_dial",
      min: 1,
      max: 8,
      step: 0.5,
      unit: "dial",
      finerDirection: "lower_number_finer_assumed_confirm_with_user"
    },
    userConfirmed: {
      pourOverStandard: 4.5,
      note: "사용자가 약국에서 실제 사용하는 표준값"
    },
    pourOver: {
      start: 4.5,
      min: 4.5,
      max: 4.5,
      unit: "dial",
      evidence: "user_confirmed",
      sourceUrl: null
    },
    micronCalibration: null,
    confidence: "user_confirmed_baseline",
    badgeText: "사용자 실사용 (약국)",
    notes: "사용자 실사용 기준값(4.5). 제조사 권장값으로 표현하지 말 것. 다른 그라인더 눈금과 환산 금지."
  },
  {
    id: "baratza_encore_original",
    name: "Baratza Encore (Original)",
    brand: "Baratza",
    type: "electric",
    profile: "home",
    adjustment: {
      kind: "numbered_dial",
      min: 1,
      max: 40,
      unit: "dial_setting",
      finerDirection: "lower_number_finer"
    },
    userConfirmed: {
      pourOverStandard: 14,
      note: "사용자가 집에서 실제 사용하는 표준값"
    },
    pourOver: {
      start: 14,
      min: 14,
      max: 14,
      unit: "dial_setting",
      evidence: "user_confirmed",
      sourceUrl: null
    },
    manufacturerReference: {
      method: "V60",
      start: 23,
      unit: "dial_setting",
      evidence: "manufacturer_recipe",
      sourceUrl: "https://www.baratza.com/en-us/blog/brew-guides/hario-v60-brew-guide",
      note: "Baratza의 특정 V60 레시피용 시작값(23). 사용자 기준 14를 덮어쓰지 말 것."
    },
    micronCalibration: null,
    confidence: "user_confirmed_plus_manufacturer_reference",
    badgeText: "사용자 실사용 (가정 14) + 제조사 참고(23)",
    notes: "Original Encore와 Encore ESP를 구분할 것. 개인 프로필 기본값은 14이며, 제조사 V60 가이드 시작값 23은 보조 참고값으로 함께 제공합니다."
  },
  {
    id: "baratza_encore_esp",
    name: "Baratza Encore ESP",
    brand: "Baratza",
    type: "electric",
    adjustment: {
      kind: "numbered_dial",
      min: 1,
      max: 40,
      unit: "dial_setting",
      finerDirection: "lower_number_finer",
      filterRange: "21-40"
    },
    pourOver: {
      start: 25,
      min: 21,
      max: 30,
      unit: "dial_setting",
      evidence: "manufacturer_recipe",
      sourceUrl: "https://www.baratza.com/en-us/blog/brew-guides/hario-v60-brew-guide"
    },
    micronCalibration: null,
    confidence: "manufacturer_starting_point",
    badgeText: "제조사 가이드",
    notes: "25는 Baratza V60 가이드의 시작 설정. 다른 배전도/드리퍼에서 재조정. 1-20은 에스프레소 구간, 21-40은 필터 구간으로 안내됨."
  },
  {
    id: "comandante_c40_mk4",
    name: "Comandante C40 MK4",
    brand: "Comandante",
    type: "manual",
    adjustment: {
      kind: "clicks_from_zero",
      min: 0,
      max: 40,
      unit: "clicks",
      finerDirection: "lower_click_count_finer"
    },
    pourOver: {
      start: 27,
      min: 18,
      max: 35,
      unit: "clicks_from_zero",
      evidence: "manufacturer_range_plus_midpoint_start",
      sourceUrl: "https://comandantegrinder.com/pages/faq"
    },
    micronCalibration: null,
    confidence: "manufacturer_range",
    badgeText: "제조사 범위 (중간 시작값)",
    notes: "공식 FAQ의 pour-over 시작 범위는 18-35 clicks. 시작값 27은 해당 범위의 앱 편의 시작값이지 제조사의 단일 공식값이 아님."
  },
  {
    id: "timemore_c2",
    name: "Timemore Chestnut C2",
    brand: "Timemore",
    type: "manual",
    adjustment: {
      kind: "clicks_from_zero",
      unit: "clicks",
      finerDirection: "lower_click_count_finer",
      zeroConvention: "verify_model_manual"
    },
    pourOver: {
      start: 16,
      min: 15,
      max: 18,
      unit: "clicks",
      evidence: "community_starting_range",
      sourceUrl: "https://www.browncherry.co.kr/article/%EB%89%B4%EC%8A%A4%EC%9D%B4%EB%B2%A4%ED%8A%B8/2/13497/"
    },
    micronCalibration: null,
    confidence: "community_estimate",
    badgeText: "커뮤니티 참고",
    notes: "모델 생산 버전과 클릭 카운트 관행 차이가 있어 시작 범위로만 사용. 공식 제조사 표준으로 표시하지 말 것."
  },
  {
    id: "timemore_c3_c3pro",
    name: "Timemore Chestnut C3 / C3 Pro",
    brand: "Timemore",
    type: "manual",
    adjustment: {
      kind: "clicks_from_zero",
      unit: "clicks",
      finerDirection: "lower_click_count_finer",
      zeroConvention: "verify_model_manual"
    },
    pourOver: {
      start: 15,
      min: 13,
      max: 18,
      unit: "clicks",
      evidence: "community_starting_range",
      sourceUrl: "https://brewratio.coffee/grind-settings"
    },
    micronCalibration: null,
    confidence: "community_estimate",
    badgeText: "커뮤니티 참고",
    notes: "C3/C3 Pro/C3S 및 버전에 따라 세팅 관행이 다를 수 있음. 범위를 초기 참고값으로만 표시."
  },
  {
    id: "1zpresso_k_ultra",
    name: "1Zpresso K-Ultra",
    brand: "1Zpresso",
    type: "manual",
    adjustment: {
      kind: "external_dial_with_subticks",
      unit: "dial_setting",
      finerDirection: "lower_setting_finer",
      displayFormat: "8.0"
    },
    pourOver: {
      start: 8.5,
      min: 8.0,
      max: 9.0,
      unit: "dial_setting",
      evidence: "compiled_starting_range",
      sourceUrl: "https://brewratio.coffee/grind-settings"
    },
    micronCalibration: null,
    confidence: "reference_range",
    badgeText: "제조사 자료 취합 참고",
    notes: "외부 숫자 다이얼 표기(dial_setting)를 사용하며 다른 1Zpresso 모델의 원시 click count와 혼용하지 말 것."
  },
  {
    id: "1zpresso_zp6_special",
    name: "1Zpresso ZP6 Special",
    brand: "1Zpresso",
    type: "manual",
    adjustment: {
      kind: "external_dial_with_subticks",
      min: 0,
      max: 9,
      unit: "dial_setting",
      clicksPerRotation: 90,
      finerDirection: "lower_setting_finer"
    },
    pourOver: {
      start: 4.5,
      min: 4.0,
      max: 5.0,
      unit: "dial_setting",
      alternateDisplay: "약 40-50 clicks",
      evidence: "community_starting_range",
      sourceUrl: "https://brewmark.io/methods/pour-over"
    },
    manufacturerReference: {
      detail: "9 numbered marks and 90 clicks per rotation; designed primarily for pour-over",
      sourceUrl: "https://1zpresso.coffee/zp6/"
    },
    micronCalibration: null,
    confidence: "mechanism_manufacturer_range_community_setting",
    badgeText: "제조사 기구규격 + 커뮤니티 시작값",
    notes: "클릭/숫자 다이얼 표기를 별도 필드로 보관. 실제 영점 설정 방식을 먼저 확인하세요."
  },
  {
    id: "kingrinder_k6",
    name: "KINGrinder K6",
    brand: "KINGrinder",
    type: "manual",
    adjustment: {
      kind: "clicks_from_zero",
      unit: "clicks",
      clicksPerRotation: 60,
      finerDirection: "lower_click_count_finer"
    },
    pourOver: {
      start: 100,
      min: 90,
      max: 120,
      unit: "clicks_from_zero",
      evidence: "manual_copy_and_manufacturer_grind_chart",
      sourceUrl: "https://www.kingrinder.com/_blog"
    },
    micronCalibration: null,
    confidence: "reference_range",
    badgeText: "제조사 입도차트 참고",
    notes: "0점까지 부드럽게 닫아 기준을 잡되 세게 조이지 말 것. 1회전 60 clicks 체계."
  },
  {
    id: "fellow_ode_gen2",
    name: "Fellow Ode Gen 2",
    brand: "Fellow",
    type: "electric",
    adjustment: {
      kind: "numbered_dial_with_subticks",
      min: 1,
      max: 11,
      unit: "dial_setting",
      finerDirection: "lower_setting_finer",
      burrVersion: "Gen 2 Brew Burrs"
    },
    pourOver: {
      start: 6.0,
      min: 5.0,
      max: 7.0,
      unit: "dial_setting",
      evidence: "manufacturer_recipe_range",
      sourceUrl: "https://fellowproducts.com/blogs/brew-talks/fellows-take-on-house-blend-by-honey-moon-brew-guide"
    },
    batchAdjustment: {
      smallBatchStart: 8,
      largeBatchStart: 10,
      sourceUrl: "https://help.fellowproducts.com/hc/en-us/articles/29101533994267-How-should-I-dial-in-my-grinder-when-brewing-with-Aiden-Getting-Started-With-Aiden-Pt-3"
    },
    micronCalibration: null,
    confidence: "manufacturer_recipe_range",
    badgeText: "제조사 가이드",
    notes: "Ode Gen 1과 Gen 2 버를 구분. 대용량 배치에서는 더 굵은 설정(8~10)이 필요할 수 있음. 에스프레소용이 아님."
  },
  {
    id: "fellow_opus",
    name: "Fellow Opus",
    brand: "Fellow",
    type: "electric",
    adjustment: {
      kind: "outer_dial_plus_inner_ring",
      min: 1,
      max: 11,
      unit: "outer_dial",
      finerDirection: "lower_setting_finer",
      innerRingMustBeRecorded: true
    },
    pourOver: {
      start: 6.5,
      min: 5.0,
      max: 9.0,
      unit: "outer_dial",
      evidence: "manufacturer_guidance_and_recipe_range",
      sourceUrl: "https://help.fellowproducts.com/hc/en-us/articles/29101533994267-How-should-I-dial-in-my-grinder-when-brewing-with-Aiden-Getting-Started-With-Aiden-Pt-3",
      innerRingSetting: "기준 설정/레시피에서 실제 내부 링 위치 함께 기록 필수"
    },
    batchAdjustment: {
      smallBatchStart: 8,
      largeBatchStart: 10.5,
      sourceUrl: "https://help.fellowproducts.com/hc/en-us/articles/29101533994267-How-should-I-dial-in-my-grinder-when-brewing-with-Aiden-Getting-Started-With-Aiden-Pt-3"
    },
    micronCalibration: null,
    confidence: "manufacturer_guidance_and_recipe_range",
    badgeText: "제조사 가이드 (내부링 기록필수)",
    notes: "외부 숫자만으로 세팅을 식별하지 말고 내부 미세조절 링 위치를 반드시 함께 기록하세요."
  },
  {
    id: "oxo_brew_conical_burr",
    name: "OXO Brew Conical Burr Coffee Grinder",
    brand: "OXO",
    type: "electric",
    adjustment: {
      kind: "numbered_dial",
      min: 1,
      max: 15,
      unit: "dial_setting",
      finerDirection: "lower_number_finer"
    },
    pourOver: {
      start: 8,
      min: 6,
      max: 10,
      unit: "dial_setting",
      evidence: "manufacturer_guide",
      sourceUrl: "https://www.oxo.com/blog/coffee-and-beverages/how-to-use-the-oxo-brew-conical-burr-grinder"
    },
    micronCalibration: null,
    confidence: "manufacturer_range",
    badgeText: "제조사 가이드",
    notes: "제조사 안내: 1-5 에스프레소/가는분쇄, 6-10 푸어오버/드립, 11-15 프렌치프레스/콜드브루."
  },
  {
    id: "breville_smart_grinder_pro",
    name: "Breville / Sage Smart Grinder Pro",
    brand: "Breville/Sage",
    type: "electric",
    adjustment: {
      kind: "numbered_dial",
      min: 1,
      max: 60,
      unit: "dial_setting",
      finerDirection: "lower_number_finer"
    },
    pourOver: {
      start: null,
      recommendedTrialStart: 38,
      min: 31,
      max: 45,
      unit: "dial_setting",
      evidence: "manufacturer_manual_range",
      sourceUrl: "https://assets.breville.com/BCG820/BCG820_BSS_USCM_IB_I23_FA_Online.pdf"
    },
    micronCalibration: null,
    confidence: "manufacturer_range_no_single_official_start",
    badgeText: "제조사 범위 (31~45)",
    notes: "제조사 설명서의 종이필터 드립 범위는 31-45입니다. 38은 범위 중앙의 앱 시험 시작점일 뿐 제조사 단일 공식 권장값이 아닙니다."
  }
];

/**
 * 특정 그라인더 ID를 선택했을 때 화면에 표시할 안내 정보를 반환하는 헬퍼 함수
 * - μm 자동 환산을 하지 않으며, 사용자 실사용값과 제조사 참고값을 구분하여 반환합니다.
 */
function getGrinderDisplayInfo(grinderId) {
  const g = window.COFFEE_GRINDERS.find(item => item.id === grinderId) || window.COFFEE_GRINDERS[0];
  const hasRange = g.pourOver.min !== g.pourOver.max;
  const rangeText = hasRange
    ? `${g.pourOver.min} ~ ${g.pourOver.max} (${g.pourOver.unit})`
    : `${g.pourOver.start} (${g.pourOver.unit})`;

  let startText = g.pourOver.start !== null
    ? `${g.pourOver.start} (${g.pourOver.unit})`
    : `범위 ${g.pourOver.min}~${g.pourOver.max} (시험 시작점: ${g.pourOver.recommendedTrialStart})`;

  if (g.userConfirmed) {
    startText = `${g.userConfirmed.pourOverStandard} [사용자 실사용 기준]`;
  }

  let subRefText = g.notes;
  if (g.manufacturerReference && g.manufacturerReference.start) {
    subRefText = `사용자 실사용 기준: ${g.userConfirmed.pourOverStandard} / 제조사 ${g.manufacturerReference.method} 가이드 참고값: ${g.manufacturerReference.start} (덮어쓰지 않고 별도 보존)`;
  }

  return {
    id: g.id,
    name: g.name,
    brand: g.brand,
    typeLabel: g.type === "electric" ? "전동" : "수동",
    adjustmentKind: g.adjustment.kind,
    recommendedRangeText: rangeText,
    recommendedStartText: startText,
    alternateDisplay: g.pourOver.alternateDisplay || null,
    badgeText: g.badgeText,
    evidence: g.pourOver.evidence,
    sourceUrl: g.pourOver.sourceUrl || (g.manufacturerReference && g.manufacturerReference.sourceUrl) || null,
    micronCalibration: null, // 실측 입도 분석 없이는 항상 null
    subRefText: subRefText,
    generalNotice: "설정값은 출발점(Starting Point)입니다. 한 번에 한 단계씩 조정하세요."
  };
}
window.getGrinderDisplayInfo = getGrinderDisplayInfo;
