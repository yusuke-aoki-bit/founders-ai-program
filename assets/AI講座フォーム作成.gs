/**
 * ============================================================
 *  経営者のためのAI実装講座　フォーム一括作成スクリプト
 * ============================================================
 *
 *  これを1回実行すると、次の4つが自動で作られます。
 *
 *    ① AIスキル診断フォーム（受講前・修了時 共通）
 *    ② 各回ふりかえりフォーム（毎回の終わりに1分で回答）
 *    ③ 修了時 成果報告フォーム
 *    ④ 上記すべての回答が集まるスプレッドシート
 *       （診断は送信と同時に自動採点され「診断結果」シートに記録されます）
 *
 * ------------------------------------------------------------
 *  使い方
 * ------------------------------------------------------------
 *  1. https://script.google.com/ を開き「新しいプロジェクト」
 *  2. 表示されたコードを全部消して、このファイルの中身を全部貼り付ける
 *  3. 上部の実行する関数を「setupAll」にして「実行」
 *  4. 権限の確認画面が出たら承認する（詳細は手順ガイド参照）
 *  5. 下部の「実行ログ」に、作成されたフォームのURLが出ます
 *
 *  ※ 2回目以降に実行すると別のフォームがもう一組できます。
 *    作り直したいときは、先に古いフォームをドライブから削除してください。
 * ------------------------------------------------------------
 */

// ============ 設定（必要ならここだけ変更）============
var CONFIG = {
  courseName: '経営者のためのAI実装講座',
  // 受講者に見せるフォームの説明文の差出人。空欄でも動きます。
  organizer: '',
  // 作成物の名前
  ssName: 'AI実装講座_回答集計',
  diagnosticFormName: 'AIスキル診断シート',
  feedbackFormName: '各回ふりかえり（1分）',
  resultFormName: '修了時 成果報告シート'
};

// 選択肢（点数は左から 0・1・2・3・4 点）
var FREQ  = ['使っていない', '数回試した', '月に数回', '週に数回', 'ほぼ毎日'];
var AGREE = ['全く違う', 'あまり', 'どちらとも', 'やや当てはまる', 'とても当てはまる'];
var WANT  = ['必要ない', 'あまり困らない', 'できれば楽にしたい', 'かなり困っている', '最優先'];

// A. 利用状況（8問／32点満点）
var Q_USE = [
  'ご自身でChatGPT・Claude・Geminiなどの生成AIを使っている',
  'メールや社外文書の作成にAIを使っている',
  '会議の議事録づくり・要約にAIを使っている',
  '提案書・企画書・チラシなどの資料作成にAIを使っている',
  '調べもの・情報収集にAIを使っている',
  '売上・在庫などの数字の集計や分析にAIを使っている',
  '社員が業務でAIを使っている',
  '有料版のAIサービス（月額プラン）を契約している'
];

// B. スキル・体制（12問／48点満点）
var Q_SKILL = [
  'AIに指示を出すとき、役割・背景・条件・出力形式を具体的に書ける',
  '回答が期待と違ったとき、指示を修正して望む結果に近づけられる',
  'AIが事実と異なることを言う場合があると理解し、必ず裏取りしている',
  '自社の資料・データをAIに読み込ませて答えさせることができる',
  'AIに入れてよい情報と入れてはいけない情報の線引きが判断できる',
  '自社のどの業務がAIで効率化できるか、具体的に3つ以上挙げられる',
  'AI導入の費用と削減効果を、ざっくりでも数字で試算できる',
  '社員にAIの使い方を自分の言葉で説明・指導できる',
  '複数のAIサービスの得意分野の違いを理解し、使い分けている',
  'AIを使った業務の手順書があり、担当者が替わっても回る',
  'AI利用に関する社内ルール・ガイドラインを整備している',
  '今後1年間のAI活用について、自社の方針を持っている'
];

// 業務の困りごと
var TASKS = [
  '見積書・請求書の作成', '議事録・日報・報告書の作成', 'メール・電話などの顧客対応',
  '提案書・企画書の作成', '求人原稿づくり・採用対応', '社内マニュアル・手順書の整備',
  'SNS・ホームページ・チラシの更新', '売上・原価などの集計と分析', '在庫管理・発注',
  'スケジュール調整・シフト作成', '補助金・許認可などの書類作成', 'クレーム・問い合わせ対応'
];

