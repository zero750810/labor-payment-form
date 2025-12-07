// 勞報單產生器 - JavaScript

document.addEventListener('DOMContentLoaded', function() {
    initUrlParams();
    initDateField();
    initAmountCalculation();
    initImageUpload();
    initSignature();
    initPdfGeneration();
});

// ==================== URL 參數預填 ====================
const LOCKED_FIELDS = ['projectName', 'companyName', 'companyContact', 'serviceContent', 'incomeCategory'];

function initUrlParams() {
    const params = new URLSearchParams(window.location.search);

    const fieldMapping = {
        'projectName': 'projectName',
        'companyName': 'companyName',
        'companyContact': 'companyContact',
        'serviceContent': 'serviceContent',
        'incomeCategory': 'incomeCategory',
        'totalAmount': 'totalAmount',
        'payeeName': 'payeeName',
        'idNumber': 'idNumber',
        'payeeContact': 'payeeContact',
        'address': 'address',
        'nationality': 'nationality',
        'bankName': 'bankName',
        'branchName': 'branchName',
        'accountName': 'accountName',
        'accountNumber': 'accountNumber'
    };

    for (const [param, fieldId] of Object.entries(fieldMapping)) {
        const value = params.get(param);
        if (value) {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = decodeURIComponent(value);

                if (LOCKED_FIELDS.includes(fieldId)) {
                    if (field.tagName === 'SELECT') {
                        field.disabled = true;
                    } else {
                        field.readOnly = true;
                    }
                }
            }
        }
    }

    if (params.get('totalAmount')) {
        calculateAmounts();
    }
}

// ==================== 日期欄位初始化 ====================
function initDateField() {
    const dateField = document.getElementById('formDate');
    const today = new Date().toISOString().split('T')[0];
    dateField.value = today;
}

// ==================== 金額自動計算 ====================
function initAmountCalculation() {
    const totalAmountField = document.getElementById('totalAmount');
    const unionMemberField = document.getElementById('unionMember');

    totalAmountField.addEventListener('input', calculateAmounts);
    unionMemberField.addEventListener('change', calculateAmounts);
}

function calculateAmounts() {
    const totalAmount = parseFloat(document.getElementById('totalAmount').value) || 0;
    const isUnionMember = document.getElementById('unionMember').checked;

    // 扣繳稅額：達 20,010 元，扣 10%
    let taxAmount = 0;
    if (totalAmount >= 20010) {
        taxAmount = Math.round(totalAmount * 0.1);
    }

    // 二代健保補充保費：達 20,000 元，扣 2.11%（工會會員免扣）
    let healthInsurance = 0;
    if (totalAmount >= 20000 && !isUnionMember) {
        healthInsurance = Math.round(totalAmount * 0.0211);
    }

    // 實領金額
    const netAmount = totalAmount - taxAmount - healthInsurance;

    // 更新顯示
    document.getElementById('taxAmountDisplay').textContent = taxAmount.toLocaleString();
    document.getElementById('healthInsuranceDisplay').textContent = healthInsurance.toLocaleString();
    document.getElementById('netAmountDisplay').textContent = netAmount.toLocaleString();

    // 更新隱藏欄位
    document.getElementById('taxAmount').value = taxAmount;
    document.getElementById('healthInsurance').value = healthInsurance;
    document.getElementById('netAmount').value = netAmount;
}

// ==================== 身分證圖片上傳 ====================
function initImageUpload() {
    setupUploadArea('idFrontArea', 'idFront', 'idFrontPreview', 'idFrontPlaceholder');
    setupUploadArea('idBackArea', 'idBack', 'idBackPreview', 'idBackPlaceholder');
}

function setupUploadArea(areaId, inputId, previewId, placeholderId) {
    const area = document.getElementById(areaId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const placeholder = document.getElementById(placeholderId);

    area.addEventListener('click', () => input.click());

    input.addEventListener('change', (e) => {
        handleFileSelect(e.target.files[0], preview, placeholder, area);
    });

    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.style.borderColor = '#6366f1';
        area.style.background = '#f5f3ff';
    });

    area.addEventListener('dragleave', () => {
        area.style.borderColor = '';
        area.style.background = '';
    });

    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.style.borderColor = '';
        area.style.background = '';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFileSelect(file, preview, placeholder, area);
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
        }
    });
}

function handleFileSelect(file, preview, placeholder, area) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        area.classList.add('has-image');
    };
    reader.readAsDataURL(file);
}

// ==================== 簽名功能 ====================
let signatureCanvas, signatureCtx;
let isDrawing = false;
let lastX = 0, lastY = 0;

