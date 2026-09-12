/**
 * ============================================================
 *  第7回デモ用｜問い合わせフォーム → AIで分類・要約 → 台帳 → 通知
 * ============================================================
 *
 *  これは「完成形」です。デモの3分間で動かして見せます。
 *  7分でライブ追加するのは notifyOnError の呼び出し1か所だけです。
 *
 * ------------------------------------------------------------
 *  組み立て方（デモの3週間前にやっておく）
 * ------------------------------------------------------------
 *  1. Google フォームを作る（氏名／会社名／種別／本文 の4項目）
 *  2. 回答先スプレッドシートを開き、F〜H列に「分類」「要約」「担当」の見出しを足す
 *  3. スプレッドシートから 拡張機能 → Apps Script を開き、このコードを貼る
 *  4. プロジェクトの設定 → スクリプト プロパティ に次を登録する
 *       OPENAI_API_KEY   … APIキー
 *       NOTIFY_TO        … 担当者のメールアドレス
 *       OWNER_TO         … 社長のメールアドレス（無音検知の通知先）
 *  5. トリガーを2つ作る
 *       onFormSubmit_   … スプレッドシートから／フォーム送信時
 *       checkSilence    … 時間主導型／日タイマー／午前9時〜10時
 *  6. 自分でフォームに1件送って、台帳に3列が埋まり、通知が届くことを確認する
 *
 * ------------------------------------------------------------
 *  費用について（受講者に必ず言うこと）
 * ------------------------------------------------------------
 *  新しいサービスの契約は増えません。AIの利用料だけ、使った分がかかります。
 *  廉価モデルなら問い合わせ1件あたり 0.1円以下。月100件でも数十円です。
 *  ただし「0円ではない」ので、第11回の費用管理表には1行として載せます。
 * ============================================================
 */

var P = PropertiesService.getScriptProperties();
var MODEL = 'gpt-5.6-luna';   // 廉価モデル。分類と要約はこれで足ります
var CATEGORIES = ['見積依頼', '納期の相談', 'クレーム', '採用', 'その他'];
var ASSIGNEE = {
  '見積依頼': '営業',
  '納期の相談': '工場長',
  'クレーム': '社長',
  '採用': '総務',
  'その他': '総務'
};

// ============================================================
//  フォーム送信時に動く（トリガー：フォーム送信時）
// ============================================================
function onFormSubmit_(e) {
  try {
    var sheet = e.range.getSheet();
    var row = e.range.getRow();

    // A:タイムスタンプ B:氏名 C:会社名 D:種別 E:本文
    var name = sheet.getRange(row, 2).getValue();
    var company = sheet.getRange(row, 3).getValue();
    var body = sheet.getRange(row, 5).getValue();

    var result = classifyAndSummarize_(body);

    sheet.getRange(row, 6).setValue(result.category);   // F列 分類
    sheet.getRange(row, 7).setValue(result.summary);    // G列 要約
    sheet.getRange(row, 8).setValue(ASSIGNEE[result.category] || '総務');  // H列 担当

    MailApp.sendEmail({
      to: P.getProperty('NOTIFY_TO'),
      subject: '【' + result.category + '】' + company + ' ' + name + ' 様より',
      body: [
        '会社名：' + company,
        'お名前：' + name,
        '担当　：' + (ASSIGNEE[result.category] || '総務'),
        '',
        '【要約】',
        result.summary,
        '',
        '【本文】',
        body
      ].join('\n')
    });

  } catch (err) {
    // ★ここが、デモの7分でライブ追加する1行です★
    notifyOnError_('onFormSubmit_', err);
  }
}

// ============================================================
//  AIに投げる（分類と要約を1回のリクエストで取る）
// ============================================================
function classifyAndSummarize_(body) {
  var prompt = [
    'あなたは製造業の会社の受付担当です。',
    '次の問い合わせ本文を読んで、JSONだけを返してください。',
    '',
    '【分類】次のいずれか1つを厳密に選ぶ：' + CATEGORIES.join(' / '),
    '【要約】60字以内。数量・納期・金額が書いてあれば必ず残す。',
    '【出力形式】{"category":"...","summary":"..."} のJSONのみ。前置きも説明も付けない。',
    '',
    '--- 問い合わせ本文 ---',
    body
  ].join('\n');

  var res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + P.getProperty('OPENAI_API_KEY') },
    payload: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0
    }),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    throw new Error('API ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  }

  var text = JSON.parse(res.getContentText()).choices[0].message.content;
  var json = JSON.parse(text.replace(/```json|```/g, '').trim());

  // 想定外の分類が返ってきたら「その他」に寄せる（勝手な分類を作らせない）
  if (CATEGORIES.indexOf(json.category) === -1) json.category = 'その他';
  return json;
}

// ============================================================
//  ★ライブで足す部分★ 失敗したときに自分に通知する
// ============================================================
function notifyOnError_(where, err) {
  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),
    subject: '【自動化が止まりました】' + where,
    body: [
      '処理が失敗しました。',
      '',
      '場所：' + where,
      '内容：' + err,
      '',
      '手動に戻す手順：',
      '1. 回答スプレッドシートを開く',
      '2. F〜H列が空の行を探す',
      '3. その行を目で読んで、分類と担当を手で入れる',
      '4. 担当者にメールを転送する',
      '',
      '※ 止まっても業務は死にません。人が読めば済みます。'
    ].join('\n')
  });
}

// ============================================================
//  無音検知（トリガー：日タイマー）
//  3日間、行が増えていなければ社長に知らせる
// ============================================================
function checkSilence() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var last = sheet.getLastRow();
  if (last < 2) return;

  var lastTs = new Date(sheet.getRange(last, 1).getValue());
  var days = (new Date() - lastTs) / (1000 * 60 * 60 * 24);

  if (days >= 3) {
    MailApp.sendEmail({
      to: P.getProperty('OWNER_TO'),
      subject: '【確認】問い合わせが3日間ありません',
      body: [
        '最後の問い合わせ：' + Utilities.formatDate(lastTs, 'JST', 'yyyy/MM/dd HH:mm'),
        '',
        '本当に問い合わせが無いのか、',
        'フォームか自動化が止まっているのか、どちらかです。',
        'フォームのURLを開いて、1件テスト送信してみてください。'
      ].join('\n')
    });
  }
}

// ============================================================
//  おまけ：自分でテストするとき
// ============================================================
function testClassify() {
  var r = classifyAndSummarize_(
    'SUS304のφ32フランジを50個、10月10日までにお願いしたいのですが、お見積もりいただけますか。'
  );
  Logger.log(r);   // {category=見積依頼, summary=...} と出れば成功
}
