/**
 * AI900 題庫搜尋功能
 */

let questions = [];

const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const resultsDiv = document.getElementById('search-results');
const resultCount = document.getElementById('result-count');
let debounceTimer;

// 載入題庫
fetch('data/questions.json')
    .then(res => res.json())
    .then(data => {
        questions = data;
        resultCount.textContent = `題庫共 ${data.length} 題`;
    })
    .catch(() => {
        resultsDiv.innerHTML = '<div class="alert alert-danger">題庫載入失敗，請確認 data/questions.json 檔案存在。</div>';
    });

// 搜尋輸入事件 (debounce 300ms)
searchInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(performSearch, 300);
});

// 按 Enter 立即搜尋
searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        clearTimeout(debounceTimer);
        performSearch();
    }
});

// 清除按鈕
clearBtn.addEventListener('click', function () {
    searchInput.value = '';
    resultsDiv.innerHTML = '';
    resultCount.textContent = `題庫共 ${questions.length} 題`;
    searchInput.focus();
});

// 題型篩選 checkbox 變更時重新搜尋
document.querySelectorAll('#type-filters .form-check-input').forEach(cb => {
    cb.addEventListener('change', performSearch);
});

/**
 * 執行搜尋
 */
function performSearch() {
    const keyword = searchInput.value.trim().toLowerCase();
    if (!keyword) {
        resultsDiv.innerHTML = '';
        resultCount.textContent = `題庫共 ${questions.length} 題`;
        return;
    }

    // 取得勾選的題型
    const checkedTypes = Array.from(
        document.querySelectorAll('#type-filters .form-check-input:checked')
    ).map(cb => cb.value);

    // 篩選題型 + 關鍵字比對
    const results = questions.filter(q => {
        if (!checkedTypes.includes(q.type)) return false;

        const questionText = stripHtml(q.question).toLowerCase();
        const optionTexts = q.options.map(o => stripHtml(o).toLowerCase()).join(' ');
        const explanationText = (q.explanation || '').toLowerCase();
        const idText = String(q.id);

        return questionText.includes(keyword) ||
            optionTexts.includes(keyword) ||
            explanationText.includes(keyword) ||
            idText === keyword;
    });

    resultCount.textContent = `找到 ${results.length} 筆結果（共 ${questions.length} 題）`;
    renderResults(results, keyword);
}

/**
 * 渲染搜尋結果
 */
function renderResults(results, keyword) {
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="text-center text-muted py-4">' +
            '<i class="fa-solid fa-face-sad-tear fa-2x mb-2"></i><br>找不到符合的題目</div>';
        return;
    }

    let html = '';
    results.forEach(q => {
        html += renderQuestionCard(q, keyword);
    });
    resultsDiv.innerHTML = html;
}

/**
 * 渲染單題卡片
 */
function renderQuestionCard(q, keyword) {
    const typeBadge = getTypeBadge(q.type);
    let questionHtml = processQuestionText(q.question);
    questionHtml = highlightKeyword(questionHtml, keyword);

    let html = '<div class="search-result-card">';

    // 標題列：題號 + 題型 + 權重
    html += '<div class="d-flex align-items-center mb-2">';
    html += `<span class="badge bg-primary me-2">第 ${q.id} 題</span>`;
    html += typeBadge;
    if (q.weight > 1) {
        html += `<span class="badge bg-warning text-dark ms-2">權重 ${q.weight}</span>`;
    }
    html += '</div>';

    // 題目文字
    html += `<div class="search-question-text">${questionHtml}</div>`;

    // 題目圖片
    if (q.image) {
        html += `<div class="my-2"><img src="${q.image}" alt="題目圖片" style="max-width:100%;max-height:300px;border-radius:6px;"></div>`;
    }

    // 選項列表
    html += renderOptions(q, keyword);

    // 解析（預設摺疊）
    if (q.explanation && q.explanation.trim()) {
        html += renderExplanation(q, keyword);
    }

    html += '</div>';
    return html;
}

/**
 * 渲染選項列表（依題型處理）
 */
