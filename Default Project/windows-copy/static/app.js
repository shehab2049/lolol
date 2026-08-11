const video = document.querySelector("#video");
const overlay = document.querySelector("#overlay");
const captureCanvas = document.querySelector("#captureCanvas");
const cameraButton = document.querySelector("#cameraButton");
const pauseButton = document.querySelector("#pauseButton");
const cameraEmpty = document.querySelector("#cameraEmpty");
const cameraStatus = document.querySelector("#cameraStatus");
const detectionText = document.querySelector("#detectionText");
const fpsText = document.querySelector("#fpsText");
const arabicText = document.querySelector("#arabicText");
const signGlyph = document.querySelector("#signGlyph");
const signName = document.querySelector("#signName");
const confidenceValue = document.querySelector("#confidenceValue");
const confidenceBar = document.querySelector("#confidenceBar");

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],
  [10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],
  [17,18],[18,19],[19,20]
];

let stream = null;
let running = false;
let requestInFlight = false;
let translated = "";
let candidate = null;
let candidateSince = 0;
let lastCommitted = null;
let lastCommitTime = 0;
let frameCount = 0;
let fpsStarted = performance.now();
let signSequence = [];
let signIndex = -1;
let signTimer = null;
let avatarPlaying = false;

const SIGN_TOKENS = {
  "ا": "aleff", "أ": "aleff", "إ": "aleff", "آ": "aleff", "ء": "aleff",
  "ب": "bb", "ت": "taa", "ث": "thaa", "ج": "jeem", "ح": "haa", "خ": "khaa",
  "د": "dal", "ذ": "thal", "ر": "ra", "ز": "zay", "س": "seen", "ش": "sheen",
  "ص": "saad", "ض": "dhad", "ط": "ta", "ظ": "dha", "ع": "ain", "غ": "ghain",
  "ف": "fa", "ق": "gaaf", "ك": "kaaf", "ل": "laam", "م": "meem", "ن": "nun",
  "ه": "ha", "ة": "toot", "و": "waw", "ي": "yaa", "ى": "ya", " ": "space",
  "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6",
  "7": "7", "8": "8", "9": "9", "10": "10", "٠": "0", "١": "1", "٢": "2",
  "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "١٠": "10",
};

const SUPPORTED_SIGNS = ["ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن","ه","ة","و","ي","ى","0","1","2","3","4","5","6","7","8","9","10"];

const ARABIC_SIGN_NAMES = {
  aleff:"ألف", bb:"باء", taa:"تاء", thaa:"ثاء", jeem:"جيم", haa:"حاء", khaa:"خاء",
  dal:"دال", thal:"ذال", ra:"راء", zay:"زاي", seen:"سين", sheen:"شين", saad:"صاد",
  dhad:"ضاد", ta:"طاء", dha:"ظاء", ain:"عين", ghain:"غين", fa:"فاء", gaaf:"قاف",
  kaaf:"كاف", laam:"لام", meem:"ميم", nun:"نون", ha:"هاء", toot:"تاء مربوطة",
  waw:"واو", yaa:"ياء", ya:"ألف مقصورة", space:"مسافة"
};


function setTranslated(value) {
  translated = value;
  arabicText.textContent = value || "ابدأ بالإشارة";
  arabicText.dataset.empty = value ? "false" : "true";
}

function drawLandmarks(points) {
  const rect = overlay.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  overlay.width = rect.width * scale;
  overlay.height = rect.height * scale;
  const context = overlay.getContext("2d");
  context.scale(scale, scale);
  context.strokeStyle = "#f3c84b";
  context.fillStyle = "#ffffff";
  context.lineWidth = 2;
  for (const [start, end] of HAND_CONNECTIONS) {
    context.beginPath();
    context.moveTo((1 - points[start].x) * rect.width, points[start].y * rect.height);
    context.lineTo((1 - points[end].x) * rect.width, points[end].y * rect.height);
    context.stroke();
  }
  for (const point of points) {
    context.beginPath();
    context.arc((1 - point.x) * rect.width, point.y * rect.height, 3.2, 0, Math.PI * 2);
    context.fill();
  }
}

function clearOverlay() {
  overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
}

