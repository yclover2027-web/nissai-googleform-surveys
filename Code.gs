/**
 * クローバー薬局 カスタムフォーム用 PDF自動生成＆スプレッドシート書き込みスクリプト
 * （ウェブアプリ版）
 */

// ==========================================================================
// 設定項目（他店舗展開時はここを変更）
// ==========================================================================
const STORE_NAME = 'クローバー薬局';
const FOLDER_ID = '1AWpZQwtF2VusSpJf9PF3OnurIdrHI6uj'; // アンケートにっさい店フォルダ
const SPREADSHEET_ID = '1vaSrrAEP688wvgoKcdpOAzYDFkJtxt4e38JIXQ83dcA';
const PDF_TITLE_PREFIX = '問診票_';

/**
 * 西暦の年から和暦表記を付加した生年月日文字列を返す
 * 入力例: "2000/1/15" → 出力例: "2000/1/15（平成年12年1月15日）"
 */
function birthdateWithWareki(birthdate) {
  if (!birthdate || birthdate === '-') return birthdate || '-';
  const parts = birthdate.split('/');
  if (parts.length < 3) return birthdate;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return birthdate;

  let wareki = '';
  let warekiYear;
  if (y >= 2019) {
    warekiYear = y - 2018;
    wareki = (warekiYear === 1 ? '令和元年' : '令和' + warekiYear + '年') + m + '月' + d + '日';
  } else if (y >= 1989) {
    warekiYear = y - 1988;
    wareki = (warekiYear === 1 ? '平成元年' : '平成' + warekiYear + '年') + m + '月' + d + '日';
  } else if (y >= 1926) {
    warekiYear = y - 1925;
    wareki = (warekiYear === 1 ? '昭和元年' : '昭和' + warekiYear + '年') + m + '月' + d + '日';
  } else if (y >= 1912) {
    warekiYear = y - 1911;
    wareki = (warekiYear === 1 ? '大正元年' : '大正' + warekiYear + '年') + m + '月' + d + '日';
  } else {
    warekiYear = y - 1867;
    wareki = (warekiYear === 1 ? '明治元年' : '明治' + warekiYear + '年') + m + '月' + d + '日';
  }
  return birthdate + '（' + wareki + '）';
}

/**
 * ウェブアプリとしてデータを受け取った時に実行される関数
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    data.timestamp = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");

    writeToSpreadsheet(data);

    const htmlContent = createHtmlTemplate(data);
    saveAsPdf(htmlContent, data.name, data.timestamp);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('エラーが発生しました: ' + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * スプレッドシートへの追記処理
 */
function writeToSpreadsheet(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheets()[0]; 
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const rowData = new Array(headers.length).fill('');
  
  const getColIndex = (keyword) => {
    return headers.findIndex(h => String(h).indexOf(keyword) !== -1);
  };

  const mapping = {
    'タイムスタンプ': data.timestamp,
    '名前': data.name,
    'ふりがな': data.kana,
    '電話': data.tel,
    '住所': data.address,
    'LINE': data.lineName,
    '生年月日': data.birthdate,
    '初めて': data.isFirst,
    '性別': data.sex,
    '症状': data.symptoms,
    'かかりつけ': data.kakaritsu,
    'ジェネリック': data.generic,
    '手帳': data.handbook,
    'アレルギーで': data.hasAllergy,
    'アレルギーにチェック': data.allergy,
    '副作用': data.sideEffects,
    '具体的には': data.sideEffectsDetail,
    '機関以外': data.otherHospitals,
    '購入して服用': data.supplements,
    'どのようなお薬か': data.supplementNames,
    '病気': data.diseases,
    '飲んだり食べたり': data.food,
    '妊娠': data.pregnancy,
    '授乳': data.pregnancy,
    '体重': data.weight
  };

  for (let key in mapping) {
    let idx = getColIndex(key);
    if (idx !== -1) {
      rowData[idx] = mapping[key];
    }
  }

  let emptyIdx = headers.findIndex(h => String(h).trim() === '');
  if (emptyIdx !== -1) {
    rowData[emptyIdx] = data.constitution;
  }

  if(getColIndex('タイムスタンプ') === -1) {
      if(headers.length === 0) rowData.push(data.timestamp);
      else rowData[0] = data.timestamp; 
  }

  sheet.appendRow(rowData);
}

/**
 * HTMLテンプレートの作成
 */