function initSignature() {
    signatureCanvas = document.getElementById('signatureCanvas');
    signatureCtx = signatureCanvas.getContext('2d');

    // Modal 控制
    const modal = document.getElementById('signatureModal');
    const clearBtn = document.getElementById('clearSignature');
    const cancelBtn = document.getElementById('cancelSignature');
    const confirmBtn = document.getElementById('confirmSignature');

    // 當 Modal 顯示時初始化 Canvas
    const observer = new MutationObserver(() => {
        if (!modal.classList.contains('hidden')) {
            setTimeout(resizeCanvas, 100);
        }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });

    clearBtn.addEventListener('click', clearSignature);
    cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    confirmBtn.addEventListener('click', confirmSignature);

    // 滑鼠事件
    signatureCanvas.addEventListener('mousedown', startDrawing);
    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', stopDrawing);
    signatureCanvas.addEventListener('mouseout', stopDrawing);

    // 觸控事件
    signatureCanvas.addEventListener('touchstart', handleTouchStart);
    signatureCanvas.addEventListener('touchmove', handleTouchMove);
    signatureCanvas.addEventListener('touchend', stopDrawing);
}

function resizeCanvas() {
    const rect = signatureCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    signatureCanvas.width = rect.width * dpr;
    signatureCanvas.height = rect.height * dpr;

    signatureCtx.scale(dpr, dpr);
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';
    signatureCtx.lineWidth = 2;
    signatureCtx.strokeStyle = '#000';
}

function getCanvasCoords(e) {
    const rect = signatureCanvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function startDrawing(e) {
    isDrawing = true;
    const coords = getCanvasCoords(e);
    lastX = coords.x;
    lastY = coords.y;
}

function draw(e) {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    signatureCtx.beginPath();
    signatureCtx.moveTo(lastX, lastY);
    signatureCtx.lineTo(coords.x, coords.y);
    signatureCtx.stroke();
    lastX = coords.x;
    lastY = coords.y;
}

function stopDrawing() {
    isDrawing = false;
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = signatureCanvas.getBoundingClientRect();
    isDrawing = true;
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
}

function handleTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = signatureCanvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    signatureCtx.beginPath();
    signatureCtx.moveTo(lastX, lastY);
    signatureCtx.lineTo(x, y);
    signatureCtx.stroke();
    lastX = x;
    lastY = y;
}

function clearSignature() {
    const rect = signatureCanvas.getBoundingClientRect();
    signatureCtx.clearRect(0, 0, rect.width, rect.height);
}

function confirmSignature() {
    const dataUrl = signatureCanvas.toDataURL('image/png');
    const preview = document.getElementById('signaturePreview');
    const placeholder = document.getElementById('signaturePlaceholder');

    preview.src = dataUrl;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');

    document.getElementById('signatureModal').classList.add('hidden');
}

function getSignatureDataUrl() {
    const preview = document.getElementById('signaturePreview');
    return preview.src || '';
}

function isSignatureEmpty() {
    const preview = document.getElementById('signaturePreview');
    return preview.style.display === 'none' || !preview.src;
}

// ==================== PDF 生成功能 ====================
let chineseFontLoaded = false;

function initPdfGeneration() {
    document.getElementById('downloadPdf').addEventListener('click', generatePdf);
    // 預先載入中文字型
    loadChineseFont();
}

function loadChineseFont() {
    if (chineseFontLoaded) return;

    // 使用本地自託管字型
    if (window.pdfMakeFonts && window.pdfMakeFonts.pdfMake && window.pdfMakeFonts.pdfMake.vfs) {
        pdfMake.vfs = window.pdfMakeFonts.pdfMake.vfs;

        pdfMake.fonts = {
            NotoSansTC: {
                normal: 'NotoSans.ttf',
                bold: 'NotoSans.ttf',
                italics: 'NotoSans.ttf',
                bolditalics: 'NotoSans.ttf'
            }
        };

        chineseFontLoaded = true;
        console.log('中文字型載入完成 (本地字型)');
    } else {
        console.error('本地字型檔未找到，請確認 vfs_fonts.js 已正確載入');
    }
}


function generatePdf() {
    const btn = document.getElementById('downloadPdf');
    btn.disabled = true;
    btn.innerHTML = '<svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 產生中...';

    try {
        // 確保字型已載入
        if (!chineseFontLoaded) {
            loadChineseFont();
        }

        const docDefinition = generatePdfDocDefinition();
        const payeeName = document.getElementById('payeeName').value || '勞報單';
        const projectName = document.getElementById('projectName').value || '';
        const fileName = `${payeeName}_${projectName}_勞報單.pdf`;

        pdfMake.createPdf(docDefinition).download(fileName);

    } catch (error) {
        console.error('PDF 生成失敗:', error);
        alert('PDF 生成失敗，請稍後再試');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '下載勞務報酬單 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>';
    }
}

