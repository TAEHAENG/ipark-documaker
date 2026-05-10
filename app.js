/* =============================================
   아이파크 부동산 문서생성기 - 앱 로직
   ============================================= */

// ============================================================
// 한글 금액 변환 유틸리티
// ============================================================

function digitKor(n) {
  return ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'][n] || '';
}

function groupKor(n) {
  // 4자리 이하 숫자를 한글로 변환 (예: 1600 → '일천육백')
  if (n === 0) return '';
  const d = [Math.floor(n / 1000), Math.floor((n % 1000) / 100), Math.floor((n % 100) / 10), n % 10];
  const p = ['천', '백', '십', ''];
  let r = '';
  for (let i = 0; i < 4; i++) {
    if (d[i] === 0) continue;
    r += digitKor(d[i]) + p[i];
  }
  return r;
}

function numberToKorean(manAmount) {
  // 만 단위 입력 → 한글 금액 문자열 반환
  // 예: 1000 → '일천만원', 16000 → '일억육천만원'
  if (manAmount === '' || manAmount === null || manAmount === undefined) return '';
  const num = Number(manAmount);
  if (isNaN(num)) return '';
  if (num === 0) return '영원';

  const neg = num < 0;
  const won = Math.round(Math.abs(num) * 10000);

  const parts = [
    { div: 1e12, name: '조' },
    { div: 1e8,  name: '억' },
    { div: 1e4,  name: '만' },
    { div: 1,    name: '' }
  ];

  let rem = won;
  let result = '';
  for (const p of parts) {
    const amt = Math.floor(rem / p.div);
    if (amt > 0) {
      result += groupKor(amt) + p.name;
      rem = rem % p.div;
    }
  }
  return (neg ? '마이너스 ' : '') + result + '원';
}

function formatWon(manAmount) {
  // 만 단위 → '10,000,000원' 형식
  if (manAmount === '' || manAmount === null || manAmount === undefined) return '';
  const num = Number(manAmount);
  if (isNaN(num)) return '';
  return (Math.round(num * 10000)).toLocaleString('ko-KR') + '원';
}

// ============================================================
// 수식 계산
// ============================================================

function safeEval(expr) {
  // 숫자/연산자/괄호만 허용하는 안전한 수식 평가
  const cleaned = expr.replace(/\s/g, '');
  if (!/^[0-9+\-*/().]+$/.test(cleaned)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + cleaned + ')')();
    return (typeof result === 'number' && isFinite(result)) ? result : null;
  } catch {
    return null;
  }
}

function evaluateFormula(formulaExpr, placeholders) {
  // {N} 참조를 숫자(만단위)로 치환 후 계산
  // 순환참조 방지를 위해 depth 제한
  function resolve(expr, depth) {
    if (depth > 5) return null;
    const substituted = expr.replace(/\{(\d+)\}/g, (_, numStr) => {
      const idx = parseInt(numStr, 10);
      const ph = placeholders.find(p => p.index === idx);
      if (!ph) return '0';
      if (ph.type === 'formula') {
        const sub = resolve(ph.formulaExpr, depth + 1);
        return sub !== null ? sub.toString() : '0';
      }
      const v = parseFloat(ph.value);
      return isNaN(v) ? '0' : v.toString();
    });
    return safeEval(substituted);
  }
  return resolve(formulaExpr, 0);
}

// ============================================================
// 기본 템플릿 데이터
// ============================================================