// レベル判定（下限点, レベル名, 講評）
var LEVELS = [
  [64, 'Lv.5 組織展開', '組織的に運用中。他社を牽引できる水準。事業モデル側への応用が次の段階。'],
  [48, 'Lv.4 業務組込', '業務プロセスに組み込み済み。ルール整備と投資判断が論点。'],
  [32, 'Lv.3 個人活用', '自分の仕事では使えている。社内に横展開する型づくりが次の壁。'],
  [16, 'Lv.2 お試し',   '触ってはいるが単発利用。使いどころを決めて習慣化する段階。'],
  [0,  'Lv.1 検索代わり', '調べもの中心の使い方です。まず「指示の型」と、自社の前提の渡し方から始めます。']
];

var PROP_SS   = 'AI_KOZA_SS_ID';
var PROP_FORM = 'AI_KOZA_DIAG_FORM_ID';
var RESULT_SHEET = '診断結果';


// ============================================================
//  メイン：これを実行する
// ============================================================
function setupAll() {
  var ss = SpreadsheetApp.create(CONFIG.ssName);
  var ssId = ss.getId();

  var diag = buildDiagnosticForm_();
  var fb   = buildFeedbackForm_();
  var res  = buildResultForm_();

  diag.setDestination(FormApp.DestinationType.SPREADSHEET, ssId);
  fb.setDestination(FormApp.DestinationType.SPREADSHEET, ssId);
  res.setDestination(FormApp.DestinationType.SPREADSHEET, ssId);

  var props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_SS, ssId);
  props.setProperty(PROP_FORM, diag.getId());

  prepareResultSheet_(ss);
  installTrigger_(diag);

  // Google が自動生成する空シート「シート1」が残っていれば消す
  try {
    var blank = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
    if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
  } catch (err) { /* 消せなくても問題ありません */ }

  var msg = [
    '',
    '===========================================',
    ' 作成が完了しました',
    '===========================================',
    '',
    '■ ① AIスキル診断（受講者に送るURL）',
    '   ' + diag.getPublishedUrl(),
    '   編集する場合： ' + diag.getEditUrl(),
    '',
    '■ ② 各回ふりかえり（毎回の終わりに送るURL）',
    '   ' + fb.getPublishedUrl(),
    '   編集する場合： ' + fb.getEditUrl(),
    '',
    '■ ③ 修了時 成果報告（最終回に送るURL）',
    '   ' + res.getPublishedUrl(),
    '   編集する場合： ' + res.getEditUrl(),
    '',
    '■ ④ 回答集計スプレッドシート',
    '   ' + ss.getUrl(),
    '   ※ 診断フォームの送信と同時に「' + RESULT_SHEET + '」シートへ',
    '     点数とレベルが自動で記録されます。',
    '',
    '受講者に送るのは ① の「' + diag.getPublishedUrl().slice(0, 40) + '...」です。',
    ''
  ].join('\n');
  Logger.log(msg);
  return msg;
}


