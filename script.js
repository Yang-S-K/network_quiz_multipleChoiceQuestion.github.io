// 多選題與單選題支援版（單選自動送出，多選有提交按鈕）
let wordBank = [];
let score = 0;
let totalQuestions = 0;
let totalTimer = 0;
let totalTimerInterval = null;
let currentAnswers = [];
let questionLimit = Infinity;
let records = [];

async function loadWordBank() {
  try {
    const selected = JSON.parse(localStorage.getItem("selectedQuizzes")) || ["mid.json"];
    const allData = [];

    for (const file of selected) {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`載入 ${file} 失敗`);
      const data = await response.json();
      if (Array.isArray(data)) allData.push(...data);
    }

    wordBank = allData.map(item => ({ ...item, seen: false }));
    if (wordBank.length === 0) {
      alert("題庫為空，請確認選取的檔案內容！");
    }

    resetQuizState();
  } catch (error) {
    alert("載入題庫失敗，請確認檔案是否存在且格式正確！");
  }
}

document.getElementById("upload-database").addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const uploadedData = JSON.parse(reader.result);
        if (Array.isArray(uploadedData) && uploadedData.every(item => "question" in item && "options" in item && "answer" in item)) {
          wordBank = uploadedData.map(item => ({ ...item, seen: false }));
          alert("題庫上傳成功！");
        } else {
          alert("上傳的檔案格式不正確！");
        }
      } catch (error) {
        alert("無法解析上傳的檔案，請確保格式正確！");
      }
    };
    reader.readAsText(file);
  } else {
    alert("未選擇檔案，將載入預設題庫。");
    loadWordBank();
  }
});

document.getElementById("start-quiz").addEventListener("click", () => {
  const questionInput = document.getElementById("question-limit");
  const inputLimit = questionInput.value ? parseInt(questionInput.value, 10) : wordBank.length;
  if (isNaN(inputLimit) || inputLimit <= 0 || inputLimit > wordBank.length) {
    alert(`請輸入有效的題數（最多 ${wordBank.length} 題）！`);
    return;
  }
  questionLimit = inputLimit;
  showPage("quiz");
  startQuiz();
});

document.getElementById("back-to-home").addEventListener("click", () => {
  resetQuizState();
  showPage("home");
});

document.addEventListener("DOMContentLoaded", () => {
  loadWordBank();
  document.getElementById("view-records-home").addEventListener("click", () => {
    showPage("record");
    renderRecords();
  });
  document.getElementById("view-words-home").addEventListener("click", () => {
    showPage("word-bank");
    renderWordBank(1);
  });
  document.getElementById("back-to-home-from-word-bank")?.addEventListener("click", () => showPage("home"));
  document.getElementById("back-to-home-from-record")?.addEventListener("click", () => showPage("home"));
});

function showPage(page) {
  document.getElementById("home-page").style.display = page === "home" ? "block" : "none";
  document.getElementById("quiz-page").style.display = page === "quiz" ? "block" : "none";
  document.getElementById("record-page").style.display = page === "record" ? "block" : "none";
  document.getElementById("word-bank-page").style.display = page === "word-bank" ? "block" : "none";
  if (page === "quiz") startTotalTimer();
  else stopTotalTimer();
}

function startTotalTimer() {
  totalTimer = 0;
  document.getElementById("total-timer").innerText = `總計時: 0 秒`;
  totalTimerInterval = setInterval(() => {
    totalTimer++;
    document.getElementById("total-timer").innerText = `總計時: ${totalTimer} 秒`;
  }, 1000);
}

function stopTotalTimer() {
  clearInterval(totalTimerInterval);
  totalTimerInterval = null;
}

