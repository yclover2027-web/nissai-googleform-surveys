/* ==========================================================================
   クローバー薬局 カスタムフォーム ロジック (Web App連携版)
   ========================================================================== */

/* ==========================================================================
   店舗別 設定項目（新しい店舗を展開する際はこのブロック内を変更してください）
   ========================================================================== */
const CONFIG = {
    // 【重要】公開したGASのウェブアプリURL
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbyn0NgLK9lEaFNy9XYd0xS2Gu0ufvxe685BQoy_cNCbBpuB648OzRY-VKB2i59I571o/exec',

    // 【重要】LINE Developersで発行したLIFF ID
    LIFF_ID: '2009477758-tzdIGItZ',

    // 【重要】公式LINEの友だち追加リンク（未登録ユーザーを誘導する先）
    LINE_ADD_FRIEND_URL: 'https://lin.ee/L3JwMAp'
};

document.addEventListener('DOMContentLoaded', () => {
    // 生年月日の選択肢を生成
    populateBirthDate();

    // LIFFの初期化 (LINE名自動取得)
    initializeLiff();

    // マイナンバーCBのトグルロジックを設定
    setupMynumberToggle();

    const form = document.getElementById('customForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');

    // YubinBangoの郵便番号フィールドでのEnterキー送信防止
    const postalInput = document.getElementById('postal-code');
    if (postalInput) {
        postalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // 誤送信防止
            }
        });
    }

    form.addEventListener('submit', (e) => {
        // 標準のフォーム送信（画面遷移）をブロック
        e.preventDefault();

        // HTML5バリデーションのチェック
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Web App URLが設定されているか確認
        if (CONFIG.WEB_APP_URL.includes('ここにウェブアプリのURLを貼り付けます')) {
            alert('【設定エラー】script.js 内の CONFIG.WEB_APP_URL に公開されたURLを設定してください。');
            return;
        }

        // 送信中のUI表示
        submitBtn.disabled = true;
        btnText.textContent = '送信中...';
        spinner.style.display = 'inline-block';

        // フォームデータから必要なデータを抽出
        const formData = new FormData(form);
        const isMynumber = document.getElementById('mynumber-checkbox').checked;

        // 生年月日データの結合
        const birthYear = document.getElementById('birth-year').value;
        const birthMonth = document.getElementById('birth-month').value;
        const birthDay = document.getElementById('birth-day').value;
        const birthdate = (birthYear && birthMonth && birthDay) ? `${birthYear}/${birthMonth}/${birthDay}` : '';

        let symptoms = formData.get('entry.150137659') || '';

        // 体質の結合処理
        let taishitsuResult = "体質: いいえ";
        const taishitsuCheckboxes = Array.from(document.querySelectorAll('.taishitsu-check:checked'));
        if (taishitsuCheckboxes.length > 0) {
            const checks = taishitsuCheckboxes.map(cb => {
                if (cb.value === 'その他') return 'その他(' + document.getElementById('taishitsu_other').value + ')';
                return cb.value;
            });
            taishitsuResult = "体質: はい (" + checks.join(', ') + ")";
        }

        let womenStatus = formData.getAll('women_status').join(', ') || 'いいえ';

        // 共通データ（NFC経由は常に「初めてです。」固定）
        const isFirst = '初めてです。';

        // 詳細データ
        const generic = formData.get('entry.893585706') || '';
        const constitution = taishitsuResult;
        const hasAllergy = formData.getAll('entry.413348291').length > 0 ? "はい" : "いいえ";
        const allergy = (formData.getAll('entry.413348291').map(v => v === 'その他' ? 'その他(' + (document.getElementById('allergy_other_text').value || '') + ')' : v)).join(', ') || '-';
        const sideEffects = formData.get('entry.918293202') || 'いいえ';
        const sideEffectsDetail = formData.get('entry.1883828617') || '-';
        const otherHospitals = formData.get('entry.1565002541') || 'いいえ';
        const supplements = formData.get('entry.1965254761') || 'いいえ';
        const supplementNames = formData.get('entry.1747385177') || '-';

        let diseasesList = formData.getAll('entry.730294101');
        let diseasesOther = formData.get('entry.730294101.other_option_response') || '';
        let diseases = diseasesList.filter(v => v !== '__other_option__').join(', ') || '-';
        if (diseasesOther) {
            diseases += (diseases === '-' || diseases === '') ? diseasesOther : ', ' + diseasesOther;
        }

        const food = formData.getAll('entry.1740273603').join(', ') || '-';
        const pregnancy = womenStatus;
        const weight = formData.get('entry.2101115460') || '-';

        // 保険証情報参照時は、性別・住所・生年月日を「保険証情報参照」とする
        const sexValue = isMynumber ? '保険証情報参照' : (formData.get('entry.1417926586') || '');
        const addressValue = isMynumber ? '保険証情報参照' : (formData.get('entry.375838857') || '');
        const birthdateValue = isMynumber ? '保険証情報参照' : birthdate;

        // 送信用のJSONデータを作成
        const data = {
            name: formData.get('entry.2108592001') || '',
            kana: formData.get('entry.1016463931') || '',
            sex: sexValue,
            tel: formData.get('entry.622897563') || '',
            address: addressValue,
            lineName: formData.get('entry.1331782479') || '',
            isFirst: isFirst,
            symptoms: symptoms,
            generic: generic,
            handbook: formData.get('entry.1482297776') || '',
            constitution: constitution,
            hasAllergy: hasAllergy,
            allergy: allergy,
            sideEffects: sideEffects,
            sideEffectsDetail: sideEffectsDetail,
            otherHospitals: otherHospitals,
            supplements: supplements,
            supplementNames: supplementNames,
            diseases: diseases,
            food: food,
            pregnancy: pregnancy,
            weight: weight,
            birthdate: birthdateValue
        };

        // fetch による非同期送信 (JSON を text/plain で送ることでCORS preflight回避)
        fetch(CONFIG.WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify(data)
        })
            .then(response => response.json())
            .then(result => {
                if (result.status === 'success') {
                    handleFormSubmitResponse();
                } else {
                    throw new Error(result.message || '送信に失敗しました');
                }
            })
            .catch(error => {
                alert('エラーが発生しました: ' + error.message + '\nインターネット接続等を確認してください。');
                submitBtn.disabled = false;
                btnText.textContent = '送信する';
                spinner.style.display = 'none';
            });
    });
});

