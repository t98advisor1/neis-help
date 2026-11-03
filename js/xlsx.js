'use strict';
/* 엑셀 파일(.xlsx) 만들기 — 외부 라이브러리 없이 (AGENTS: npm 패키지 없음).
 * .xlsx 는 XML 파일 몇 개를 zip 으로 묶은 것이다. 여기서는 압축하지 않고(저장 방식) 묶는다.
 * 사용: SMXlsx.build({ name, columns: [{ header, width, wrap }], rows: [[값, ...]] }) → Uint8Array
 * 숫자는 숫자 칸, 나머지는 글자 칸. 첫 줄(제목 줄)은 굵게·고정·필터. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SMXlsx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const enc = new TextEncoder();

  // XML 에 넣을 수 없는 제어 문자는 빼고, 특수 문자는 바꾼다 (U+FFFE·U+FFFF 도 XML 에 못 넣어 엑셀이 파일을 열지 못했음)
  const xmlText = (v) => String(v == null ? '' : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // A, B, … Z, AA …
  const colName = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

  function sheetXml(sheet) {
    const cols = sheet.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 12}" customWidth="1"/>`).join('');
    const cell = (v, r, c, style) => {
      const ref = colName(c) + r;
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlText(v)}</t></is></c>`;
    };
    const head = `<row r="1">${sheet.columns.map((c, i) => cell(c.header, 1, i, 1)).join('')}</row>`;
    const body = sheet.rows.map((row, ri) => `<row r="${ri + 2}">${row.map((v, ci) => cell(v, ri + 2, ci, sheet.columns[ci].wrap ? 2 : 3)).join('')}</row>`).join('');
    const last = colName(sheet.columns.length - 1) + (sheet.rows.length + 1);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      `<cols>${cols}</cols><sheetData>${head}${body}</sheetData>` +
      `<autoFilter ref="A1:${last}"/></worksheet>`;
  }

  // 0 기본, 1 제목 줄(굵게·연한 바탕·가운데), 2 줄바꿈·위 정렬(문단), 3 위 정렬
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFE9E3"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function parts(sheet) {
    // 시트 이름: 31자 이내, 엑셀이 막는 글자 빼기
    const name = String(sheet.name || '시트1').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || '시트1';
    return [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${xmlText(name)}" sheetId="1" r:id="rId1"/></sheets>` +
        `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xmlText(name).replace(/'/g, "''")}'!$A$1:$${colName(sheet.columns.length - 1)}$${sheet.rows.length + 1}</definedName></definedNames>` +
        '</workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>'],
      ['xl/styles.xml', STYLES],
      ['xl/worksheets/sheet1.xml', sheetXml(sheet)],
    ];
  }

  // zip 묶기 (압축 없음). CRC-32 는 zip 규격이 요구하는 검사값
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

  function zip(files, when) {
    const d = when || new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const chunks = [], central = [];
    let offset = 0;
    const u16 = (v) => [v & 0xFF, (v >>> 8) & 0xFF];
    const u32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
    for (const [name, text] of files) {
      const nameB = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(time), ...u16(date), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0)];
      const local = new Uint8Array([...u32(0x04034B50), ...common]);
      chunks.push(local, nameB, data);
      central.push(new Uint8Array([...u32(0x02014B50), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), nameB);
      offset += local.length + nameB.length + data.length;
    }
    const cdSize = central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array([...u32(0x06054B50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
    const all = chunks.concat(central, [end]);
    const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
    let p = 0; for (const c of all) { out.set(c, p); p += c.length; }
    return out;
  }

  function build(sheet, when) { return zip(parts(sheet), when); }
  // zip: [[경로, 글]] 을 그대로 묶는다 — 스킬 파일(ZIP) 내려받기도 같은 코드를 쓴다
  return { build, zip, MIME: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
});