function startQuiz() {
  const content = document.getElementById("content");
  content.innerHTML = "";

  const remaining = wordBank.filter(q => !q.seen);
  if (remaining.length === 0 || totalQuestions >= questionLimit) {
    showQuizEnd(content);
    return;
  }

  const selected = remaining[Math.floor(Math.random() * remaining.length)];

  const shuffledOptions = selected.options.map((opt, idx) => ({ text: opt, index: idx }));
  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
  }
  selected.shuffledOptions = shuffledOptions;
  selected.shuffledAnswer = Array.isArray(selected.answer)
    ? selected.answer.map(idx => shuffledOptions.findIndex(opt => opt.index === idx)).sort()
    : [shuffledOptions.findIndex(opt => opt.index === selected.answer)];

  const isMultiple = Array.isArray(selected.answer);
  const typeLabel = document.createElement("h3");
  const total = questionLimit === Infinity ? wordBank.length : questionLimit;
  typeLabel.innerText = `${totalQuestions + 1} / ${total} ${isMultiple ? "（多選題）" : "（單選題）"}`;


  const question = document.createElement("h2");
  question.innerText = selected.question;

  const optionsContainer = document.createElement("div");
  optionsContainer.id = "options-container";

  shuffledOptions.forEach((opt, idx) => {
    const label = document.createElement("label");
    label.style.display = "block";

    if (isMultiple) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = idx;
      label.appendChild(checkbox);
    } else {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.innerText = opt.text;
      btn.addEventListener("click", () => handleSingleChoice(selected, idx));
      optionsContainer.appendChild(btn);
      return; // skip rest for single
    }

    label.appendChild(document.createTextNode(" " + opt.text));
    optionsContainer.appendChild(label);
  });

  content.appendChild(typeLabel);
  content.appendChild(question);
  content.appendChild(optionsContainer);

  if (isMultiple) {
    const submitBtn = document.createElement("button");
    submitBtn.innerText = "提交答案";
    submitBtn.addEventListener("click", () => handleMultiChoice(selected));
    content.appendChild(submitBtn);
  }

  updateScoreboard();
}

function handleSingleChoice(item, userAnswerIndex) {
  const result = document.createElement("div");
  result.id = "result";

  const correctAnswer = item.shuffledOptions[item.shuffledAnswer[0]].text;
  const userAnswer = item.shuffledOptions[userAnswerIndex].text;
  const isCorrect = item.shuffledAnswer[0] === userAnswerIndex;

  result.innerText = isCorrect ? "✅ 正確！" : `❌ 錯誤！正確答案是: ${correctAnswer}`;

  currentAnswers.push({
    question: item.question,
    userAnswer,
    correctAnswer,
    isCorrect
  });

  if (isCorrect) score++;
  totalQuestions++;
  item.seen = true;

  updateScoreboard();
  document.getElementById("content").appendChild(result);
  setTimeout(startQuiz, 1000);
}

function handleMultiChoice(item) {
  const checkboxes = document.querySelectorAll("#options-container input[type=checkbox]");
  const selectedIndices = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => parseInt(cb.value))
    .sort();

  const correctIndices = item.shuffledAnswer;
  const isCorrect = JSON.stringify(selectedIndices) === JSON.stringify(correctIndices);
  const correctAnswersText = correctIndices.map(i => item.shuffledOptions[i].text).join(", ");
  const userAnswersText = selectedIndices.map(i => item.shuffledOptions[i].text).join(", ");

  const result = document.createElement("div");
  result.id = "result";
  result.innerText = isCorrect ? "✅ 正確！" : `❌ 錯誤！正確答案是: ${correctAnswersText}`;

  currentAnswers.push({
    question: item.question,
    userAnswer: userAnswersText,
    correctAnswer: correctAnswersText,
    isCorrect
  });

  if (isCorrect) score++;
  totalQuestions++;
  item.seen = true;

  document.getElementById("content").appendChild(result);
  setTimeout(startQuiz, 1500);
}

function updateScoreboard(scoreboardElement = document.getElementById("scoreboard")) {
  const total = questionLimit === Infinity ? wordBank.length : questionLimit;

  if (scoreboardElement) {
    scoreboardElement.innerText = `${totalQuestions} / ${total}`;
  }

  const progressBar = document.getElementById("progress-bar");
  if (progressBar) {
    const percent = Math.min((totalQuestions / total) * 100, 100);
    progressBar.style.width = `${percent}%`;
  }
}


function resetQuizState() {
  wordBank.forEach(q => q.seen = false);
  score = 0;
  totalQuestions = 0;
  currentAnswers = [];
  stopTotalTimer();
}

function showQuizEnd(content) {
  stopTotalTimer();
  records.push({
    score,
    totalQuestions,
    totalTime: totalTimer,
    answers: currentAnswers.slice()
  });
  content.innerHTML = `
    <h2>測驗結束！</h2>
    <p>得分: ${score} / ${totalQuestions}</p>
    <p>總計時: ${totalTimer} 秒</p>
    <button id="restart-quiz">重新測驗</button>
  `;
  document.getElementById("restart-quiz").addEventListener("click", resetQuiz);
}