function renderOptions(q, keyword) {
    let html = '<div class="search-options">';

    if (q.type === 'truefalse') {
        q.options.forEach((opt, idx) => {
            const isCorrect = q.answer.includes(idx + 1);
            const correctClass = isCorrect ? 'search-correct-option' : '';
            const icon = isCorrect ? '<i class="fa-solid fa-check text-success me-1"></i>' : '';
            const badge = isCorrect ? '<span class="badge bg-success ms-2">正確答案</span>' : '';
            html += `<div class="search-option ${correctClass}">`;
            html += `${icon}<span>${highlightKeyword(opt, keyword)}</span>${badge}`;
            html += '</div>';
        });
    } else if (q.type === 'multioption') {
        // 多選下拉題：每個 option 格式如 "空格N: opt1, opt2, opt3"
        q.options.forEach((opt, idx) => {
            const isCorrect = q.answer.length > idx;
            const correctIdx = isCorrect ? q.answer[idx] - 1 : -1;
            const parts = opt.split(',').map(s => s.trim());
            html += `<div class="search-option">`;
            html += `<span class="option-number">選項 ${idx + 1}：</span>`;
            parts.forEach((part, pIdx) => {
                if (pIdx === correctIdx) {
                    html += `<span class="badge bg-success me-1">${highlightKeyword(part, keyword)}</span>`;
                } else {
                    html += `<span class="me-1">${highlightKeyword(part, keyword)}</span>`;
                }
                if (pIdx < parts.length - 1) html += ' / ';
            });
            html += '</div>';
        });
    } else {
        // single / multiple
        const isMultiple = q.type === 'multiple';
        q.options.forEach((opt, idx) => {
            const isCorrect = q.answer.includes(idx + 1);
            const correctClass = isCorrect ? 'search-correct-option' : '';
            const icon = isCorrect ? '<i class="fa-solid fa-check text-success me-1"></i>' : '';
            const badge = isCorrect
                ? (isMultiple ? '<span class="badge bg-success ms-2">正確</span>' : '<span class="badge bg-success ms-2">正確答案</span>')
                : '';
            const optText = highlightKeyword(opt.replace(/\n/g, '<br>'), keyword);
            html += `<div class="search-option ${correctClass}">`;
            html += `<span class="option-number">${idx + 1}.</span> ${icon}${optText}${badge}`;
            html += '</div>';
        });
    }

    html += '</div>';
    return html;
}

/**
 * 渲染解析（預設摺疊）
 */
function renderExplanation(q, keyword) {
    let explanationHtml = processQuestionText(q.explanation);
    explanationHtml = highlightKeyword(explanationHtml, keyword);

    return `<details class="mt-2">
        <summary style="cursor:pointer;color:#3498db;font-weight:bold;">
            <i class="fa-solid fa-lightbulb"></i> 查看解析
        </summary>
        <div class="search-explanation">${explanationHtml}</div>
    </details>`;
}

// ==================== 工具函式 ====================

/**
 * 取得題型 badge HTML
 */
function getTypeBadge(type) {
    const badges = {
        'single': '<span class="badge bg-info">單選</span>',
        'multiple': '<span class="badge bg-warning text-dark">複選</span>',
        'truefalse': '<span class="badge bg-secondary">是非</span>',
        'multioption': '<span class="badge bg-purple text-white">下拉選項</span>'
    };
    return badges[type] || `<span class="badge bg-dark">${type}</span>`;
}

/**
 * 處理題目/解析文字（換行、反引號、code block）
 */
function processQuestionText(text) {
    if (!text) return '';
    let processed = text.replace(/\\n/g, '\n');

    if (processed.includes('<pre><code class="language-')) {
        const parts = processed.split(/(<pre><code.*?>[\s\S]*?<\/code><\/pre>)/g);
        return parts.map(part => {
            if (part.startsWith('<pre><code')) return part;
            return formatBacktickText(part).replace(/\n/g, '<br>');
        }).join('');
    }
    return formatBacktickText(processed).replace(/\n/g, '<br>');
}

/**
 * 將反引號包圍文字轉為 <code> 標籤
 */
function formatBacktickText(text) {
    if (!text) return '';
    let tempMarkers = [];
    let tempText = text;
    const preCodeRegex = /(<pre><code.*?>[\s\S]*?<\/code><\/pre>)/g;
    let match;
    let index = 0;
    while ((match = preCodeRegex.exec(text)) !== null) {
        const marker = `__CODE_BLOCK_${index}__`;
        tempMarkers.push({ marker, content: match[0] });
        index++;
    }
    tempMarkers.forEach(item => { tempText = tempText.replace(item.content, item.marker); });
    tempText = tempText.replace(/`([^`]+)`/g, '<code>$1</code>');
    tempMarkers.forEach(item => { tempText = tempText.replace(item.marker, item.content); });
    return tempText;
}

/**
 * 移除 HTML 標籤
 */
function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

/**
 * 關鍵字高亮（安全處理 HTML 標籤）
 */
function highlightKeyword(text, keyword) {
    if (!keyword || !text) return text;
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedKeyword, 'gi');

    // 使用 DOM 安全地高亮文字節點
    const temp = document.createElement('div');
    temp.innerHTML = text;
    highlightTextNodes(temp, regex);
    return temp.innerHTML;
}

/**
 * 遞迴高亮文字節點
 */
function highlightTextNodes(node, regex) {
    if (node.nodeType === 3) { // TEXT_NODE
        const text = node.textContent;
        const match = regex.exec(text);
        if (match) {
            const span = document.createElement('mark');
            const after = node.splitText(match.index);
            after.textContent = after.textContent.substring(match[0].length);
            span.textContent = match[0];
            node.parentNode.insertBefore(span, after);
            // 重設 regex lastIndex 以繼續搜尋後續文字
            regex.lastIndex = 0;
            highlightTextNodes(after, regex);
        }
    } else if (node.nodeType === 1 && node.tagName !== 'MARK' && node.tagName !== 'CODE' && node.tagName !== 'PRE') {
        Array.from(node.childNodes).forEach(child => highlightTextNodes(child, regex));
    }
}