const DEFAULT_DATA = {
  groups: [
    {
      id: 'apt',
      name: 'APT',
      subgroups: [
        { id: 'buy',     name: '매매', templateId: 'apt-buy'     },
        { id: 'lease',   name: '전세', templateId: 'apt-lease'   },
        { id: 'monthly', name: '월세', templateId: 'apt-monthly' }
      ]
    },
    {
      id: 'commercial',
      name: '상가',
      subgroups: [
        { id: 'buy',     name: '매매', templateId: 'commercial-buy'     },
        { id: 'lease',   name: '전세', templateId: 'commercial-lease'   },
        { id: 'monthly', name: '월세', templateId: 'commercial-monthly' }
      ]
    },
    {
      id: 'tenant',
      name: '임차인 안내사항',
      subgroups: [
        { id: 'ipark',    name: '아이파크',   templateId: 'tenant-ipark'    },
        { id: 'hills',    name: '힐스테이트', templateId: 'tenant-hills'    },
        { id: 'thesharp', name: '더샵',       templateId: 'tenant-thesharp' }
      ]
    }
  ],
  templates: {
    'apt-buy': {
      id: 'apt-buy',
      name: 'APT 매매',
      placeholders: [
        { index: 1,  description: '물건지 주소',        type: 'text',       value: '', formulaExpr: '' },
        { index: 2,  description: '매매대금(만단위)',    type: 'amount_man', value: '', formulaExpr: '' },
        { index: 3,  description: '계약금(만단위)',      type: 'amount_man', value: '', formulaExpr: '' },
        { index: 4,  description: '중도금(만단위)',      type: 'amount_man', value: '', formulaExpr: '' },
        { index: 5,  description: '잔금(만단위)',        type: 'formula',    value: '', formulaExpr: '{2}-{3}-{4}' },
        { index: 6,  description: '계약금 입금일',       type: 'text',       value: '', formulaExpr: '' },
        { index: 7,  description: '계약금 중 일부(만)',  type: 'amount_man', value: '', formulaExpr: '' },
        { index: 8,  description: '중도금일',            type: 'text',       value: '', formulaExpr: '' },
        { index: 9,  description: '잔금일',              type: 'text',       value: '', formulaExpr: '' },
        { index: 10, description: '계약서 작성일',       type: 'text',       value: '', formulaExpr: '' },
        { index: 11, description: '안내일자',            type: 'text',       value: '', formulaExpr: '' },
        { index: 12, description: '특약사항',            type: 'text',       value: '', formulaExpr: '' }
      ],
      body: `[매매계약건]
본 건은 매매계약건으로 계약금 일부 입금하시면 아래내용에 동의하시는것으로 본 계약서 작성전 이라도 계약이 성립됨을 확인합니다.

[계약 내용]
물건지주소: {1}
매매대금: {2}
계약금: {3}
중도금: {4}
잔금: {5}
1)계약금 입금일: {6} 계약금 중 일부({7})는 계약금 입금일에 송금하기로 하며 나머지는 계약일에 지불하기로 한다.
2)중도금일: {8}
3)잔금일: {9}
4)계약서 작성은 : {10}에 작성하기로 한다.
5)매도자에게 국세, 지방세 체납 사실이 없음을 확인후 계약함
{12}
- 잔금일은 쌍방합의하에 앞으로만 당길수 있다.
- 잔금일 당일에 매수인은 선순위 근저당을 설정하지 않는다.
*매수인의 일방적 계약파기시 입금한 계약금 포기
*매도인의 일방적 계약파기시 입금한 계약금의 배액배상을 하기로 한다*

위 내용에 동의하시면 동의문자와 신분증, 계좌번호를 보내주시면 입금 확인을 통해 매매계약을 진행하겠습니다.
{11}
위례아이파크(02-402-4600)
공인중개사사무소`
    },

    'apt-lease': {
      id: 'apt-lease',
      name: 'APT 전세',
      placeholders: [
        { index: 1, description: '물건지 주소',       type: 'text',       value: '', formulaExpr: '' },
        { index: 2, description: '전세보증금(만단위)', type: 'amount_man', value: '', formulaExpr: '' },
        { index: 3, description: '계약금(만단위)',     type: 'amount_man', value: '', formulaExpr: '' },
        { index: 4, description: '잔금(만단위)',       type: 'formula',    value: '', formulaExpr: '{2}-{3}' },
        { index: 5, description: '계약금 입금일',      type: 'text',       value: '', formulaExpr: '' },
        { index: 6, description: '잔금일',             type: 'text',       value: '', formulaExpr: '' },
        { index: 7, description: '임대차 기간',        type: 'text',       value: '', formulaExpr: '' },
        { index: 8, description: '계약서 작성일',      type: 'text',       value: '', formulaExpr: '' },
        { index: 9, description: '특약사항',           type: 'text',       value: '', formulaExpr: '' }
      ],
      body: `[전세계약건]
본 건은 전세계약건으로 계약금 입금하시면 아래내용에 동의하시는것으로 본 계약서 작성전 이라도 계약이 성립됨을 확인합니다.

[계약 내용]
물건지주소: {1}
전세보증금: {2}
계약금: {3}
잔금: {4}
1)계약금 입금일: {5}
2)잔금일: {6}
3)임대차 기간: {7}
4)계약서 작성은 : {8}에 작성하기로 한다.
5)임대인에게 국세, 지방세 체납 사실이 없음을 확인후 계약함
{9}
*임차인의 일방적 계약파기시 입금한 계약금 포기
*임대인의 일방적 계약파기시 입금한 계약금의 배액배상을 하기로 한다*

위 내용에 동의하시면 동의문자와 신분증, 계좌번호를 보내주시면 입금 확인을 통해 전세계약을 진행하겠습니다.
위례아이파크(02-402-4600)
공인중개사사무소`
    },

    'apt-monthly': {
      id: 'apt-monthly',
      name: 'APT 월세',
      placeholders: [
        { index: 1,  description: '물건지 주소',    type: 'text',       value: '', formulaExpr: '' },
        { index: 2,  description: '보증금(만단위)', type: 'amount_man', value: '', formulaExpr: '' },
        { index: 3,  description: '월세(만단위)',   type: 'amount_man', value: '', formulaExpr: '' },
        { index: 4,  description: '계약금(만단위)', type: 'amount_man', value: '', formulaExpr: '' },
        { index: 5,  description: '잔금(만단위)',   type: 'formula',    value: '', formulaExpr: '{2}-{4}' },
        { index: 6,  description: '계약금 입금일',  type: 'text',       value: '', formulaExpr: '' },
        { index: 7,  description: '월세 납부일(일)', type: 'text',      value: '', formulaExpr: '' },
        { index: 8,  description: '잔금일',         type: 'text',       value: '', formulaExpr: '' },
        { index: 9,  description: '임대차 기간',    type: 'text',       value: '', formulaExpr: '' },
        { index: 10, description: '계약서 작성일',  type: 'text',       value: '', formulaExpr: '' },
        { index: 11, description: '특약사항',       type: 'text',       value: '', formulaExpr: '' }
      ],
      body: `[월세계약건]
본 건은 월세계약건으로 계약금 입금하시면 아래내용에 동의하시는것으로 본 계약서 작성전 이라도 계약이 성립됨을 확인합니다.

[계약 내용]
물건지주소: {1}
보증금: {2} / 월세: {3}
계약금: {4}
잔금: {5}
1)계약금 입금일: {6}
2)월세 납부일: 매월 {7}일
3)잔금일: {8}
4)임대차 기간: {9}
5)계약서 작성은 : {10}에 작성하기로 한다.
6)임대인에게 국세, 지방세 체납 사실이 없음을 확인후 계약함
{11}
*임차인의 일방적 계약파기시 입금한 계약금 포기
*임대인의 일방적 계약파기시 입금한 계약금의 배액배상을 하기로 한다*

위 내용에 동의하시면 동의문자와 신분증, 계좌번호를 보내주시면 입금 확인을 통해 월세계약을 진행하겠습니다.
위례아이파크(02-402-4600)
공인중개사사무소`
    },

    'commercial-buy': {
      id: 'commercial-buy',
      name: '상가 매매',
      placeholders: [
        { index: 1, description: '물건지 주소',      type: 'text',       value: '', formulaExpr: '' },
        { index: 2, description: '매매대금(만단위)', type: 'amount_man', value: '', formulaExpr: '' },
        { index: 3, description: '계약금(만단위)',   type: 'amount_man', value: '', formulaExpr: '' },
        { index: 4, description: '중도금(만단위)',   type: 'amount_man', value: '', formulaExpr: '' },
        { index: 5, description: '잔금(만단위)',     type: 'formula',    value: '', formulaExpr: '{2}-{3}-{4}' },
        { index: 6, description: '계약금 입금일',    type: 'text',       value: '', formulaExpr: '' },
        { index: 7, description: '잔금일',           type: 'text',       value: '', formulaExpr: '' },
        { index: 8, description: '계약서 작성일',    type: 'text',       value: '', formulaExpr: '' },
        { index: 9, description: '특약사항',         type: 'text',       value: '', formulaExpr: '' }
      ],
      body: `[상가 매매계약건]
본 건은 상가 매매계약건으로 계약금 입금하시면 아래내용에 동의하시는것으로 본 계약서 작성전 이라도 계약이 성립됨을 확인합니다.

[계약 내용]
물건지주소: {1}
매매대금: {2}
계약금: {3}
중도금: {4}
잔금: {5}
1)계약금 입금일: {6}
2)잔금일: {7}
3)계약서 작성은 : {8}에 작성하기로 한다.
4)매도자에게 국세, 지방세 체납 사실이 없음을 확인후 계약함
{9}
*매수인의 일방적 계약파기시 입금한 계약금 포기
*매도인의 일방적 계약파기시 입금한 계약금의 배액배상을 하기로 한다*

위 내용에 동의하시면 동의문자와 신분증, 계좌번호를 보내주시면 입금 확인을 통해 매매계약을 진행하겠습니다.
위례아이파크(02-402-4600)
공인중개사사무소`
    },

    'commercial-lease': {
      id: 'commercial-lease',
      name: '상가 전세',
      placeholders: [
        { index: 1, description: '물건지 주소',       type: 'text',       value: '', formulaExpr: '' },
        { index: 2, description: '전세보증금(만단위)', type: 'amount_man', value: '', formulaExpr: '' },
        { index: 3, description: '계약금(만단위)',     type: 'amount_man', value: '', formulaExpr: '' },
        { index: 4, description: '잔금(만단위)',       type: 'formula',    value: '', formulaExpr: '{2}-{3}' },
        { index: 5, description: '계약금 입금일',      type: 'text',       value: '', formulaExpr: '' },
        { index: 6, description: '잔금일',             type: 'text',       value: '', formulaExpr: '' },
        { index: 7, description: '임대차 기간',        type: 'text',       value: '', formulaExpr: '' },
        { index: 8, description: '계약서 작성일',      type: 'text',       value: '', formulaExpr: '' },
        { index: 9, description: '특약사항',           type: 'text',       value: '', formulaExpr: '' }
      ],
      body: `[상가 전세계약건]
본 건은 상가 전세계약건으로 계약금 입금하시면 아래내용에 동의하시는것으로 본 계약서 작성전 이라도 계약이 성립됨을 확인합니다.

[계약 내용]
물건지주소: {1}
전세보증금: {2}
계약금: {3}
잔금: {4}
1)계약금 입금일: {5}
2)잔금일: {6}
3)임대차 기간: {7}
4)계약서 작성은 : {8}에 작성하기로 한다.
{9}
*임차인의 일방적 계약파기시 입금한 계약금 포기
*임대인의 일방적 계약파기시 입금한 계약금의 배액배상을 하기로 한다*

위 내용에 동의하시면 동의문자와 신분증, 계좌번호를 보내주시면 입금 확인을 통해 전세계약을 진행하겠습니다.
위례아이파크(02-402-4600)
공인중개사사무소`
    },

    'commercial-monthly': {
      id: 'commercial-monthly',
      name: '상가 월세',
      placeholders: [
        { index: 1,  description: '물건지 주소',     type: 'text',       value: '', formulaExpr: '' },
        { index: 2,  description: '보증금(만단위)',  type: 'amount_man', value: '', formulaExpr: '' },
        { index: 3,  description: '월세(만단위)',    type: 'amount_man', value: '', formulaExpr: '' },
        { index: 4,  description: '계약금(만단위)',  type: 'amount_man', value: '', formulaExpr: '' },
        { index: 5,  description: '잔금(만단위)',    type: 'formula',    value: '', formulaExpr: '{2}-{4}' },
        { index: 6,  description: '계약금 입금일',   type: 'text',       value: '', formulaExpr: '' },
        { index: 7,  description: '월세 납부일(일)',  type: 'text',       value: '', formulaExpr: '' },
        { index: 8,  description: '잔금일',          type: 'text',       value: '', formulaExpr: '' },
        { index: 9,  description: '임대차 기간',     type: 'text',       value: '', formulaExpr: '' },
        { index: 10, description: '계약서 작성일',   type: 'text',       value: '', formulaExpr: '' },
        { index: 11, description: '특약사항',        type: 'text',       value: '', formulaExpr: '' }
      ],
      body: `[상가 월세계약건]
본 건은 상가 월세계약건으로 계약금 입금하시면 아래내용에 동의하시는것으로 본 계약서 작성전 이라도 계약이 성립됨을 확인합니다.

[계약 내용]
물건지주소: {1}
보증금: {2} / 월세: {3}
계약금: {4}
잔금: {5}
1)계약금 입금일: {6}
2)월세 납부일: 매월 {7}일
3)잔금일: {8}
4)임대차 기간: {9}
5)계약서 작성은 : {10}에 작성하기로 한다.
{11}
*임차인의 일방적 계약파기시 입금한 계약금 포기
*임대인의 일방적 계약파기시 입금한 계약금의 배액배상을 하기로 한다*

위 내용에 동의하시면 동의문자와 신분증, 계좌번호를 보내주시면 입금 확인을 통해 월세계약을 진행하겠습니다.
위례아이파크(02-402-4600)
공인중개사사무소`
    },

    'tenant-ipark': {
      id: 'tenant-ipark',
      name: '아이파크 임차인 안내',
      placeholders: [
        { index: 1, description: '세대 주소',    type: 'text', value: '', formulaExpr: '' },
        { index: 2, description: '임차인 성명',  type: 'text', value: '', formulaExpr: '' },
        { index: 3, description: '입주 예정일',  type: 'text', value: '', formulaExpr: '' }
      ],
      body: `[위례 아이파크 임차인 안내사항]

안녕하세요! 위례아이파크 공인중개사사무소입니다.

입주 세대: {1}
임차인: {2}
입주 예정일: {3}

■ 입주 전 확인사항
1. 전입신고 및 확정일자를 받으시기 바랍니다.
2. 이사 전 관리사무소에 이사 일정을 사전 신고해 주세요.
3. 엘리베이터 이용 예약은 관리사무소에 문의하세요.
4. 장기수선충당금은 임대인 부담이나, 퇴거 시 정산하시기 바랍니다.

■ 관리비 관련
- 관리비 고지서는 매월 말 발행됩니다.
- 관리비 납부는 자동이체를 권장합니다.

■ 문의처
위례아이파크 관리사무소: 031-XXX-XXXX
위례아이파크 공인중개사사무소: 02-402-4600`
    },

    'tenant-hills': {
      id: 'tenant-hills',
      name: '힐스테이트 임차인 안내',
      placeholders: [
        { index: 1, description: '세대 주소',   type: 'text', value: '', formulaExpr: '' },
        { index: 2, description: '임차인 성명', type: 'text', value: '', formulaExpr: '' },
        { index: 3, description: '입주 예정일', type: 'text', value: '', formulaExpr: '' }
      ],
      body: `[힐스테이트 임차인 안내사항]

안녕하세요! 위례아이파크 공인중개사사무소입니다.

입주 세대: {1}
임차인: {2}
입주 예정일: {3}

■ 입주 전 확인사항
1. 전입신고 및 확정일자를 받으시기 바랍니다.
2. 이사 전 관리사무소에 이사 일정을 사전 신고해 주세요.
3. 장기수선충당금은 임대인 부담이나, 퇴거 시 정산하시기 바랍니다.

■ 문의처
힐스테이트 관리사무소: 031-XXX-XXXX
위례아이파크 공인중개사사무소: 02-402-4600`
    },

    'tenant-thesharp': {
      id: 'tenant-thesharp',
      name: '더샵 임차인 안내',
      placeholders: [
        { index: 1, description: '세대 주소',   type: 'text', value: '', formulaExpr: '' },
        { index: 2, description: '임차인 성명', type: 'text', value: '', formulaExpr: '' },
        { index: 3, description: '입주 예정일', type: 'text', value: '', formulaExpr: '' }
      ],
      body: `[더샵 임차인 안내사항]

안녕하세요! 위례아이파크 공인중개사사무소입니다.

입주 세대: {1}
임차인: {2}
입주 예정일: {3}

■ 입주 전 확인사항
1. 전입신고 및 확정일자를 받으시기 바랍니다.
2. 이사 전 관리사무소에 이사 일정을 사전 신고해 주세요.
3. 장기수선충당금은 임대인 부담이나, 퇴거 시 정산하시기 바랍니다.

■ 문의처
더샵 관리사무소: 031-XXX-XXXX
위례아이파크 공인중개사사무소: 02-402-4600`
    }
  }
};