function resetQuiz() {
  resetQuizState();
  showPage("quiz");
  startQuiz();
}

function renderRecords(page = 1) {
  const content = document.getElementById("record-content");
  content.innerHTML = "<h2>測驗紀錄</h2><div id='record-list'></div><div id='record-pagination'></div>";

  const recordsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(records.length / recordsPerPage));
  if (page > totalPages) page = totalPages;
  const start = (page - 1) * recordsPerPage;
  const end = start + recordsPerPage;
  const currentRecords = records.slice(start, end);

  const list = document.getElementById("record-list");
  list.innerHTML = "";

  currentRecords.forEach((record, index) => {
    const div = document.createElement("div");
    div.innerHTML = `<p><strong>#${start + index + 1}</strong> 得分: ${record.score}/${record.totalQuestions}，時間: ${record.totalTime} 秒</p>
      <button onclick="showRecordDetail(${start + index})">查看詳情</button>`;
    list.appendChild(div);
  });

  const pagination = document.getElementById("record-pagination");
  pagination.innerHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.innerText = i;
    if (i === page) btn.className = "current-page";
    btn.addEventListener("click", () => renderRecords(i));
    pagination.appendChild(btn);
  }
}

function showRecordDetail(index, page = 1) {
  const record = records[index];
  const content = document.getElementById("record-content");
  content.innerHTML = `<h2>詳情 #${index + 1}</h2><button onclick="renderRecords()">返回紀錄列表</button><div id="record-detail-list"></div><div id="record-detail-pagination"></div>`;

  const answersPerPage = 3;
  const totalPages = Math.max(1, Math.ceil(record.answers.length / answersPerPage));
  if (page > totalPages) page = totalPages;
  const start = (page - 1) * answersPerPage;
  const end = start + answersPerPage;
  const currentAnswers = record.answers.slice(start, end);

  const detailList = document.getElementById("record-detail-list");
  detailList.innerHTML = "";

  currentAnswers.forEach((ans, i) => {
    const item = document.createElement("div");
    item.innerHTML = `<p>第 ${start + i + 1} 題：${ans.question}<br>你的答案：${ans.userAnswer}<br>正確答案：${ans.correctAnswer}<br>${ans.isCorrect ? "✅" : "❌"}</p>`;
    detailList.appendChild(item);
  });

  const pagination = document.getElementById("record-detail-pagination");
  pagination.innerHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.innerText = i;
    if (i === page) btn.className = "current-page";
    btn.addEventListener("click", () => showRecordDetail(index, i));
    pagination.appendChild(btn);
  }
}


function renderWordBank(page = 1) {
  const content = document.getElementById("word-bank-content");
  content.innerHTML = `
    <h2>題庫內容</h2>
    <input type="text" id="search-input" placeholder="搜尋關鍵字…" />
    <div id="word-list"></div>
    <div id="word-pagination"></div>
  `;

  const input = document.getElementById("search-input");
  input.addEventListener("input", () => renderWordBank(1)); // 即時更新

  const searchTerm = input.value.trim().toLowerCase();

  // ✅ 根據搜尋詞過濾題庫
  const filtered = wordBank.filter(q =>
    q.question.toLowerCase().includes(searchTerm) ||
    q.options.some(opt => opt.toLowerCase().includes(searchTerm))
  );

  const questionsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(filtered.length / questionsPerPage));
  if (page > totalPages) page = totalPages;
  const start = (page - 1) * questionsPerPage;
  const end = start + questionsPerPage;
  const currentQuestions = filtered.slice(start, end);

  const list = document.getElementById("word-list");
  list.innerHTML = "";

  currentQuestions.forEach((item, index) => {
    const correctText = Array.isArray(item.answer)
      ? item.answer.map(i => item.options[i]).join(", ")
      : item.options[item.answer];
    const div = document.createElement("div");
    div.innerHTML = `<p><strong>#${start + index + 1}</strong><br>${item.question}<br>選項：${item.options.join("，")}<br>正解：${correctText}</p>`;
    list.appendChild(div);
  });

  const pagination = document.getElementById("word-pagination");
  pagination.innerHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.innerText = i;
    if (i === page) btn.className = "current-page";
    btn.addEventListener("click", () => renderWordBank(i));
    pagination.appendChild(btn);
  }
}