/**
 * 送信成功時のUI切り替え処理
 */
function handleFormSubmitResponse() {
    const form = document.getElementById('customForm');
    const thankYouMessage = document.getElementById('thankYouMessage');
    const formHeader = document.querySelector('.form-header');

    // フォームを非表示にしてサンクスメッセージを表示、トップまでスクロール
    form.style.display = 'none';
    formHeader.style.display = 'none';
    thankYouMessage.style.display = 'block';
    window.scrollTo(0, 0);
}

/**
 * 生年月日のドロップダウンを生成する処理
 */
function populateBirthDate() {
    const yearSelect = document.getElementById('birth-year');
    const monthSelect = document.getElementById('birth-month');
    const daySelect = document.getElementById('birth-day');

    if (!yearSelect || !monthSelect || !daySelect) return;

    const currentYear = new Date().getFullYear();
    // 1900年から今年まで
    for (let y = currentYear; y >= 1900; y--) {
        let wareki = "";
        if (y >= 2019) {
            const reiwa = y - 2018;
            wareki = reiwa === 1 ? "令和元年" : `令和${reiwa}年`;
        } else if (y >= 1989) {
            const heisei = y - 1988;
            wareki = heisei === 1 ? "平成元年" : `平成${heisei}年`;
        } else if (y >= 1926) {
            const showa = y - 1925;
            wareki = showa === 1 ? "昭和元年" : `昭和${showa}年`;
        } else if (y >= 1912) {
            const taisho = y - 1911;
            wareki = taisho === 1 ? "大正元年" : `大正${taisho}年`;
        } else {
            const meiji = y - 1867;
            wareki = meiji === 1 ? "明治元年" : `明治${meiji}年`;
        }
        const option = document.createElement("option");
        option.value = y;
        option.textContent = `${y}年 (${wareki})`;
        if (y === 1980) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    }

    // 月の生成 (1〜12)
    for (let m = 1; m <= 12; m++) {
        const option = document.createElement("option");
        option.value = m;
        option.textContent = `${m}月`;
        monthSelect.appendChild(option);
    }

    // 日の生成 (1〜31)
    for (let d = 1; d <= 31; d++) {
        const option = document.createElement("option");
        option.value = d;
        option.textContent = `${d}日`;
        daySelect.appendChild(option);
    }
}

/**
 * マイナンバー情報利用チェックボックスのトグル処理
 * チェック時: 性別・生年月日・住所を非表示にし、required を解除
 * チェック解除時: 再表示し、required を復元
 */