// ============================================================
// 삽입자 라이브러리 (공통 샘플)
// ============================================================

const PLACEHOLDER_LIBRARY = [
  // 부동산
  { category: '부동산',    description: '물건지 주소',                   type: 'text',       formulaTemplate: '' },
  // 매매 금액
  { category: '매매금액',  description: '매매대금(만단위)',               type: 'amount_man', formulaTemplate: '' },
  { category: '매매금액',  description: '계약금(만단위)',                 type: 'amount_man', formulaTemplate: '' },
  { category: '매매금액',  description: '중도금(만단위)',                 type: 'amount_man', formulaTemplate: '' },
  { category: '매매금액',  description: '잔금 = 매매대금-계약금-중도금', type: 'formula',    formulaTemplate: '[매매대금(만단위)]-[계약금(만단위)]-[중도금(만단위)]' },
  // 전세 금액
  { category: '전세금액',  description: '전세보증금(만단위)',             type: 'amount_man', formulaTemplate: '' },
  { category: '전세금액',  description: '잔금 = 전세보증금-계약금',      type: 'formula',    formulaTemplate: '[전세보증금(만단위)]-[계약금(만단위)]' },
  // 월세 금액
  { category: '월세금액',  description: '보증금(만단위)',                 type: 'amount_man', formulaTemplate: '' },
  { category: '월세금액',  description: '월세(만단위)',                   type: 'amount_man', formulaTemplate: '' },
  { category: '월세금액',  description: '잔금 = 보증금-계약금',          type: 'formula',    formulaTemplate: '[보증금(만단위)]-[계약금(만단위)]' },
  // 날짜
  { category: '날짜',      description: '계약금 입금일',                  type: 'text',       formulaTemplate: '' },
  { category: '날짜',      description: '중도금일',                       type: 'text',       formulaTemplate: '' },
  { category: '날짜',      description: '잔금일',                         type: 'text',       formulaTemplate: '' },
  { category: '날짜',      description: '임대차 기간',                    type: 'text',       formulaTemplate: '' },
  { category: '날짜',      description: '월세 납부일(일)',                type: 'text',       formulaTemplate: '' },
  { category: '날짜',      description: '계약서 작성일',                  type: 'text',       formulaTemplate: '' },
  { category: '날짜',      description: '안내일자',                       type: 'text',       formulaTemplate: '' },
  // 기타
  { category: '기타',      description: '특약사항',                       type: 'text',       formulaTemplate: '' },
  { category: '임차인',    description: '임차인 성명',                    type: 'text',       formulaTemplate: '' },
  { category: '임차인',    description: '세대 주소',                      type: 'text',       formulaTemplate: '' },
  { category: '임차인',    description: '입주 예정일',                    type: 'text',       formulaTemplate: '' },
];