// ============================================================
//  ① AIスキル診断フォーム
// ============================================================
function buildDiagnosticForm_() {
  var form = FormApp.create(CONFIG.diagnosticFormName);
  form.setTitle(CONFIG.courseName + '　AIスキル診断シート');
  form.setDescription(
    'この講座は「知識を聞く講座」ではなく、自社のAI業務を実際に立ち上げる実践講座です。\n' +
    'あなたの現在地を先に教えていただくことで、演習の題材と進め方をあなたの会社に合わせて調整します。\n\n' +
    '所要時間は約10分です。正解を答える必要はありません。素直な現状をご記入ください。\n' +
    '点数が低いことは全く問題ありません。むしろ伸びしろの大きさを示します。\n\n' +
    '※ パソコンでのご回答をおすすめします（表形式の設問があるため）。'
  );
  softSet_(form, 'setProgressBar', true);
  softSet_(form, 'setCollectEmail', false);
  softSet_(form, 'setLimitOneResponsePerUser', false);
  softSet_(form, 'setAllowResponseEdits', true);
  softSet_(form, 'setShowLinkToRespondAgain', false);
  form.setConfirmationMessage(
    'ご回答ありがとうございました。\n内容を拝見したうえで、初回の進め方をご相談させていただきます。'
  );

  // --- 基本情報 ---
  form.addSectionHeaderItem().setTitle('基本情報');

  form.addMultipleChoiceItem()
    .setTitle('いまはどちらのタイミングですか')
    .setHelpText('受講前と修了時に同じ設問へお答えいただき、点数の伸びを見ます。')
    .setChoiceValues(['受講前', '修了時'])
    .setRequired(true);

  addText_(form, '会社名', '例：株式会社さくら製作所', true);
  addText_(form, 'お名前', '例：山田 太郎', true);
  addText_(form, '役職', '例：代表取締役', false);
  addText_(form, '業種', '例：金属加工（製造業）', true);
  addText_(form, '従業員数', '例：18名（パート含む）', false);
  addText_(form, 'メールアドレス', '日程のご連絡に使用します', true);
  addText_(form, '主な顧客', '例：地元の建設会社10社程度（BtoB）', false);
  addText_(form, 'ITの得意な社員の有無', '例：いない／1名（20代・事務）', false);
  addText_(form, '普段お使いのPC・ソフト', '例：Windows、Excel、freee、LINE', false);

  // --- A. 利用状況 ---
  form.addPageBreakItem()
    .setTitle('A　いまの利用状況')
    .setHelpText('あてはまるものを1つずつ選んでください。全8問です。');
  form.addGridItem()
    .setTitle('現在、AIをどのくらいの頻度で使っていますか')
    .setRows(Q_USE)
    .setColumns(FREQ)
    .setRequired(true);

  // --- B. スキル・体制 ---
  form.addPageBreakItem()
    .setTitle('B　スキルと社内体制')
    .setHelpText('できていなくても問題ありません。現状のままお答えください。全12問です。');
  form.addGridItem()
    .setTitle('次のことは、どのくらい当てはまりますか')
    .setRows(Q_SKILL)
    .setColumns(AGREE)
    .setRequired(true);

  // --- 業務の困りごと ---
  form.addPageBreakItem()
    .setTitle('C　時間がかかっている業務')
    .setHelpText('ここが講座の中心です。初回はこの回答をもとに、AI化する業務を一緒に選びます。');
  form.addGridItem()
    .setTitle('それぞれの業務について、AIで楽にしたい度合いを教えてください')
    .setRows(TASKS)
    .setColumns(WANT)
    .setRequired(true);
  form.addParagraphTextItem()
    .setTitle('特に時間がかかっている業務を3つ、月あたりのおおよその時間とあわせて教えてください')
    .setHelpText('例：\n・見積書の作成／私と事務1名で月20時間\n・議事録／月6時間\n・請求書／月8時間')
    .setRequired(true);
  form.addParagraphTextItem()
    .setTitle('その業務の、いまのやり方と困っていることを具体的にお書きください')
    .setHelpText('例：手書きの原稿をExcelに転記している。過去の似た案件を探すのに毎回30分かかる。')
    .setRequired(false);

  // --- ご要望 ---
  form.addPageBreakItem()
    .setTitle('D　ご要望・ご不安')
    .setHelpText('最後の設問です。');
  addPara_(form, 'この講座が終わったとき、どうなっていたら「参加してよかった」と思えますか', '', true);
  addPara_(form, 'AI活用について、いま一番不安・心配なことは何ですか', '', false);
  addPara_(form, '過去にAIやITツールを試して、うまくいかなかった経験はありますか', '内容もあわせてお書きください', false);
  addPara_(form, '社内でAIを広げるうえで、障害になりそうなことはありますか', '', false);
  addPara_(form, '特に扱ってほしいテーマ・業務があればお書きください', '', false);
  addPara_(form, '受講にあたっての制約（PC環境・都合のつかない曜日や時間帯など）', '', false);

  return form;
}