function generatePdfDocDefinition() {
    const formDate = document.getElementById('formDate').value;
    const companyName = document.getElementById('companyName').value;
    const companyContact = document.getElementById('companyContact').value;
    const payeeName = document.getElementById('payeeName').value;
    const idNumber = document.getElementById('idNumber').value;
    const payeeContact = document.getElementById('payeeContact').value;
    const address = document.getElementById('address').value;
    const nationality = document.getElementById('nationality').value;
    const serviceContent = document.getElementById('serviceContent').value;
    const incomeCategory = document.getElementById('incomeCategory').value;
    const totalAmount = parseFloat(document.getElementById('totalAmount').value) || 0;
    const taxAmount = parseFloat(document.getElementById('taxAmount').value) || 0;
    const healthInsurance = parseFloat(document.getElementById('healthInsurance').value) || 0;
    const netAmount = parseFloat(document.getElementById('netAmount').value) || 0;
    const bankName = document.getElementById('bankName').value;
    const branchName = document.getElementById('branchName').value;
    const accountName = document.getElementById('accountName').value;
    const accountNumber = document.getElementById('accountNumber').value;
    const unionMember = document.getElementById('unionMember').checked;

    const idFrontPreview = document.getElementById('idFrontPreview');
    const idBackPreview = document.getElementById('idBackPreview');
    const signaturePreview = document.getElementById('signaturePreview');

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat('zh-TW').format(num || 0);
    };

    // 虛線框樣式
    const dashedBox = {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineStyle: () => ({ dash: { length: 3, space: 3 } }),
        vLineStyle: () => ({ dash: { length: 3, space: 3 } })
    };

    // 實線框樣式
    const solidBorder = {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => '#000',
        vLineColor: () => '#000'
    };

    // 取得身分證圖片 (檢查 src 是否為 data URL 或 style.display)
    const hasIdFront = idFrontPreview.src && idFrontPreview.src.startsWith('data:');
    const hasIdBack = idBackPreview.src && idBackPreview.src.startsWith('data:');
    const hasSignature = signaturePreview.src && signaturePreview.src.startsWith('data:');

    // 身分證正面內容
    const idFrontContent = hasIdFront
        ? { image: idFrontPreview.src, width: 220, height: 140, alignment: 'center' }
        : { text: '', margin: [0, 60, 0, 60] };

    // 身分證反面內容
    const idBackContent = hasIdBack
        ? { image: idBackPreview.src, width: 220, height: 140, alignment: 'center' }
        : { text: '', margin: [0, 60, 0, 60] };

    // 簽名內容
    const signatureContent = hasSignature
        ? { image: signaturePreview.src, width: 280, height: 100, alignment: 'center' }
        : { text: '', margin: [0, 50, 0, 50] };

    const content = [
        // 標題
        {
            text: '勞務報酬單',
            style: 'header',
            alignment: 'center',
            margin: [0, 0, 0, 15],
            decoration: 'underline'
        },

        // 公司資訊列
        {
            table: {
                widths: ['*', '*', 'auto'],
                body: [
                    [
                        { text: `公司名稱：${companyName || ''}`, style: 'cellText' },
                        { text: `公司聯絡方式：${companyContact || ''}`, style: 'cellText' },
                        { text: `製表日期：${formatDate(formDate)}`, style: 'cellText' }
                    ]
                ]
            },
            layout: solidBorder
        },

        // 領款人基本資料區塊
        {
            table: {
                widths: [24, 60, '*', 60, '*'],
                body: [
                    [
                        { text: '領\n款\n人\n基\n本\n資\n料', style: 'verticalLabel', rowSpan: 4, alignment: 'center' },
                        { text: '姓名', style: 'labelCell' },
                        { text: payeeName || '', style: 'valueCell'},
                        { text: '國籍', style: 'labelCell' },
                        { text: nationality || '', style: 'valueCell' },
                    ],
                    [
                        {},
                        { text: '身分證字號', style: 'labelCell', fontSize: 8 },
                        { text: idNumber || '', style: 'valueCell' },
                        { text: '聯絡方式', style: 'labelCell' },
                        { text: payeeContact || '', style: 'valueCell' }
                    ],
                    [
                        {},
                        { text: '戶籍地址', style: 'labelCell' },
                        { text: address || '', style: 'valueCell', colSpan: 3 },
                        {}, {}
                    ],          
                    [
                        {},
                        { text: '勞務內容', style: 'labelCell' },
                        { text: serviceContent || '', style: 'valueCell', colSpan: 3 },
                        {}, {}
                    ]
                ]
            },
            layout: solidBorder
        },

        // 所得類別
        {
            table: {
                widths: [24, 60, '*'],
                body: [
                    [
                        { text: '', style: 'verticalLabel' },
                        { text: '所得類別', style: 'labelCell' },
                        { text: incomeCategory || '', style: 'valueCell' }
                    ]
                ]
            },
            layout: solidBorder
        },

        // 金額區塊
        {
            table: {
                widths: [24, '*', 'auto'],
                body: [
                    [
                        { text: '金\n額', style: 'verticalLabel', rowSpan: 4, alignment: 'center' },
                        { text: `應付總額： ${formatNumber(totalAmount)} 元`, style: 'amountText', colSpan: 2 },
                        {}
                    ],
                    [
                        {},
                        { text: `－ 代扣繳所得稅： ${taxAmount > 0 ? formatNumber(taxAmount) : 'N/A'} 元`, style: 'amountText', colSpan: 2 },
                        {}
                    ],
                    [
                        {},
                        { text: `－ 二代健保補充保費： (達 20,000 元, 代扣繳 2.11%) : ${formatNumber(healthInsurance)} 元`, style: 'amountText' },
                        { text: unionMember ? '[V] 領款人有投保工會' : '[  ] 領款人有投保工會', style: 'checkboxText', alignment: 'right' }
                    ],
                    [
                        {},
                        { text: `＝ 應付淨額： ${formatNumber(netAmount)} 元`, style: 'amountTextBold', colSpan: 2 },
                        {}
                    ]
                ]
            },
            layout: solidBorder
        },

        // 領款人身分證件區塊
        {
            table: {
                widths: [24, '*', '*'],
                body: [
                    [
                        { text: '領\n款\n人\n身\n分\n證\n件', style: 'verticalLabel', rowSpan: 2, alignment: 'center' },
                        { text: '正面', style: 'labelCell', alignment: 'center' },
                        { text: '反面', style: 'labelCell', alignment: 'center' }
                    ],
                    [
                        {},
                        {
                            table: {
                                widths: ['*'],
                                heights: [140],
                                body: [[idFrontContent]]
                            },
                            layout: dashedBox
                        },
                        {
                            table: {
                                widths: ['*'],
                                heights: [140],
                                body: [[idBackContent]]
                            },
                            layout: dashedBox
                        }
                    ]
                ]
            },
            layout: solidBorder
        },

        // 付款方式區塊
        {
            table: {
                widths: [24, 60, '*'],
                body: [
                    [
                        { text: '', style: 'verticalLabel' },
                        { text: '付款方式', style: 'labelCell' },
                        {
                            text: [
                                { text: '透過銀行轉帳/匯款，領款人帳戶資訊\n', bold: true },
                                `銀行：${bankName || ''}　分行：${branchName || ''}\n`,
                                `戶名：${accountName || ''}　帳號：${accountNumber || ''}\n`
                            ],
                            style: 'valueCell',
                            lineHeight: 1.4
                        }
                    ]
                ]
            },
            layout: solidBorder
        },

        // 簽名區塊 (設定 unbreakable 避免被分頁切斷)
        {
            unbreakable: true,
            stack: [
                {
                    table: {
                        widths: [24, '*'],
                        body: [
                            [
                                { text: '簽\n名', style: 'verticalLabel', rowSpan: 2, alignment: 'center' },
                                { text: '領款人', style: 'labelCell', alignment: 'center' }
                            ],
                            [
                                {},
                                {
                                    table: {
                                        widths: ['*'],
                                        heights: [100],
                                        body: [[signatureContent]]
                                    },
                                    layout: dashedBox,
                                    alignment: 'center'
                                }
                            ]
                        ]
                    },
                    layout: solidBorder
                }
            ]
        }
    ];

    return {
        content: content,
        defaultStyle: {
            font: 'NotoSansTC',
            fontSize: 10
        },
        styles: {
            header: {
                fontSize: 18,
                bold: true
            },
            verticalLabel: {
                fontSize: 10,
                bold: false,
                alignment: 'center',
                margin: [0, 5, 0, 5]
            },
            labelCell: {
                fontSize: 10,
                fillColor: '#f5f5f5',
                margin: [5, 5, 5, 5]
            },
            valueCell: {
                fontSize: 10,
                margin: [5, 5, 5, 5]
            },
            cellText: {
                fontSize: 10,
                margin: [5, 5, 5, 5]
            },
            amountText: {
                fontSize: 10,
                margin: [5, 5, 5, 5]
            },
            amountTextBold: {
                fontSize: 10,
                bold: true,
                margin: [5, 5, 5, 5]
            },
            checkboxText: {
                fontSize: 9,
                margin: [5, 5, 5, 5]
            }
        },
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 40]
    };
}