function resolveFormulaTemplate(tmpl, allPhs) {
  // [설명] → {index} 로 치환. 못 찾으면 {?} 표시
  return tmpl.replace(/\[([^\]]+)\]/g, (_, desc) => {
    const ph = allPhs.find(p => p.description === desc);
    return ph ? `{${ph.index}}` : '{?}';
  });
}

// ============================================================
// 앱 상태
// ============================================================

let appData = null;
let currentGroupId    = null;
let currentSubgroupId = null;
let currentTemplateId = null;
let editMode          = false;
let bodyEditing       = false;

// 드래그 상태
let _dragSrcPos = null;

// ============================================================
// Firebase 동기화
// ============================================================

const STORAGE_KEY   = 'ipark-doc-gen-v1';
const FB_COLLECTION = 'ipark';
const FB_DOC        = 'data';

let _db              = null;   // Firestore 인스턴스
let _fbReady         = false;  // Firebase 연결 완료 여부
let _localSave       = false;  // 내가 저장 중인 경우 onSnapshot 무시용

function isFirebaseConfigured() {
  // firebase-config.js 의 값이 플레이스홀더가 아닌지 확인
  return typeof FIREBASE_CONFIG !== 'undefined' &&
         FIREBASE_CONFIG.apiKey &&
         FIREBASE_CONFIG.apiKey !== '여기에_붙여넣기';
}