function updatePrediction(prediction) {
  const confidence = prediction.confidence;
  signGlyph.textContent = prediction.arabic === " " ? "␠" : prediction.arabic;
  signName.textContent = ARABIC_SIGN_NAMES[prediction.label] || prediction.label;
  confidenceValue.textContent = `${Math.round(confidence * 100)}%`;
  confidenceBar.style.width = `${confidence * 100}%`;
  detectionText.textContent = confidence >= 0.65 ? "تم تثبيت الإشارة" : "ثبّت يدك قليلاً";

  const now = performance.now();
  if (confidence < 0.72) {
    candidate = null;
    return;
  }
  if (candidate !== prediction.label) {
    candidate = prediction.label;
    candidateSince = now;
    return;
  }
  const released = lastCommitted !== candidate || now - lastCommitTime > 2200;
  if (now - candidateSince > 650 && released) {
    setTranslated(translated + prediction.arabic);
    lastCommitted = candidate;
    lastCommitTime = now;
    candidateSince = now;
  }
}

async function analyzeFrame() {
  if (!running || requestInFlight || video.readyState < 2) return;
  requestInFlight = true;
  captureCanvas.width = 480;
  captureCanvas.height = Math.round(480 * video.videoHeight / video.videoWidth);
  captureCanvas.getContext("2d").drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
  const blob = await new Promise(resolve => captureCanvas.toBlob(resolve, "image/jpeg", 0.78));
  try {
    const response = await fetch("/api/predict", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Prediction failed");
    if (result.hand_detected) {
      drawLandmarks(result.landmarks);
      updatePrediction(result.prediction);
    } else {
      clearOverlay();
      detectionText.textContent = "لم يتم اكتشاف يد";
      candidate = null;
      signGlyph.textContent = "--";
      signName.textContent = "لم يتم اكتشاف إشارة";
      confidenceValue.textContent = "0%";
      confidenceBar.style.width = "0";
    }
    frameCount += 1;
    const elapsed = performance.now() - fpsStarted;
    if (elapsed > 1000) {
      fpsText.textContent = `${Math.round(frameCount * 1000 / elapsed)} إطار/ث`;
      frameCount = 0;
      fpsStarted = performance.now();
    }
  } catch (error) {
    detectionText.textContent = error.message;
  } finally {
    requestInFlight = false;
  }
}

function scheduleAnalysis() {
  if (!stream) return;
  analyzeFrame();
  window.setTimeout(scheduleAnalysis, 110);
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream;
    running = true;
    cameraEmpty.classList.add("hidden");
    cameraStatus.textContent = "مباشر";
    cameraStatus.classList.add("live");
    cameraButton.disabled = true;
    pauseButton.disabled = false;
    pauseButton.textContent = "إيقاف مؤقت";
    detectionText.textContent = "جارٍ البحث عن اليد";
    scheduleAnalysis();
  } catch (error) {
    detectionText.textContent = "تم رفض إذن الكاميرا";
    cameraEmpty.querySelector("strong").textContent = "يجب السماح باستخدام الكاميرا";
  }
}

cameraButton.addEventListener("click", startCamera);
pauseButton.addEventListener("click", () => {
  running = !running;
  pauseButton.textContent = running ? "إيقاف مؤقت" : "متابعة";
  cameraStatus.textContent = running ? "مباشر" : "متوقف";
  cameraStatus.classList.toggle("live", running);
  detectionText.textContent = running ? "جارٍ البحث عن اليد" : "التعرف متوقف مؤقتاً";
});
document.querySelector("#clearButton").addEventListener("click", () => setTranslated(""));
document.querySelector("#spaceButton").addEventListener("click", () => setTranslated(translated + " "));
document.querySelector("#deleteButton").addEventListener("click", () => setTranslated(Array.from(translated).slice(0, -1).join("")));
window.addEventListener("beforeunload", () => stream?.getTracks().forEach(track => track.stop()));

const phraseInput = document.querySelector("#phraseInput");
const phraseCount = document.querySelector("#phraseCount");
const sequenceStrip = document.querySelector("#sequenceStrip");
const avatar = document.querySelector("#avatar");
const avatarLetter = document.querySelector("#avatarLetter");
const avatarCaption = document.querySelector("#avatarCaption");
const avatarStatus = document.querySelector("#avatarStatus");
const avatarPlayButton = document.querySelector("#avatarPlayButton");
const sequenceProgress = document.querySelector("#sequenceProgress");

