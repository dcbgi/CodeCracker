/**
 * CodeCracker – game logic
 *
 * Rules:
 *  - 7 colours available, 4-peg secret code (duplicates allowed)
 *  - Player has 5 attempts
 *  - Feedback per attempt:
 *      green dot  = correct colour AND correct position
 *      yellow dot = correct colour but wrong position
 */

const COLORS = [
  { id: 'red',    label: 'Red',    hex: '#e74c3c' },
  { id: 'blue',   label: 'Blue',   hex: '#3498db' },
  { id: 'green',  label: 'Green',  hex: '#2ecc71' },
  { id: 'yellow', label: 'Yellow', hex: '#f1c40f' },
  { id: 'orange', label: 'Orange', hex: '#e67e22' },
  { id: 'purple', label: 'Purple', hex: '#9b59b6' },
  { id: 'pink',   label: 'Pink',   hex: '#fd79a8' },
];

const MAX_ATTEMPTS = 5;
const CODE_LENGTH  = 4;

// ── State ────────────────────────────────────────────────────
let secretCode      = [];
let currentAttempt  = 0;   // 0-based row index
let currentSlot     = 0;   // 0-based column index within current row
let currentGuess    = [];  // array of colour ids (length ≤ CODE_LENGTH)
let selectedColor   = null;
let gameOver        = false;

// ── DOM refs ─────────────────────────────────────────────────
const board          = document.getElementById('board');
const palette        = document.getElementById('palette');
const btnSubmit      = document.getElementById('btn-submit');
const btnClear       = document.getElementById('btn-clear');
const btnNewGame     = document.getElementById('btn-new-game');
const messageEl      = document.getElementById('message');
const secretReveal   = document.getElementById('secret-reveal');
const secretPegsEl   = document.getElementById('secret-pegs');

// ── Helpers ──────────────────────────────────────────────────

/** Pick 4 random colours (duplicates allowed). */
function generateCode() {
  return Array.from({ length: CODE_LENGTH }, () =>
    COLORS[Math.floor(Math.random() * COLORS.length)].id
  );
}

/** Return hex string for a colour id, or fallback. */
function hexFor(id) {
  return (COLORS.find(c => c.id === id) || {}).hex || '#2a2a3e';
}

/**
 * Compute feedback for a guess vs the secret code.
 * Returns { correctPos, correctColor } where:
 *   correctPos   = pegs with right colour AND right position (green)
 *   correctColor = pegs with right colour in wrong position  (yellow)
 */
function computeFeedback(guess, secret) {
  let correctPos   = 0;
  let correctColor = 0;

  const remainingSecret = [];
  const remainingGuess  = [];

  // First pass – correct positions
  for (let i = 0; i < CODE_LENGTH; i++) {
    if (guess[i] === secret[i]) {
      correctPos++;
    } else {
      remainingSecret.push(secret[i]);
      remainingGuess.push(guess[i]);
    }
  }

  // Second pass – correct colours (wrong position)
  for (const color of remainingGuess) {
    const idx = remainingSecret.indexOf(color);
    if (idx !== -1) {
      correctColor++;
      remainingSecret.splice(idx, 1);
    }
  }

  return { correctPos, correctColor };
}

// ── Board rendering ──────────────────────────────────────────

/** Build the full board (5 rows × 4 pegs). */
function buildBoard() {
  board.innerHTML = '';
  for (let r = 0; r < MAX_ATTEMPTS; r++) {
    const row = document.createElement('div');
    row.className = 'attempt-row';
    row.id = `row-${r}`;

    const label = document.createElement('div');
    label.className = 'row-label';
    label.textContent = r + 1;

    const pegs = document.createElement('div');
    pegs.className = 'pegs';

    for (let c = 0; c < CODE_LENGTH; c++) {
      const peg = document.createElement('div');
      peg.className = 'peg';
      peg.id = `peg-${r}-${c}`;
      peg.setAttribute('aria-label', `Row ${r + 1}, slot ${c + 1}`);
      peg.addEventListener('click', () => handlePegClick(r, c));
      pegs.appendChild(peg);
    }

    const feedback = document.createElement('div');
    feedback.className = 'feedback';
    feedback.id = `feedback-${r}`;

    for (let f = 0; f < CODE_LENGTH; f++) {
      const fb = document.createElement('div');
      fb.className = 'fb-peg';
      fb.id = `fb-${r}-${f}`;
      feedback.appendChild(fb);
    }

    row.append(label, pegs, feedback);
    board.appendChild(row);
  }

  highlightActiveRow();
}

/** Build the colour-selection palette. */
function buildPalette() {
  palette.innerHTML = '';
  for (const color of COLORS) {
    const btn = document.createElement('button');
    btn.className = 'color-btn';
    btn.id = `color-${color.id}`;
    btn.style.background = color.hex;
    btn.setAttribute('aria-label', color.label);
    btn.title = color.label;
    btn.addEventListener('click', () => selectColor(color.id));
    palette.appendChild(btn);
  }
}

/** Highlight the current active slot with a golden border. */
function highlightActiveRow() {
  // Clear all active-slot styles
  document.querySelectorAll('.peg').forEach(p => p.classList.remove('active-slot'));

  if (gameOver) return;

  const peg = document.getElementById(`peg-${currentAttempt}-${currentSlot}`);
  if (peg) peg.classList.add('active-slot');
}

// ── User interactions ────────────────────────────────────────

/** Select a colour from the palette. */
function selectColor(colorId) {
  if (gameOver) return;

  // Deselect previous
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));

  selectedColor = colorId;
  const btn = document.getElementById(`color-${colorId}`);
  if (btn) btn.classList.add('selected');

  // Automatically fill the active slot
  placeColorInSlot(currentAttempt, currentSlot, colorId);
}