// ============================================================
//  ② 各回ふりかえりフォーム
// ============================================================
function buildFeedbackForm_() {
  var form = FormApp.create(CONFIG.feedbackFormName);
  form.setTitle(CONFIG.courseName + '　各回ふりかえり');
  form.setDescription('毎回の終わりに1分でお答えください。次回の進め方の調整に使います。');
  softSet_(form, 'setCollectEmail', false);
  softSet_(form, 'setLimitOneResponsePerUser', false);
  form.setConfirmationMessage('ありがとうございました。');

  addText_(form, '会社名', '', true);

  form.addListItem()
    .setTitle('今回は第何回でしたか')
    .setChoiceValues(['第1回', '第2回', '第3回', '第4回', '第5回', '第6回',
                      '第7回', '第8回', '第9回', '第10回', '第11回', '第12回'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('今日の内容は自社で使えそうですか')
    .setChoiceValues(['すぐ使える', 'たぶん使える', 'あまり使えなさそう', '使えない'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('演習の難易度はどうでしたか')
    .setChoiceValues(['易しすぎた', 'ちょうどよい', '難しかった'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('宿題は、次回までにやれそうですか')
    .setChoiceValues(['やれそう', 'たぶんやれる', '正直きびしい'])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('次回までに一番不安なことを1行でお書きください')
    .setRequired(false);

  return form;
}


// ============================================================
//  ③ 修了時 成果報告フォーム
// ============================================================
function buildResultForm_() {
  var form = FormApp.create(CONFIG.resultFormName);
  form.setTitle(CONFIG.courseName + '　修了時 成果報告シート');
  form.setDescription(
    '最終回の前にご記入ください。投資対効果の試算と、次期の募集資料づくりに使わせていただきます。\n' +
    '事例として社外に紹介する場合は、必ず事前に個別のご了解をいただきます。'
  );
  softSet_(form, 'setCollectEmail', false);
  form.setConfirmationMessage('ありがとうございました。最終回でご一緒に振り返ります。');

  addText_(form, '会社名', '', true);
  addText_(form, 'お名前', '', true);

  form.addParagraphTextItem()
    .setTitle('この講座で作ったAIツールは何ですか')
    .setHelpText('例：過去の見積実績から見積根拠を組み立てるアシスタント')
    .setRequired(true);

  form.addTextItem()
    .setTitle('その業務は、以前は月に何時間かかっていましたか')
    .setHelpText('数字だけ入力してください（例：20）')
    .setRequired(true);

  form.addTextItem()
    .setTitle('いまは月に何時間かかっていますか')
    .setHelpText('数字だけ入力してください（例：7）')
    .setRequired(true);

  form.addTextItem()
    .setTitle('社内の人件費単価は、1時間あたりおよそいくらですか')
    .setHelpText('試算に使います。ざっくりで構いません（例：3000）')
    .setRequired(false);

  form.addTextItem()
    .setTitle('AIサービスに月あたりいくら払っていますか')
    .setHelpText('数字だけ入力してください（例：3000）')
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('社員への展開状況')
    .setChoiceValues(['まだ社長のみ', '1名に展開済み', '2〜3名に展開済み', '全社で使っている'])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('社員の反応はどうでしたか')
    .setHelpText('否定的な反応こそ貴重です。そのままお書きください。')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('うまくいかなかったこと・つまずいたことを教えてください')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('次にAI化したい業務は何ですか')
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('この内容を、匿名化したうえで他社への事例紹介に使わせていただいてもよろしいですか')
    .setHelpText('社名は出しません。「従業員18名の金属加工業」といった形になります。')
    .setChoiceValues(['はい', '相談したい', 'いいえ'])
    .setRequired(true);

  return form;
}


// ============================================================
//  自動採点（診断フォームの送信時に動きます）
// ============================================================
function onDiagnosticSubmit(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var ss = SpreadsheetApp.openById(props.getProperty(PROP_SS));
    var sheet = ss.getSheetByName(RESULT_SHEET) || prepareResultSheet_(ss);

    var items = e.response.getItemResponses();
    var get = function (titlePart) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].getItem().getTitle().indexOf(titlePart) !== -1) return items[i].getResponse();
      }
      return null;
    };

    var useAns   = get('どのくらいの頻度で使っていますか');
    var skillAns = get('どのくらい当てはまりますか');
    var wantAns  = get('AIで楽にしたい度合い');

    var useScore   = sumGrid_(useAns, FREQ);
    var skillScore = sumGrid_(skillAns, AGREE);
    var total = useScore + skillScore;
    var lv = judgeLevel_(total);

    // 「最優先」に近い順で、困っている業務の上位3つを拾う
    var top = topTasks_(wantAns, 3);

    sheet.appendRow([
      new Date(),
      get('タイミング') || '',
      get('会社名') || '',
      get('お名前') || '',
      get('業種') || '',
      get('従業員数') || '',
      useScore,
      skillScore,
      total,
      lv[0],
      lv[1],
      top,
      get('月あたりのおおよその時間') || ''
    ]);
  } catch (err) {
    Logger.log('採点でエラー: ' + err);
  }
}

function sumGrid_(answer, columns) {
  if (!answer) return 0;
  var rows = Array.isArray(answer) ? answer : [answer];
  var sum = 0;
  for (var i = 0; i < rows.length; i++) {
    var idx = columns.indexOf(rows[i]);
    if (idx >= 0) sum += idx;
  }
  return sum;
}

function judgeLevel_(total) {
  for (var i = 0; i < LEVELS.length; i++) {
    if (total >= LEVELS[i][0]) return [LEVELS[i][1], LEVELS[i][2]];
  }
  return [LEVELS[LEVELS.length - 1][1], LEVELS[LEVELS.length - 1][2]];
}

function topTasks_(answer, n) {
  if (!answer) return '';
  var rows = Array.isArray(answer) ? answer : [answer];
  var scored = [];
  for (var i = 0; i < rows.length && i < TASKS.length; i++) {
    var idx = WANT.indexOf(rows[i]);
    if (idx > 0) scored.push({ name: TASKS[i], score: idx });
  }
  scored.sort(function (a, b) { return b.score - a.score; });
  var out = [];
  for (var j = 0; j < scored.length && j < n; j++) {
    out.push(scored[j].name + '(' + WANT[scored[j].score] + ')');
  }
  return out.join(' / ');
}


// ============================================================
//  補助
// ============================================================
function prepareResultSheet_(ss) {
  var sheet = ss.getSheetByName(RESULT_SHEET);
  if (!sheet) sheet = ss.insertSheet(RESULT_SHEET, 0);
  if (sheet.getLastRow() === 0) {
    var head = ['送信日時', 'タイミング', '会社名', 'お名前', '業種', '従業員数',
                'A.利用状況(32点)', 'B.スキル体制(48点)', '合計(80点)', 'レベル', '講評',
                '困っている業務 上位3', '時間がかかっている業務'];
    sheet.appendRow(head);
    sheet.getRange(1, 1, 1, head.length)
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f3864')
      .setVerticalAlignment('middle').setWrap(true);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(3, 180);
    sheet.setColumnWidth(11, 300);
    sheet.setColumnWidth(12, 260);
    sheet.setColumnWidth(13, 260);
  }
  return sheet;
}

function installTrigger_(form) {
  var all = ScriptApp.getProjectTriggers();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === 'onDiagnosticSubmit') ScriptApp.deleteTrigger(all[i]);
  }
  ScriptApp.newTrigger('onDiagnosticSubmit').forForm(form).onFormSubmit().create();
}

function addText_(form, title, help, required) {
  var it = form.addTextItem().setTitle(title).setRequired(!!required);
  if (help) it.setHelpText(help);
  return it;
}

function addPara_(form, title, help, required) {
  var it = form.addParagraphTextItem().setTitle(title).setRequired(!!required);
  if (help) it.setHelpText(help);
  return it;
}

/** 環境によって使えない設定があってもスクリプトを止めないための小道具 */
function softSet_(obj, method, value) {
  try { if (typeof obj[method] === 'function') obj[method](value); }
  catch (err) { /* この環境では使えない設定。無視して続行します */ }
}


// ============================================================
//  おまけ：作ったフォームのURLをもう一度知りたいとき実行
// ============================================================
function showUrls() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty(PROP_SS);
  var formId = props.getProperty(PROP_FORM);
  if (!ssId || !formId) {
    Logger.log('まだ setupAll を実行していないようです。');
    return;
  }
  var form = FormApp.openById(formId);
  Logger.log('診断フォーム（受講者に送るURL）: ' + form.getPublishedUrl());
  Logger.log('集計スプレッドシート: ' + SpreadsheetApp.openById(ssId).getUrl());
}
