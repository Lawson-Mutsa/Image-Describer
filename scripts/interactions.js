/* =========================================================
   INTERACTIONS
   All event-listener wiring for the page lives here: clicks,
   keyboard activation, and drag & drop. When something needs
   to actually happen (an API call, DOM building, validation)
   this file hands off to the functions defined in functionality.js.
   ========================================================= */

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");

// ----- Click / keyboard to open the file picker -----
dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

// ----- Drag & drop visual state -----
["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);

["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);

// ----- Actual file intake: drop or manual selection -----
dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) handleFile(file); // handleFile lives in functionality.js
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) handleFile(file); // handleFile lives in functionality.js
});