function initFirebase() {
  if (!isFirebaseConfigured()) return;
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();
    _fbReady = true;
  } catch (e) {
    console.warn('Firebase 초기화 실패:', e);
  }
}

function setSyncBadge(state) {
  // state: 'ok' | 'saving' | 'offline' | null
  const el = document.getElementById('syncBadge');
  if (!el) return;
  if (!state || !isFirebaseConfigured()) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden', 'sync-ok', 'sync-saving', 'sync-offline');
  if (state === 'ok')      { el.classList.add('sync-ok');      el.textContent = '☁ 동기화됨'; }
  if (state === 'saving')  { el.classList.add('sync-saving');  el.textContent = '↑ 저장 중…'; }
  if (state === 'offline') { el.classList.add('sync-offline'); el.textContent = '⚠ 오프라인'; }
}

async function loadDataFromFirebase() {
  if (!_fbReady) return false;
  try {
    const snap = await _db.collection(FB_COLLECTION).doc(FB_DOC).get();
    if (snap.exists && snap.data().appData) {
      appData = snap.data().appData;
      mergeNewDefaults();
      setSyncBadge('ok');
      return true;
    }
  } catch (e) {
    console.warn('Firebase 읽기 실패:', e);
    setSyncBadge('offline');
  }
  return false;
}

async function saveDataToFirebase() {
  if (!_fbReady) return;
  _localSave = true;
  setSyncBadge('saving');
  try {
    await _db.collection(FB_COLLECTION).doc(FB_DOC).set({ appData });
    setSyncBadge('ok');
  } catch (e) {
    console.warn('Firebase 쓰기 실패:', e);
    setSyncBadge('offline');
  } finally {
    _localSave = false;
  }
}

function setupRealtimeSync() {
  // 다른 기기가 저장하면 자동으로 반영
  if (!_fbReady) return;
  _db.collection(FB_COLLECTION).doc(FB_DOC).onSnapshot(snap => {
    if (_localSave) return; // 내가 저장한 변경은 무시
    if (snap.exists && snap.data().appData) {
      appData = snap.data().appData;
      mergeNewDefaults();
      renderGroupSelector();
      renderAll();
      setSyncBadge('ok');
    }
  }, err => {
    console.warn('실시간 동기화 오류:', err);
    setSyncBadge('offline');
  });
}

// ============================================================
// 데이터 관리 (localStorage + Firebase)
// ============================================================

async function loadData() {
  // 1순위: Firebase
  if (isFirebaseConfigured()) {
    initFirebase();
    const loaded = await loadDataFromFirebase();
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); // 오프라인 캐시
      return;
    }
  }
  // 2순위: localStorage 캐시
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      appData = JSON.parse(raw);
      mergeNewDefaults();
      return;
    }
  } catch { /* fall through */ }
  // 3순위: 기본값
  appData = deepClone(DEFAULT_DATA);
}

