import { FOOD_DATA } from './nutrition-data.js';

const fileInput = document.getElementById('image-input');
const dropZone = document.getElementById('drop-zone');
const previewImage = document.getElementById('preview-image');
const statusEl = document.getElementById('status');
const predictionsContainer = document.getElementById('predictions');
const manualSelect = document.getElementById('manual-select');
const nutritionCard = document.getElementById('nutrition');
const foodNameEl = document.getElementById('food-name');
const foodServingEl = document.getElementById('food-serving');
const confidenceEl = document.getElementById('confidence');
const portionInput = document.getElementById('portion-input');
const caloriesCell = document.getElementById('calories-cell');
const proteinCell = document.getElementById('protein-cell');
const fatCell = document.getElementById('fat-cell');
const carbsCell = document.getElementById('carbs-cell');

let mobilenetModelPromise = null;
let currentFood = null;

function populateManualSelect() {
  const sorted = [...FOOD_DATA].sort((a, b) => a.nameZh.localeCompare(b.nameZh));
  for (const item of sorted) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.nameZh} (${item.nameEn})`;
    manualSelect.append(option);
  }
}

populateManualSelect();

async function loadModel() {
  if (!mobilenetModelPromise) {
    statusEl.textContent = '載入模型中…';
    mobilenetModelPromise = window.mobilenet
      .load({ version: 2, alpha: 1.0 })
      .catch((error) => {
        console.error('載入模型失敗', error);
        statusEl.textContent = '無法載入模型，請重新整理頁面。';
        throw error;
      });
  }
  return mobilenetModelPromise;
}

function resetResults() {
  predictionsContainer.innerHTML = '';
  nutritionCard.hidden = true;
  confidenceEl.textContent = '';
  currentFood = null;
}

function formatNumber(value) {
  return value.toFixed(1).replace(/\.0$/, '.0');
}

function createPredictionElement(prediction, isMatch) {
  const item = document.createElement('div');
  item.className = 'prediction-item';
  const probability = (prediction.probability * 100).toFixed(1);
  item.innerHTML = `
    <strong>${prediction.className}</strong>
    <span>${probability}%${isMatch ? ' · 選用' : ''}</span>
  `;
  return item;
}

function matchFood(predictions) {
  for (const prediction of predictions) {
    const normalized = prediction.className.toLowerCase();
    const match = FOOD_DATA.find((item) =>
      item.synonyms.some((synonym) => normalized.includes(synonym))
    );
    if (match) {
      return { match, prediction };
    }
  }
  return null;
}

function updateNutritionTable(food, grams) {
  const ratio = grams / 100;
  const calories = food.per100g.calories * ratio;
  const protein = food.per100g.protein * ratio;
  const fat = food.per100g.fat * ratio;
  const carbs = food.per100g.carbs * ratio;

  caloriesCell.textContent = `${formatNumber(calories)} kcal`;
  proteinCell.textContent = `${formatNumber(protein)} g`;
  fatCell.textContent = `${formatNumber(fat)} g`;
  carbsCell.textContent = `${formatNumber(carbs)} g`;
}

function displayNutrition(food, prediction) {
  currentFood = food;
  const defaultGrams = food.defaultServing?.grams ?? 100;

  foodNameEl.textContent = `${food.nameZh} (${food.nameEn})`;
  foodServingEl.textContent = food.defaultServing?.label
    ? `建議份量：${food.defaultServing.label}`
    : '建議份量：100g';

  if (prediction) {
    const probability = (prediction.probability * 100).toFixed(1);
    confidenceEl.textContent = `模型信心：${probability}%`;
    confidenceEl.hidden = false;
  } else {
    confidenceEl.textContent = '';
    confidenceEl.hidden = true;
  }

  portionInput.value = defaultGrams;
  updateNutritionTable(food, defaultGrams);
  nutritionCard.hidden = false;
}

function handlePortionChange() {
  if (!currentFood) return;
  const grams = Number.parseFloat(portionInput.value);
  if (Number.isNaN(grams) || grams <= 0) {
    portionInput.setCustomValidity('請輸入大於 0 的數值');
    portionInput.reportValidity();
    return;
  }
  portionInput.setCustomValidity('');
  updateNutritionTable(currentFood, grams);
}

portionInput.addEventListener('input', handlePortionChange);

async function classifyImage(image) {
  try {
    statusEl.textContent = '辨識中…';
    const model = await loadModel();
    const predictions = await model.classify(image);

    resetResults();

    if (!predictions.length) {
      statusEl.textContent = '未取得辨識結果，請重新上傳。';
      return;
    }

    const bestMatch = matchFood(predictions);

    predictions.forEach((prediction) => {
      const isMatch = bestMatch && bestMatch.prediction === prediction;
      predictionsContainer.appendChild(createPredictionElement(prediction, isMatch));
    });

    if (bestMatch) {
      statusEl.textContent = `偵測到：${bestMatch.match.nameZh}`;
      manualSelect.value = bestMatch.match.id;
      displayNutrition(bestMatch.match, bestMatch.prediction);
    } else {
      statusEl.textContent = '未能匹配資料庫，請手動選擇食物。';
      nutritionCard.hidden = true;
      manualSelect.value = '';
    }
  } catch (error) {
    console.error(error);
    statusEl.textContent = '辨識發生錯誤，請稍後再試。';
  }
}

function loadPreview(file) {
  if (!file) {
    statusEl.textContent = '尚未上傳照片';
    previewImage.src = '';
    previewImage.classList.remove('visible');
    resetResults();
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  previewImage.onload = () => {
    previewImage.classList.add('visible');
    classifyImage(previewImage);
    URL.revokeObjectURL(objectUrl);
  };
  previewImage.onerror = () => {
    statusEl.textContent = '無法讀取圖片，請改用其他檔案。';
    previewImage.classList.remove('visible');
  };
  previewImage.src = objectUrl;
  statusEl.textContent = '圖片已載入，開始辨識…';
}

fileInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  loadPreview(file);
});

function handleDrop(event) {
  event.preventDefault();
  dropZone.classList.remove('dragover');
  const file = event.dataTransfer.files?.[0];
  if (file && file.type.startsWith('image/')) {
    fileInput.files = event.dataTransfer.files;
    loadPreview(file);
  } else {
    statusEl.textContent = '請拖曳圖片檔案';
  }
}

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', handleDrop);

manualSelect.addEventListener('change', (event) => {
  const id = event.target.value;
  if (!id) {
    nutritionCard.hidden = true;
    currentFood = null;
    return;
  }
  const food = FOOD_DATA.find((item) => item.id === id);
  if (food) {
    displayNutrition(food, null);
    statusEl.textContent = `手動選擇：${food.nameZh}`;
  }
});

dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    fileInput.click();
  }
});

// 無障礙：讓上傳區塊可使用鍵盤操作
dropZone.setAttribute('tabindex', '0');
dropZone.setAttribute('role', 'button');
dropZone.setAttribute('aria-label', '按 Enter 或空白即可選擇照片');
