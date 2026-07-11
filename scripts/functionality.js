const API_MODEL = "google/gemma-4-31B-it:cerebras";
const API_URL = "https://router.huggingface.co/v1/chat/completions";
const CAPTION_PROMPT = "Describe this image in one detailed sentence.";
const HF_TOKEN = "YOUR_API_TOKEN";

const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "with", "and", "is", "are",
  "to", "this", "that", "it", "its", "for", "by", "as", "was", "were",
  "be", "been", "near", "some", "there"
]);

function showError(message) {
  const errorBanner = document.getElementById("error-banner");
  errorBanner.textContent = message;
  errorBanner.hidden = false;
  clearTimeout(showError._t);
  showError._t = setTimeout(() => {
    errorBanner.hidden = true;
  }, 6000);
}

function collectStrings(node, path = "root", acc = []) {
  if (node === null || node === undefined) return acc;

  if (typeof node === "string") {
    acc.push({ path, value: node });
    return acc;
  }

  if (Array.isArray(node)) {
    node.forEach((child, i) => collectStrings(child, `${path}[${i}]`, acc));
    return acc;
  }

  if (typeof node === "object") {
    Object.keys(node).forEach((key) =>
      collectStrings(node[key], `${path}.${key}`, acc)
    );
    return acc;
  }

  return acc;
}

function pickCaption(strings) {

  const candidates = strings.filter(
    ({ path, value }) =>
      path.toLowerCase().includes("generated_text") ||
      value.trim().split(" ").length > 2
  );

  if (candidates.length === 0) {
    throw new Error("The API responded, but no caption text was found in it.");
  }

 
  const cleaned = candidates.map((c) => c.value.trim().replace(/\s+/g, " "));
  return cleaned[0];
}

function captionToTags(caption) {
  return caption
    .split(/\W+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase())) 
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) 
    .filter((w, i, arr) => arr.indexOf(w) === i); 
}

function validateFile(file) {
  if (!file) {
    throw new Error("No image was selected. Choose a file before continuing.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" isn't an image file.`);
  }
  const MAX_MB = 8;
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`That image is larger than ${MAX_MB}MB — try a smaller one.`);
  }
  const token = HF_TOKEN.trim();
  if (!token || token === "hf_PASTE_YOUR_TOKEN_HERE") {
    throw new Error("Add your Hugging Face API token in functionality.js first.");
  }
  return token;
}

function buildResultCard(imageURL) {
  const resultsEl = document.getElementById("results");

  const card = document.createElement("div");
  card.className = "result-card";

  const imgWrap = document.createElement("div");
  imgWrap.className = "result-image-wrap";
  const img = document.createElement("img");
  img.src = imageURL;
  img.alt = "Uploaded image";
  imgWrap.appendChild(img);

  const status = document.createElement("div");
  status.className = "status-line";
  const dot = document.createElement("span");
  dot.className = "status-dot";
  const statusText = document.createElement("span");
  statusText.className = "status-text";
  statusText.textContent = "contacting the model…";
  status.append(dot, statusText);

  const captionBlock = document.createElement("div");
  captionBlock.className = "caption-block";
  captionBlock.hidden = true;

  card.append(imgWrap, status, captionBlock);
  resultsEl.prepend(card);

  return { card, status, captionBlock };
}

function renderCaption(captionBlock, caption, tags, rawJSON) {
  captionBlock.hidden = false;
  captionBlock.innerHTML = "";

  const eyebrow = document.createElement("p");
  eyebrow.className = "caption-eyebrow";
  eyebrow.textContent = "Description";

  const text = document.createElement("p");
  text.className = "caption-text";
  text.textContent = caption;

  captionBlock.append(eyebrow, text);

  if (tags.length) {
    const tagRow = document.createElement("div");
    tagRow.className = "tag-row";
    tags.forEach((t) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = t;
      tagRow.appendChild(tag);
    });
    captionBlock.appendChild(tagRow);
  }

  const toggle = document.createElement("button");
  toggle.className = "raw-toggle";
  toggle.type = "button";
  toggle.textContent = "show raw API response";

  const raw = document.createElement("pre");
  raw.className = "raw-json";
  raw.hidden = true;
  raw.textContent = JSON.stringify(rawJSON, null, 2);

  toggle.addEventListener("click", () => {
    raw.hidden = !raw.hidden;
    toggle.textContent = raw.hidden ? "show raw API response" : "hide raw API response";
  });

  captionBlock.append(toggle, raw);
}


function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

async function handleFile(file) {
  let token;
  try {
    token = validateFile(file);
  } catch (err) {
    showError(err.message);
    return;
  }

  const iris = document.getElementById("iris");
  const fileInput = document.getElementById("file-input");

  const imageURL = URL.createObjectURL(file);
  const { status, captionBlock } = buildResultCard(imageURL);
  iris.classList.add("spinning");

  const messages = [
    "contacting the model…",
    "the model is looking closely…",
    "developing the description…"
  ];
  let step = 0;
  const messageTimer = setInterval(() => {
    step = (step + 1) % messages.length;
    status.querySelector(".status-text").textContent = messages[step];
  }, 1400);

  try {
    const imageDataURL = await fileToDataURL(file);

    const response = await axios.post(
      API_URL,
      {
        model: API_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: CAPTION_PROMPT },
              { type: "image_url", image_url: { url: imageDataURL } }
            ]
          }
        ],
        max_tokens: 150
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );


    if (response.data && response.data.error) {
      const msg = response.data.error.message || response.data.error;
      throw new Error(msg);
    }

    const allStrings = collectStrings(response.data); 
    const caption = pickCaption(allStrings); 
    const tags = captionToTags(caption); 

    clearInterval(messageTimer);
    status.className = "status-line done";
    status.querySelector(".status-text").textContent = "description ready";
    renderCaption(captionBlock, caption, tags, response.data);
  } catch (err) {
    clearInterval(messageTimer);
    status.className = "status-line error";
    status.querySelector(".status-text").textContent = "failed";
    const serverError = err.response && err.response.data && err.response.data.error;
    const serverMessage = serverError && (serverError.message || serverError);
    showError(serverMessage || err.message || "Something went wrong talking to the API.");
  } finally {
    iris.classList.remove("spinning");
    fileInput.value = "";
  }
}