function saveData() {
  // localStorage에 항상 저장 (오프라인 대비)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); } catch { /* full */ }
  // Firebase에도 저장 (비동기, 실패해도 무시)
  saveDataToFirebase();
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function mergeNewDefaults() {
  if (!appData.groups)    appData.groups    = [];
  if (!appData.templates) appData.templates = {};

  for (const dg of DEFAULT_DATA.groups) {
    let ag = appData.groups.find(g => g.id === dg.id);
    if (!ag) { appData.groups.push(deepClone(dg)); ag = appData.groups[appData.groups.length - 1]; }
    for (const ds of dg.subgroups) {
      if (!ag.subgroups.find(s => s.id === ds.id)) ag.subgroups.push(deepClone(ds));
    }
  }
  for (const [id, tmpl] of Object.entries(DEFAULT_DATA.templates)) {
    if (!appData.templates[id]) appData.templates[id] = deepClone(tmpl);
  }
}

function getCurrentTemplate() {
  return currentTemplateId ? appData.templates[currentTemplateId] : null;
}

// ============================================================
// 값 계산
// ============================================================

function getInsertValue(ph, allPhs) {
  // 본문에 삽입될 문자열 반환
  switch (ph.type) {
    case 'text':
    case 'date':
      return ph.value || '';
    case 'amount_man': {
      if (ph.value === '' || ph.value === null) return '';
      const n = Number(ph.value);
      return isNaN(n) ? '' : formatWon(n);
    }
    case 'formula': {
      const r = evaluateFormula(ph.formulaExpr, allPhs);
      if (r === null) return '[수식오류]';
      return formatWon(r);
    }
    default: return ph.value || '';
  }
}

function getNoteText(ph, allPhs) {
  // 비고 셀에 표시할 텍스트 반환
  switch (ph.type) {
    case 'amount_man': {
      if (ph.value === '' || ph.value === null) return '';
      const n = Number(ph.value);
      return isNaN(n) ? '' : numberToKorean(n);
    }
    case 'formula': {
      const r = evaluateFormula(ph.formulaExpr, allPhs);
      if (r === null) return '수식 오류';
      if (isNaN(r))  return '계산 불가';
      return `= ${Math.round(r).toLocaleString()}만\n${numberToKorean(r)}`;
    }
    default: return '';
  }
}

// ============================================================
// HTML 이스케이프
// ============================================================

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// 렌더링
// ============================================================

function renderGroupSelector() {
  const sel = document.getElementById('groupSelect');
  sel.innerHTML = appData.groups.map(g =>
    `<option value="${esc(g.id)}">${esc(g.name)}</option>`
  ).join('');

  if (!currentGroupId || !appData.groups.find(g => g.id === currentGroupId)) {
    currentGroupId = appData.groups[0]?.id || null;
  }
  sel.value = currentGroupId;
  renderSubgroupSelector();
}

function renderSubgroupSelector() {
  const group = appData.groups.find(g => g.id === currentGroupId);
  const sel   = document.getElementById('subgroupSelect');

  if (!group) { sel.innerHTML = ''; return; }

  sel.innerHTML = group.subgroups.map(s =>
    `<option value="${esc(s.id)}">${esc(s.name)}</option>`
  ).join('');

  if (!currentSubgroupId || !group.subgroups.find(s => s.id === currentSubgroupId)) {
    currentSubgroupId = group.subgroups[0]?.id || null;
  }
  sel.value = currentSubgroupId;

  const sub = group.subgroups.find(s => s.id === currentSubgroupId);
  currentTemplateId = sub?.templateId || null;
}

function renderTable() {
  const tmpl = getCurrentTemplate();
  if (!tmpl) { document.getElementById('placeholderBody').innerHTML = ''; return; }

  const phs = tmpl.placeholders;
  const typeLabel = { text: '텍스트', amount_man: '금액(만)', date: '날짜', formula: '수식' };

  const rows = phs.map((ph, pos) => {
    const note = getNoteText(ph, phs);

    // 입력 셀
    let inputCell;
    if (ph.type === 'formula') {
      inputCell = editMode
        ? `<input type="text" class="input-formula" value="${esc(ph.formulaExpr)}"
             placeholder="{1}+{2}" onchange="updateFormulaExpr(${ph.index}, this.value)">`
        : `<span class="formula-display">${esc(ph.formulaExpr) || '(수식 없음)'}</span>`;
    } else {
      const itype = ph.type === 'amount_man' ? 'number' : 'text';
      const extra = ph.type === 'amount_man' ? 'step="any" min="0"' : '';
      inputCell = `<input type="${itype}" class="input-value" value="${esc(ph.value)}"
        placeholder="${ph.type === 'amount_man' ? '만원 단위' : ''}" ${extra}
        oninput="updateValue(${ph.index}, this.value)">`;
    }

    // 설명 셀
    const descCell = editMode
      ? `<input type="text" class="input-desc" value="${esc(ph.description)}"
           onchange="updateDescription(${ph.index}, this.value)">`
      : `<span class="desc-text">${esc(ph.description)}</span>`;

    // 유형 셀
    const typeOptions = Object.entries(typeLabel).map(([v, l]) =>
      `<option value="${v}" ${ph.type === v ? 'selected' : ''}>${l}</option>`
    ).join('');
    const typeCell = editMode
      ? `<select class="select-type" onchange="updateType(${ph.index}, this.value)">${typeOptions}</select>`
      : `<span class="type-badge type-${ph.type}">${typeLabel[ph.type] || ph.type}</span>`;

    // 삭제 셀
    const actionCell = editMode
      ? `<button class="btn-remove" onclick="removePlaceholder(${ph.index})">✕</button>`
      : '';

    return `
      <tr draggable="true"
          ondragstart="onDragStart(event,${pos})"
          ondragover="onDragOver(event,${pos})"
          ondrop="onDrop(event,${pos})"
          ondragend="onDragEnd(event)">
        <td class="col-drag"><span class="drag-handle" title="드래그하여 순서 변경">⠿</span></td>
        <td><span class="placeholder-tag">{${ph.index}}</span></td>
        <td>${descCell}</td>
        <td>${typeCell}</td>
        <td>${inputCell}</td>
        <td class="note-cell"><pre class="note-text">${esc(note)}</pre></td>
        <td class="action-cell">${actionCell}</td>
      </tr>`;
  }).join('');

  document.getElementById('placeholderBody').innerHTML = rows;
  document.getElementById('actionsHeader').classList.toggle('hidden', !editMode);
  document.getElementById('addRowBtn').classList.toggle('hidden', !editMode);
}

function renderPreview() {
  const tmpl = getCurrentTemplate();
  const preview = document.getElementById('documentPreview');
  if (!tmpl) { preview.innerHTML = ''; return; }

  const phs  = tmpl.placeholders;
  const body = bodyEditing
    ? document.getElementById('templateEditor').value
    : tmpl.body;

  // {N} 치환 — 값 있으면 파란색, 없으면 빨간 점선
  const html = esc(body).replace(/\{(\d+)\}/g, (_, numStr) => {
    const idx = parseInt(numStr, 10);
    const ph  = phs.find(p => p.index === idx);
    if (!ph) return `<span class="placeholder-empty">{${numStr}}</span>`;

    const val = getInsertValue(ph, phs);
    if (!val) {
      return `<span class="placeholder-empty">[${esc(ph.description || numStr)}]</span>`;
    }
    return `<span class="placeholder-filled">${esc(val)}</span>`;
  });

  preview.innerHTML = `<pre class="preview-text">${html}</pre>`;
}

function renderAll() {
  renderTable();
  renderPreview();
}

// ============================================================
// 셀렉터 이벤트
// ============================================================

function onGroupChange() {
  currentGroupId    = document.getElementById('groupSelect').value;
  currentSubgroupId = null;
  cancelBodyEdit(false);
  renderSubgroupSelector();
  renderAll();
}

function onSubgroupChange() {
  currentSubgroupId = document.getElementById('subgroupSelect').value;
  const group = appData.groups.find(g => g.id === currentGroupId);
  const sub   = group?.subgroups.find(s => s.id === currentSubgroupId);
  currentTemplateId = sub?.templateId || null;
  cancelBodyEdit(false);
  renderAll();
}

// ============================================================
// 값 변경 핸들러
// ============================================================

function updateValue(index, value) {
  const tmpl = getCurrentTemplate();
  const ph   = tmpl?.placeholders.find(p => p.index === index);
  if (!ph) return;
  ph.value = value;
  saveData();
  updateAllNoteCells(); // 수식 삽입자 포함 전체 비고 갱신
  renderPreview();
}

function updateDescription(index, value) {
  const ph = getCurrentTemplate()?.placeholders.find(p => p.index === index);
  if (!ph) return;
  ph.description = value;
  saveData();
  renderPreview();
}

function updateType(index, value) {
  const ph = getCurrentTemplate()?.placeholders.find(p => p.index === index);
  if (!ph) return;
  ph.type = value;
  if (value === 'formula') { ph.value = ''; }
  else { ph.formulaExpr = ''; }
  saveData();
  renderAll();
}

function updateFormulaExpr(index, value) {
  const ph = getCurrentTemplate()?.placeholders.find(p => p.index === index);
  if (!ph) return;
  ph.formulaExpr = value;
  saveData();
  updateAllNoteCells(); // 수식 변경 시 전체 비고 갱신
  renderPreview();
}

function updateAllNoteCells() {
  const tmpl = getCurrentTemplate();
  if (!tmpl) return;
  tmpl.placeholders.forEach(ph => updateNoteCellDOM(ph.index));
}

function updateNoteCellDOM(index) {
  const tmpl = getCurrentTemplate();
  if (!tmpl) return;
  const ph   = tmpl.placeholders.find(p => p.index === index);
  const phs  = tmpl.placeholders;
  const note = getNoteText(ph, phs);

  const tbody = document.getElementById('placeholderBody');
  const rowIdx = phs.indexOf(ph);
  const row  = tbody.querySelectorAll('tr')[rowIdx];
  const cell = row?.querySelector('.note-text');
  if (cell) cell.textContent = note;
}

// ============================================================
// 편집 모드
// ============================================================

function toggleEditMode() {
  editMode = !editMode;
  const btn = document.getElementById('editModeBtn');
  btn.textContent = editMode ? '✅ 편집 완료' : '✏ 삽입자 편집';
  btn.classList.toggle('active', editMode);
  renderAll();
}

// ============================================================
// 드래그 앤 드롭 순서 변경
// ============================================================

function onDragStart(e, pos) {
  _dragSrcPos = pos;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}

function onDragOver(e, pos) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  // 현재 hover 행만 강조
  document.querySelectorAll('#placeholderBody tr').forEach((tr, i) => {
    tr.classList.toggle('drag-over', i === pos && i !== _dragSrcPos);
  });
}