/** Place a colour in the specified slot and advance the active slot. */
function placeColorInSlot(row, col, colorId) {
  if (row !== currentAttempt || gameOver) return;

  currentGuess[col] = colorId;

  const peg = document.getElementById(`peg-${row}-${col}`);
  if (peg) {
    peg.style.background = hexFor(colorId);
    peg.classList.add('filled');
  }

  // Advance to next empty slot
  advanceSlot();
}

/** Click a peg in the current row to fill / change it. */
function handlePegClick(row, col) {
  if (row !== currentAttempt || gameOver) return;

  if (selectedColor) {
    currentGuess[col] = selectedColor;
    const peg = document.getElementById(`peg-${row}-${col}`);
    if (peg) {
      peg.style.background = hexFor(selectedColor);
      peg.classList.add('filled');
    }
    currentSlot = col;
    advanceSlot();
  }
}

/** Move active slot to the next empty one (or end). */
function advanceSlot() {
  // Find next empty slot
  let next = -1;
  for (let c = 0; c < CODE_LENGTH; c++) {
    if (!currentGuess[c]) {
      next = c;
      break;
    }
  }
  currentSlot = next === -1 ? CODE_LENGTH - 1 : next;
  highlightActiveRow();

  // Enable submit when all 4 slots are filled
  btnSubmit.disabled = currentGuess.filter(Boolean).length < CODE_LENGTH;
}

/** Clear the current row's guess. */
function clearCurrentRow() {
  if (gameOver) return;

  currentGuess = [];
  currentSlot  = 0;

  for (let c = 0; c < CODE_LENGTH; c++) {
    const peg = document.getElementById(`peg-${currentAttempt}-${c}`);
    if (peg) {
      peg.style.background = '';
      peg.classList.remove('filled');
    }
  }

  btnSubmit.disabled = true;
  highlightActiveRow();
}

/** Submit the current guess. */
function submitGuess() {
  if (currentGuess.filter(Boolean).length < CODE_LENGTH || gameOver) return;

  const guess    = [...currentGuess];
  const feedback = computeFeedback(guess, secretCode);

  renderFeedback(currentAttempt, feedback);

  const won = feedback.correctPos === CODE_LENGTH;

  if (won) {
    endGame(true);
    return;
  }

  currentAttempt++;
  currentGuess = [];
  currentSlot  = 0;
  btnSubmit.disabled = true;

  if (currentAttempt >= MAX_ATTEMPTS) {
    endGame(false);
  } else {
    highlightActiveRow();
    messageEl.className = '';
    messageEl.textContent = `Attempt ${currentAttempt + 1} of ${MAX_ATTEMPTS}`;
  }
}

/** Render the green/yellow feedback dots for a completed row. */
function renderFeedback(row, { correctPos, correctColor }) {
  // Fill green first, then yellow, then empty
  const dots = [
    ...Array(correctPos).fill('correct-pos'),
    ...Array(correctColor).fill('correct-color'),
    ...Array(CODE_LENGTH - correctPos - correctColor).fill(''),
  ];

  for (let f = 0; f < CODE_LENGTH; f++) {
    const fb = document.getElementById(`fb-${row}-${f}`);
    if (fb && dots[f]) fb.classList.add(dots[f]);
  }
}

// ── End-game ────────────────────────────────────────────────

function endGame(won) {
  gameOver = true;
  btnSubmit.disabled  = true;
  btnClear.disabled   = true;
  document.querySelectorAll('.peg').forEach(p => p.classList.remove('active-slot'));

  if (won) {
    messageEl.className  = 'win';
    messageEl.textContent = `🎉 You cracked the code in ${currentAttempt + 1} attempt${currentAttempt + 1 !== 1 ? 's' : ''}!`;
  } else {
    messageEl.className  = 'lose';
    messageEl.textContent = '😢 Out of attempts! The secret code was:';
  }

  revealSecret();
}

/** Show the secret code pegs below the board. */
function revealSecret() {
  secretPegsEl.innerHTML = '';
  for (const id of secretCode) {
    const peg = document.createElement('div');
    peg.className = 'secret-peg';
    peg.style.background = hexFor(id);
    secretPegsEl.appendChild(peg);
  }
  secretReveal.classList.add('visible');
}

// ── New game ─────────────────────────────────────────────────

function newGame() {
  secretCode     = generateCode();
  currentAttempt = 0;
  currentSlot    = 0;
  currentGuess   = [];
  selectedColor  = null;
  gameOver       = false;

  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
  secretReveal.classList.remove('visible');
  secretPegsEl.innerHTML = '';

  messageEl.className  = '';
  messageEl.textContent = `Attempt 1 of ${MAX_ATTEMPTS}`;

  btnSubmit.disabled = true;
  btnClear.disabled  = false;

  buildBoard();
}

// ── Bootstrap ────────────────────────────────────────────────

buildPalette();
newGame();

btnSubmit.addEventListener('click', submitGuess);
btnClear.addEventListener('click', clearCurrentRow);
btnNewGame.addEventListener('click', newGame);

// ── Instructions dropdown ────────────────────────────────────

const instructionsToggle = document.getElementById('instructions-toggle');
const instructionsPanel  = document.getElementById('instructions');

instructionsToggle.addEventListener('click', () => {
  const isOpen = instructionsPanel.classList.toggle('open');
  instructionsToggle.setAttribute('aria-expanded', String(isOpen));
  instructionsPanel.setAttribute('aria-hidden', String(!isOpen));
});