function updatePhraseCount() {
  phraseCount.textContent = `${Array.from(phraseInput.value).length} / 80`;
}

function tokenizeSigns(value) {
  const characters = Array.from(value);
  const tokens = [];
  for (let index = 0; index < characters.length;) {
    const pair = characters[index] + (characters[index + 1] || "");
    if (SIGN_TOKENS[pair]) {
      tokens.push({ display: pair, pose: SIGN_TOKENS[pair] });
      index += 2;
    } else if (SIGN_TOKENS[characters[index]]) {
      tokens.push({ display: characters[index], pose: SIGN_TOKENS[characters[index]] });
      index += 1;
    } else {
      index += 1;
    }
  }
  return tokens;
}

function applyHandShape(poseName) {
  document.querySelector("#signHandImage").src = `/static/assets/signs/${poseName}.png`;
}

function renderSequence() {
  window.clearTimeout(signTimer);
  avatarPlaying = false;
  avatarPlayButton.textContent = "تشغيل التسلسل";
  sequenceStrip.replaceChildren();
  signSequence = tokenizeSigns(phraseInput.value);
  signSequence.forEach((token, index) => {
    const item = document.createElement("span");
    item.className = "sequence-item";
    item.dataset.index = index;
    item.textContent = token.pose === "space" ? "·" : token.display;
    sequenceStrip.append(item);
  });
  signIndex = -1;
  avatarPlayButton.disabled = signSequence.length === 0;
  sequenceProgress.textContent = `0 / ${signSequence.length}`;
  avatarCaption.textContent = signSequence.length ? "جاهز لعرض الإشارات" : "اكتب حروفاً أو أرقاماً للبدء";
  avatarStatus.textContent = signSequence.length ? "جاهز" : "في الانتظار";
  avatar.className = "avatar";
  applyHandShape("space");
  avatarLetter.textContent = "—";
}

function showSign(index) {
  if (!signSequence.length) return;
  signIndex = index % signSequence.length;
  const token = signSequence[signIndex];
  document.querySelectorAll(".sequence-item").forEach(item => item.classList.toggle("active", Number(item.dataset.index) === signIndex));
  avatar.className = `avatar pose-${token.pose}`;
  applyHandShape(token.pose);
  avatarLetter.textContent = token.pose === "space" ? "␠" : token.display;
  avatarCaption.textContent = token.pose === "space" ? "مسافة" : `إشارة ${token.display}`;
  avatarStatus.textContent = "جارٍ العرض";
  sequenceProgress.textContent = `${signIndex + 1} / ${signSequence.length}`;
}

function playNextSign() {
  if (!avatarPlaying || !signSequence.length) return;
  showSign(signIndex + 1);
  signTimer = window.setTimeout(playNextSign, Number(document.querySelector("#avatarSpeed").value));
}

function toggleAvatar() {
  if (!signSequence.length) return;
  avatarPlaying = !avatarPlaying;
  avatarPlayButton.textContent = avatarPlaying ? "إيقاف مؤقت" : "تشغيل التسلسل";
  if (avatarPlaying) playNextSign(); else window.clearTimeout(signTimer);
  avatarStatus.textContent = avatarPlaying ? "جارٍ العرض" : "متوقف مؤقتاً";
}

phraseInput.addEventListener("input", () => { updatePhraseCount(); renderSequence(); });
document.querySelector("#signButton").addEventListener("click", () => {
  renderSequence();
  if (signSequence.length) { avatarPlaying = true; avatarPlayButton.textContent = "إيقاف مؤقت"; playNextSign(); }
});
avatarPlayButton.addEventListener("click", toggleAvatar);
document.querySelector("#reverseClearButton").addEventListener("click", () => {
  phraseInput.value = ""; updatePhraseCount(); renderSequence(); window.clearTimeout(signTimer); avatarPlaying = false; avatarPlayButton.textContent = "تشغيل التسلسل";
});

const supportedSigns = document.querySelector("#supportedSigns");
SUPPORTED_SIGNS.forEach(sign => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = sign;
  button.addEventListener("click", () => {
    phraseInput.value += sign;
    updatePhraseCount();
    renderSequence();
    phraseInput.focus();
  });
  supportedSigns.append(button);
});