function setupMynumberToggle() {
    const checkbox = document.getElementById('mynumber-checkbox');
    if (!checkbox) return;

    checkbox.addEventListener('change', function () {
        const targets = document.querySelectorAll('.mynumber-skip-target');
        const isChecked = this.checked;

        targets.forEach(group => {
            if (isChecked) {
                // 非表示にする
                group.style.display = 'none';
                // required 属性を退避して解除
                group.querySelectorAll('[required]').forEach(el => {
                    el.removeAttribute('required');
                    el.setAttribute('data-mynumber-required', 'true');
                });
                // ラジオボタンの選択をクリア
                group.querySelectorAll('input[type="radio"]').forEach(el => {
                    el.checked = false;
                });
                // セレクトボックスをリセット
                group.querySelectorAll('select').forEach(el => {
                    el.selectedIndex = 0;
                });
                // テキスト入力をクリア
                group.querySelectorAll('input[type="text"], input[type="tel"]').forEach(el => {
                    el.value = '';
                });
            } else {
                // 再表示する
                group.style.display = '';
                // required 属性を復元
                group.querySelectorAll('[data-mynumber-required="true"]').forEach(el => {
                    el.setAttribute('required', 'required');
                    el.removeAttribute('data-mynumber-required');
                });
            }
        });
    });
}


/**
 * LIFFの初期化とプロフィール情報の取得
 * 友だち登録済みの場合はそのままフォームを表示
 * 未登録の場合は友だち追加リンクを表示
 */
function initializeLiff() {
    const liffId = CONFIG.LIFF_ID;

    // フォームを表示するヘルパー関数
    function showForm() {
        const loadingMsg = document.getElementById('loadingMessage');
        if (loadingMsg) loadingMsg.style.display = 'none';
        const formHeader = document.querySelector('.form-header');
        if (formHeader) formHeader.style.display = '';
        document.getElementById('customForm').style.display = 'block';
    }

    // 友だち追加を促す画面を表示するヘルパー関数
    function showFriendPrompt() {
        const loadingMsg = document.getElementById('loadingMessage');
        if (loadingMsg) {
            loadingMsg.innerHTML = '<div style="text-align:center; padding: 30px 20px;">' +
                '<p style="font-size: 1.1rem; margin-bottom: 15px;">アンケートにご回答いただくには<br>LINE友だち追加が必要です。</p>' +
                '<a href="' + CONFIG.LINE_ADD_FRIEND_URL + '" style="display: inline-block; background: #06C755; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1rem;">LINEで友だち追加する</a>' +
                '<p style="margin-top: 20px; font-size: 0.85rem; color: #718096;">友だち追加後、このページを再読み込みしてください。</p>' +
                '</div>';
        }
    }

    if (typeof liff === 'undefined') {
        // LIFF SDKが読み込めなかった場合もフォームを表示
        showForm();
        return;
    }

    liff.init({ liffId: liffId })
        .then(() => {
            if (!liff.isLoggedIn()) {
                // 自動遷移（認可画面やログイン）を行う
                liff.login();
                return; // login()が走るとリダイレクトされるため以降の処理は不要
            }

            // プロフィール名を取得
            const profilePromise = liff.getProfile()
                .then(profile => {
                    const lineNameInput = document.getElementById('entry.1331782479');
                    if (lineNameInput && !lineNameInput.value) {
                        lineNameInput.value = profile.displayName;
                    }
                })
                .catch(err => {
                    console.error('LIFF getProfile error:', err);
                });

            // 友だち登録状態を確認
            const friendshipPromise = liff.getFriendship()
                .then(data => {
                    return data.friendFlag;
                })
                .catch(err => {
                    console.error('LIFF getFriendship error:', err);
                    return true; // エラー時はフォーム表示
                });

            Promise.all([profilePromise, friendshipPromise])
                .then(([_, isFriend]) => {
                    // URLやハッシュからスキップフラグがあるか確認（LIFF経由でのクエリ欠損・エンコード対策）
                    const currentUrl = window.location.href;
                    const skipPrompt = currentUrl.includes('skip=true') || currentUrl.includes('%3Fskip%3Dtrue') || currentUrl.includes('#skip');

                    if (isFriend || skipPrompt) {
                        // 友だち登録済み または スキップパラメータあり → そのままフォーム表示
                        showForm();
                    } else {
                        // 友だち未登録 → 友だち追加を促す
                        showFriendPrompt();
                    }
                });
        })
        .catch(err => {
            console.error('LIFF init error:', err);
            // 初期化エラーでもフォームを表示
            showForm();
        });
}