function onDrop(e, tgtPos) {
  e.preventDefault();
  document.querySelectorAll('#placeholderBody tr').forEach(tr => tr.classList.remove('drag-over'));
  if (_dragSrcPos === null || _dragSrcPos === tgtPos) { _dragSrcPos = null; return; }
  reorderPlaceholders(_dragSrcPos, tgtPos);
  _dragSrcPos = null;
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('#placeholderBody tr').forEach(tr => tr.classList.remove('drag-over'));
  _dragSrcPos = null;
}

function reorderPlaceholders(srcPos, tgtPos) {
  const tmpl = getCurrentTemplate();
  if (!tmpl) return;
  const phs = tmpl.placeholders;

  // 이동 후 각 placeholder 의 new index 를 미리 계산 (old_index → new_index 매핑)
  const newIndexMap = {};
  phs.forEach((ph, i) => {
    let newPos;
    if (i === srcPos) {
      newPos = tgtPos;
    } else if (srcPos < tgtPos) {
      newPos = (i > srcPos && i <= tgtPos) ? i - 1 : i;
    } else {
      newPos = (i >= tgtPos && i < srcPos) ? i + 1 : i;
    }
    newIndexMap[ph.index] = newPos + 1;
  });

  // 수식 삽입자의 {N} 참조를 새 번호로 갱신
  phs.forEach(ph => {
    if (ph.type === 'formula' && ph.formulaExpr) {
      ph.formulaExpr = ph.formulaExpr.replace(/\{(\d+)\}/g, (_, n) => {
        const ni = newIndexMap[parseInt(n, 10)];
        return `{${ni ?? n}}`;
      });
    }
  });

  // 배열 이동
  const [moved] = phs.splice(srcPos, 1);
  phs.splice(tgtPos, 0, moved);

  // 인덱스 재부여 1, 2, 3...
  phs.forEach((ph, i) => { ph.index = i + 1; });

  saveData();
  renderAll();
}

function addPlaceholder() {
  const tmpl = getCurrentTemplate();
  if (!tmpl) return;
  const maxIdx = Math.max(0, ...tmpl.placeholders.map(p => p.index));
  tmpl.placeholders.push({
    index: maxIdx + 1,
    description: '새 항목',
    type: 'text',
    value: '',
    formulaExpr: ''
  });
  saveData();
  renderAll();
}

function removePlaceholder(index) {
  const tmpl = getCurrentTemplate();
  if (!tmpl) return;
  tmpl.placeholders = tmpl.placeholders.filter(p => p.index !== index);
  saveData();
  renderAll();
}

// ============================================================
// 본문 편집
// ============================================================

function showBodyEditor() {
  const tmpl = getCurrentTemplate();
  if (!tmpl) return;
  bodyEditing = true;
  document.getElementById('templateEditor').value = tmpl.body;
  document.getElementById('templateEditorDiv').classList.remove('hidden');
  document.getElementById('documentPreview').classList.add('hidden');
}

function saveBodyEdit() {
  const tmpl = getCurrentTemplate();
  if (!tmpl) return;
  tmpl.body = document.getElementById('templateEditor').value;
  saveData();
  cancelBodyEdit(true);
}

function cancelBodyEdit(doRender = true) {
  bodyEditing = false;
  document.getElementById('templateEditorDiv').classList.add('hidden');
  document.getElementById('documentPreview').classList.remove('hidden');
  if (doRender) renderPreview();
}

// templateEditor 입력 시 실시간 미리보기 (에디터 숨겨져 있어도 데이터 반영)
function onTemplateEditorInput() {
  renderPreview();
}

// ============================================================
// 문서 출력
// ============================================================

function getDocumentText() {
  const tmpl = getCurrentTemplate();
  if (!tmpl) return '';
  const phs = tmpl.placeholders;
  return tmpl.body.replace(/\{(\d+)\}/g, (match, numStr) => {
    const ph = phs.find(p => p.index === parseInt(numStr, 10));
    if (!ph) return match;
    return getInsertValue(ph, phs) || match;
  });
}

async function copyDocument() {
  const text = getDocumentText();
  try {
    await navigator.clipboard.writeText(text);
    showToast('클립보드에 복사되었습니다!');
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('클립보드에 복사되었습니다!');
  }
}