function createHtmlTemplate(data) {
  let totalLength = 0;
  for (let key in data) {
    totalLength += String(data[key] || '').length;
  }
  
  let fontSize = '13px';
  let tdPadding = '6px 4px';
  if (totalLength > 300) { fontSize = '12px'; tdPadding = '5px 4px'; }
  if (totalLength > 450) { fontSize = '11.5px'; tdPadding = '4px 4px'; }
  if (totalLength > 600) { fontSize = '10.5px'; tdPadding = '3px 4px'; }

  const html = '<!DOCTYPE html>'
    + '<html><head><style>'
    + '@page { margin: 10mm; }'
    + 'body { font-family: "Noto Sans JP", "MS Gothic", sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 0; font-size: ' + fontSize + '; }'
    + '.container { width: 100%; margin: 0; padding: 0; }'
    + 'h1 { text-align: center; font-size: 16px; border-bottom: 2px solid #2d5a27; padding-bottom: 4px; margin: 0 0 10px 0; color: #2d5a27; }'
    + 'table { width: 100%; border-collapse: collapse; table-layout: fixed; }'
    + 'td { padding: ' + tdPadding + '; border-bottom: 1px dotted #ccc; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }'
    + '.label { font-weight: bold; width: 38%; color: #444; }'
    + '.value { width: 62%; }'
    + '.section-header { background: #f0f7f0; padding: 4px 8px; margin: 10px 0 4px 0; font-weight: bold; border-left: 5px solid #6cb281; font-size: 11px; }'
    + '.footer { margin-top: 10px; font-size: 9px; text-align: right; color: #888; }'
    + '</style></head><body>'
    + '<div class="container">'
    + '<h1>' + STORE_NAME + ' ご利用の方へ（回答）</h1>'
    + '<table>'
    + '<tr><td class="label">タイムスタンプ :</td><td class="value">' + (data.timestamp || '-') + '</td></tr>'
    + '<tr><td class="label">ふりがな :</td><td class="value">' + (data.kana || '-') + '</td></tr>'
    + '<tr><td class="label">お名前 :</td><td class="value">' + (data.name || '-') + '</td></tr>'
    + '<tr><td class="label">性別 :</td><td class="value">' + (data.sex || '-') + '</td></tr>'
    + '<tr><td class="label">お電話番号 :</td><td class="value">' + (data.tel || '-') + '</td></tr>'
    + '<tr><td class="label">ご住所 :</td><td class="value">' + (data.address || '-') + '</td></tr>'
    + '<tr><td class="label">LINE名 :</td><td class="value">' + (data.lineName || '-') + '</td></tr>'
    + '<tr><td class="label">生年月日 :</td><td class="value">' + birthdateWithWareki(data.birthdate) + '</td></tr>'
    + '<tr><td class="label">当薬局をご利用するのは初めてですか？ :</td><td class="value">' + (data.isFirst || '-') + '</td></tr>'
    + '</table>'
    + '<div class="section-header">問診項目</div>'
    + '<table>'
    + '<tr><td class="label">本日はどのような症状で受診されましたか？ :</td><td class="value">' + (data.symptoms || '-') + '</td></tr>'
    + '<tr><td class="label">かかりつけ薬剤師は希望されますか？ :</td><td class="value">' + (data.kakaritsu || '-') + '</td></tr>'
    + '<tr><td class="label">ジェネリック医薬品をご希望になりますか？ :</td><td class="value">' + (data.generic || '-') + '</td></tr>'
    + '<tr><td class="label">お薬手帳をお持ちですか？ :</td><td class="value">' + (data.handbook || '-') + '</td></tr>'
    + '<tr><td class="label">体質について :</td><td class="value">' + (data.constitution || '-') + '</td></tr>'
    + '<tr><td class="label">アレルギーについて :</td><td class="value">' + (data.allergy || '-') + '</td></tr>'
    + '<tr><td class="label">副作用の経験 :</td><td class="value">' + (data.sideEffects || '-') + ' (' + (data.sideEffectsDetail || '-') + ')' + '</td></tr>'
    + '<tr><td class="label">他の医療機関のお薬 :</td><td class="value">' + (data.otherHospitals || '-') + '</td></tr>'
    + '<tr><td class="label">市販薬・サプリメント :</td><td class="value">' + (data.supplements || '-') + ' (' + (data.supplementNames || '-') + ')' + '</td></tr>'
    + '<tr><td class="label">過去の病気 :</td><td class="value">' + (data.diseases || '-') + '</td></tr>'
    + '<tr><td class="label">日頃飲んだり食べたりするもの :</td><td class="value">' + (data.food || '-') + '</td></tr>'
    + '<tr><td class="label">妊娠・授乳中（女性） :</td><td class="value">' + (data.pregnancy || '-') + '</td></tr>'
    + '<tr><td class="label">現在の体重（15歳未満） :</td><td class="value">' + (data.weight || '-') + ' kg</td></tr>'
    + '</table>'
    + '<div class="footer">出力日時: ' + Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss") + '</div>'
    + '</div></body></html>';
  return html;
}

/**
 * PDFとして保存
 */
function saveAsPdf(htmlContent, name, timestamp) {
  let folder;
  try {
    if (FOLDER_ID === 'ここにGoogleドライブの保存先フォルダIDを記入してください' || FOLDER_ID.trim() === '') {
      folder = DriveApp.getRootFolder();
      console.warn('FOLDER_IDが設定されていないため、マイドライブ直下に保存します。');
    } else {
      folder = DriveApp.getFolderById(FOLDER_ID);
    }
  } catch(e) {
    folder = DriveApp.getRootFolder();
    console.warn('指定されたフォルダにアクセスできなかったため、マイドライブに保存します: ' + e.toString());
  }

  const blob = Utilities.newBlob(htmlContent, 'text/html', 'temp.html');
  const pdfBlob = blob.getAs('application/pdf');
  
  const dateStr = timestamp.replace(/[:\/ ]/g, '_');
  pdfBlob.setName(PDF_TITLE_PREFIX + name + '_' + dateStr + '.pdf');
  
  folder.createFile(pdfBlob);
}

// CORS対応のためのOPTIONSリクエストハンドラ
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
