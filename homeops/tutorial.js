// tutorial.js
// Tutorial state machine, modal presentation, and task creation
// Imports TUTORIAL_DATA from tutorial-text.js

import { TUTORIAL_DATA } from './tutorial-text.js';

export class Tutorial {
  /**
   * Main entry point. Orchestrates all 5 phases, then level-up burst.
   * Returns Promise that resolves when tutorial is complete.
   */
  static async start(session) {
    const status = await this.getStatus(session.player.id);

    // Flow through phases sequentially
    for (let phase = status.phase || 1; phase <= 5; phase++) {
      await this.presentPhase(phase, session);
    }

    // Final: Level 2 unlock burst
    await this.levelUpBurst();

    // Mark tutorial complete in backend
    await this.markComplete(session.player.id);
  }

  /**
   * Present one phase modal and wait for user completion.
   */
  static async presentPhase(phase, session) {
    const data = TUTORIAL_DATA.phases[phase];
    if (!data) return;

    return new Promise((resolve) => {
      this.showModal(phase, session, async () => {
        this.awardXP(data.xp, data.reward);
        await this.updateStatus(session.player.id, phase);
        resolve();
      });
    });
  }

  /**
   * Render and present modal based on phase type.
   * Handles: PWA install (phase 1), task completion (phase 3), task addition (phases 2,4,5).
   */
  static showModal(phase, session, onComplete) {
    const data = TUTORIAL_DATA.phases[phase];
    const overlay = document.getElementById('overlay');

    let html = `
      <div class="bottom-sheet tutorial-sheet">
        <div class="sheet-handle"></div>
        <div style="padding:0 1.25rem">
          <span class="label text-muted">${data.day}</span>
          <h2 class="display-md sheet-title">${data.title}</h2>
          <p class="body-md text-secondary" style="margin:0.75rem 0">${data.body}</p>
    `;

    if (phase === 1) {
      // ── PHASE 1: PWA Install Instructions ──────────────────────
      html += `
        <div style="margin:1.5rem 0; padding:1rem; background:var(--bg-elevated); border-radius:8px;">
          <div class="label text-secondary" style="margin-bottom:0.5rem">iOS:</div>
          <div class="body-md text-muted" style="margin-bottom:1rem">${data.ios}</div>
          <div class="label text-secondary" style="margin-bottom:0.5rem">Android:</div>
          <div class="body-md text-muted">${data.android}</div>
        </div>
        <div class="sheet-actions">
          <button class="btn-primary" id="tut-pwa-confirm" style="width:100%">I've Installed It</button>
        </div>
      `;
    } else if (phase === 3) {
      // ── PHASE 3: Complete a Task (guidance only) ───────────────
      html += `
        <div style="margin:1.5rem 0; padding:1rem; background:var(--bg-elevated); border-radius:8px;">
          <div class="label text-secondary">Your first task is waiting on the board.</div>
          <div class="body-md text-muted" style="margin-top:0.5rem">Mark it done (even if it's just one mug washed) and watch the magic.</div>
        </div>
        <div class="sheet-actions">
          <button class="btn-secondary" id="tut-back-board" style="flex:1">Go to Board</button>
          <button class="btn-primary" id="tut-complete-later" style="flex:1">I'll Come Back</button>
        </div>
      `;
    } else {
      // ── PHASES 2, 4, 5: Add Task (preloaded + custom) ──────────
      const preloaded = data.preloaded || [];
      html += `
        <div style="margin:1.5rem 0; display:flex; flex-direction:column; gap:0.6rem">
      `;

      preloaded.forEach((task, idx) => {
        html += `
          <button class="tut-task-option" data-phase="${phase}" data-idx="${idx}"
            style="padding:1rem; border:1px solid var(--border); border-radius:8px; text-align:left;
            background:var(--bg-card); cursor:pointer; transition:border-color 0.15s;">
            <div class="body-lg" style="margin-bottom:0.25rem">${task.title}</div>
            <div class="label text-muted">${task.frequency} · ${task.difficulty}</div>
            <div class="label text-secondary" style="margin-top:0.3rem">${task.flavor}</div>
          </button>
        `;
      });

      html += `
          <button id="tut-custom-task" data-phase="${phase}"
            style="padding:1rem; border:2px dashed var(--border); border-radius:8px; text-align:left;
            background:transparent; cursor:pointer; color:var(--accent-primary); transition:border-color 0.15s;">
            <div class="body-lg">✏️ ${data.customPrompt}</div>
          </button>
        </div>
      `;
    }

    html += `</div></div>`;

    overlay.innerHTML = html;
    overlay.classList.add('open');

    if (phase === 1) {
      // PWA install confirmation
      document.getElementById('tut-pwa-confirm').addEventListener('click', onComplete);
    } else if (phase === 3) {
      // Task completion guidance
      document.getElementById('tut-back-board').addEventListener('click', () => {
        this.closeModal();
        // User will complete task on board; completion handler will trigger onComplete
        // Set flag so completion handler knows to call onComplete
        window.TUT_PHASE_3_PENDING = true;
        window.TUT_PHASE_3_CALLBACK = onComplete;
      });
      document.getElementById('tut-complete-later').addEventListener('click', onComplete);
    } else {
      // Task addition (preloaded or custom)
      document.querySelectorAll('.tut-task-option').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const p = parseInt(btn.dataset.phase);
          const idx = parseInt(btn.dataset.idx);
          const task = TUTORIAL_DATA.phases[p].preloaded[idx];

          try {
            await this.addTutorialTask(session.household.id, session.player.id, task, p);
            this.closeModal();
            showToast(`Added "${task.title}". You're on track.`);
            onComplete();
          } catch (e) {
            showToast('Could not add task. Try again.');
          }
        });
      });

      // Custom task entry
      document.getElementById('tut-custom-task').addEventListener('click', () => {
        const p = parseInt(document.getElementById('tut-custom-task').dataset.phase);
        this.showCustomTaskForm(session, p, onComplete);
      });
    }
  }

  /**
   * Show custom task entry form (reuses existing openAddTaskSheet).
   */
  static showCustomTaskForm(session, phase, onComplete) {
    openAddTaskSheet(
      session.household,
      session.player,
      null,
      async () => {
        this.closeModal();
        showToast('Nice. You\'re exploring.');
        onComplete();
      }
    );
  }

  /**
   * Create a preloaded tutorial task in KV.
   */
  static async addTutorialTask(householdId, playerId, taskData, phase) {
    const now = new Date();
    let dueAt;

    if (taskData.frequency === 'daily') {
      now.setHours(23, 59, 0, 0);
      dueAt = now.toISOString();
    } else {
      now.setDate(now.getDate() + 7);
      now.setHours(23, 59, 0, 0);
      dueAt = now.toISOString();
    }

    await api(`/api/households/${householdId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: taskData.title,
        difficulty: taskData.difficulty,
        assignee: phase === 5 ? 'unassigned' : playerId,
        dueAt,
        recurring: taskData.frequency,
        tutorialPhase: phase,
      }),
    });
  }

  /**
   * Show XP reward toast.
   */
  static awardXP(amount, message) {
    showToast(message);
  }

  /**
   * Level 2 unlock burst (full screen, confetti, stars).
   */
  static async levelUpBurst() {
    return new Promise((resolve) => {
      const l = document.getElementById('burst-layer');
      if (!l) {
        resolve();
        return;
      }

      const data = TUTORIAL_DATA.levelUp;
      l.innerHTML = `
        <div class="confetti-container">${makeConfetti(40)}</div>
        <div class="burst-screen burst-rankup">
          <div class="rankup-badge" style="border-color:var(--accent-gold);color:var(--accent-gold)">
            ${data.title}
          </div>
          <div class="rankup-name display-xl" style="color:var(--accent-gold)">
            You showed up.
          </div>
          <div class="rankup-number label text-secondary">
            Five days straight. +${data.xp} XP
          </div>
          <div class="rankup-stars">
            ${[...Array(5)].map(() => `<span class="rankup-star">${icon('star', 30)}</span>`).join('')}
          </div>
          <div class="burst-dismiss-hint" style="margin-top:2rem">
            ${data.cta}
          </div>
        </div>
      `;
      l.classList.add('active');

      let done = false;
      const dismiss = () => {
        if (done) return;
        done = true;
        l.classList.remove('active');
        l.removeEventListener('click', dismiss);
        setTimeout(() => {
          l.innerHTML = '';
          resolve();
        }, 150);
      };

      const t = setTimeout(dismiss, 4000);
      l.addEventListener('click', () => {
        clearTimeout(t);
        dismiss();
      });
    });
  }

  /**
   * Close modal overlay.
   */
  static closeModal() {
    const overlay = document.getElementById('overlay');
    overlay.classList.remove('open');
    setTimeout(() => {
      overlay.innerHTML = '';
    }, 150);
  }

  // ── Backend API Helpers ─────────────────────────────────────────

  /**
   * Fetch current tutorial status for player.
   */
  static async getStatus(playerId) {
    try {
      const res = await api(`/api/players/${playerId}/tutorial-status`);
      return res;
    } catch (e) {
      // First time: no status exists, start at phase 1
      return { phase: 1, complete: false };
    }
  }

  /**
   * Advance tutorial to next phase.
   */
  static async updateStatus(playerId, phase) {
    try {
      await api(`/api/players/${playerId}/tutorial-status`, {
        method: 'PATCH',
        body: JSON.stringify({ phase: phase + 1 }),
      });
    } catch (e) {
      console.error('Could not update tutorial status:', e);
    }
  }

  /**
   * Mark tutorial as complete.
   */
  static async markComplete(playerId) {
    try {
      await api(`/api/players/${playerId}/tutorial-status`, {
        method: 'PATCH',
        body: JSON.stringify({ complete: true, completedAt: new Date().toISOString() }),
      });
    } catch (e) {
      console.error('Could not mark tutorial complete:', e);
    }
  }
}