function shareKakao() {
  const text = getDocumentText();
  if (navigator.share) {
    // 모바일: 네이티브 공유시트 (카카오톡 포함)
    navigator.share({ text }).catch(() => {});
  } else {
    // PC: 클립보드 복사 후 안내
    navigator.clipboard?.writeText(text)
      .then(() => showToast('복사 완료! 카카오톡에 붙여넣기 하세요.', 3000))
      .catch(() => showToast('카카오톡 앱에서 직접 붙여넣기 하세요.', 3000));
  }
}

function printDocument() {
  const text  = getDocumentText();
  const title = getCurrentTemplate()?.name || '문서';
  const win   = window.open('', '_blank', 'width=800,height=700');
  win.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <style>
    body { font-family: 'Malgun Gothic','Apple SD Gothic Neo',sans-serif; padding:30px; line-height:2; font-size:14px; color:#000; }
    pre  { white-space:pre-wrap; word-break:keep-all; }
    @page { margin: 20mm; }
  </style>
</head>
<body>
  <pre>${esc(text)}</pre>
  <script>window.onload=function(){ window.print(); setTimeout(()=>window.close(),500); };<\/script>
</body>
</html>`);
  win.document.close();
}

// ============================================================
// 내보내기 / 가져오기
// ============================================================

function exportData() {
  const json = JSON.stringify(appData, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ipark-templates-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('데이터를 내보냈습니다.');
}

function importData() {
  document.getElementById('importFile').click();
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.groups || !data.templates) throw new Error('형식 오류');
      appData = data;
      saveData();
      currentGroupId = currentSubgroupId = currentTemplateId = null;
      renderGroupSelector();
      renderAll();
      showToast('데이터를 성공적으로 가져왔습니다.');
    } catch {
      showToast('파일 형식이 올바르지 않습니다.', 3000, 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function resetData() {
  if (!confirm('모든 데이터를 기본값으로 초기화하시겠습니까?\n저장된 내용이 모두 삭제됩니다.')) return;
  localStorage.removeItem(STORAGE_KEY);
  appData = deepClone(DEFAULT_DATA);
  currentGroupId = currentSubgroupId = currentTemplateId = null;
  editMode = false;
  renderGroupSelector();
  renderAll();
  showToast('초기화되었습니다.');
}

// ============================================================
// 삽입자 라이브러리 UI
// ============================================================

function renderLibrary() {
  const tbody = document.getElementById('libraryBody');
  if (!tbody) return;
  const typeLabel = { text: '텍스트', amount_man: '금액(만)', date: '날짜', formula: '수식' };

  tbody.innerHTML = PLACEHOLDER_LIBRARY.map((item, i) => `
    <tr>
      <td class="col-check">
        <input type="checkbox" class="lib-check" data-lib="${i}"
               onchange="this.closest('tr').classList.toggle('lib-selected', this.checked)">
      </td>
      <td><span class="lib-cat-badge">${esc(item.category)}</span></td>
      <td>${esc(item.description)}</td>
      <td><span class="type-badge type-${item.type}">${typeLabel[item.type]}</span></td>
      <td>${item.formulaTemplate
            ? `<span class="lib-formula-hint">${esc(item.formulaTemplate)}</span>`
            : '<span style="color:#d1d5db">—</span>'}</td>
    </tr>`).join('');
}

function selectAllLibrary(checked) {
  document.querySelectorAll('.lib-check').forEach(cb => {
    cb.checked = checked;
    cb.closest('tr').classList.toggle('lib-selected', checked);
  });
}

function addLibraryItems() {
  const tmpl = getCurrentTemplate();
  if (!tmpl) { showToast('먼저 템플릿을 선택하세요.', 2000, 'error'); return; }

  const checked = Array.from(document.querySelectorAll('.lib-check:checked'));
  if (checked.length === 0) { showToast('추가할 항목을 선택하세요.', 2000, 'error'); return; }

  const selected = checked.map(cb => PLACEHOLDER_LIBRARY[parseInt(cb.dataset.lib, 10)]);
  const maxIdx   = Math.max(0, ...tmpl.placeholders.map(p => p.index));

  // 1차: 인덱스 먼저 할당
  const newPhs = selected.map((item, i) => ({
    index: maxIdx + i + 1,
    description: item.description,
    type: item.type,
    value: '',
    formulaExpr: ''
  }));

  // 2차: 수식 템플릿 해석 (기존 + 새 삽입자 통합해서 참조)
  const allPhs = [...tmpl.placeholders, ...newPhs];
  newPhs.forEach((ph, i) => {
    if (selected[i].formulaTemplate) {
      ph.formulaExpr = resolveFormulaTemplate(selected[i].formulaTemplate, allPhs);
    }
  });

  tmpl.placeholders.push(...newPhs);

  // 선택 해제
  selectAllLibrary(false);

  saveData();
  renderAll();
  showToast(`${newPhs.length}개 삽입자가 추가되었습니다.`);
}

// ============================================================
// 토스트 알림
// ============================================================

let _toastTimer = null;
function showToast(msg, duration = 2000, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast' + (type === 'error' ? ' toast-error' : '');
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

// ============================================================
// 초기화
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 이벤트 먼저 연결
  document.getElementById('editModeBtn')  .addEventListener('click', toggleEditMode);
  document.getElementById('editBodyBtn')  .addEventListener('click', showBodyEditor);
  document.getElementById('saveBodyBtn')  .addEventListener('click', saveBodyEdit);
  document.getElementById('cancelBodyBtn').addEventListener('click', () => cancelBodyEdit(true));
  document.getElementById('addRowBtn')    .addEventListener('click', addPlaceholder);
  document.getElementById('templateEditor').addEventListener('input', onTemplateEditorInput);

  // 데이터 로드 (Firebase or localStorage)
  await loadData();

  // 첫 번째 그룹/세부항목 선택
  currentGroupId    = appData.groups[0]?.id    || null;
  const firstGroup  = appData.groups[0];
  currentSubgroupId = firstGroup?.subgroups[0]?.id || null;
  currentTemplateId = firstGroup?.subgroups[0]?.templateId || null;

  renderGroupSelector();
  renderAll();
  renderLibrary();

  // Firebase 실시간 동기화 시작 (다른 기기 변경 자동 반영)
  setupRealtimeSync();
});
