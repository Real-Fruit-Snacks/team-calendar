// assets/js/app.js — bootstrap: wires host/store/token/render/ui together.
import { monthLabel, todayISO, addMonths } from './dates.js';
import { addEvent, updateEvent, removeEvent } from './model.js';
import { createHost, detectHost } from './host.js';
import { createStore } from './store.js';
import { loadToken, saveToken, hasToken } from './token.js';
import { renderMonth, renderAgenda } from './render.js';
import {
  mountHeader,
  openEventModal,
  openTokenModal,
  setTheme,
  initTheme,
} from './ui.js';

async function loadConfig() {
  try {
    const res = await fetch('config.json');
    if (!res.ok) return {};
    return await res.json();
  } catch {
    // Missing/invalid config.json is tolerated: fall back to auto-detection.
    return {};
  }
}

async function main() {
  initTheme();

  const config = await loadConfig();
  const host = createHost({ location: window.location, config });
  const kind = host.kind || detectHost(window.location);
  const origin = config.origin || window.location.origin;

  const store = createStore({ host });

  const appRoot = document.getElementById('app');
  appRoot.innerHTML = '';
  const shell = document.createElement('div');
  shell.className = 'tc-app';
  const headerRoot = document.createElement('div');
  const contentRoot = document.createElement('div');
  contentRoot.className = 'tc-content';
  shell.append(headerRoot, contentRoot);
  appRoot.appendChild(shell);

  const today = new Date();
  const state = {
    view: 'month',
    year: today.getFullYear(),
    month: today.getMonth(),
    canEdit: hasToken(),
  };

  function currentChipForCanEdit() {
    return state.canEdit ? 'editing' : 'readonly';
  }

  function render() {
    const model = store.get();
    header.setLabel(monthLabel(state.year, state.month));
    contentRoot.innerHTML = '';
    if (state.view === 'agenda') {
      renderAgenda(contentRoot, model, {
        fromISO: todayISO(),
        onEventClick: handleEventClick,
      });
    } else {
      renderMonth(contentRoot, model, {
        year: state.year,
        month: state.month,
        todayISO: todayISO(),
        onDayClick: handleDayClick,
        onEventClick: handleEventClick,
      });
    }
  }

  function openTokenFlow() {
    openTokenModal(document.body, {
      kind,
      origin,
      onSave: (token) => {
        saveToken(token);
        state.canEdit = true;
        header.setChip('editing');
        render();
      },
    });
  }

  function handleDayClick(dateISO) {
    if (!state.canEdit) {
      openTokenFlow();
      return;
    }
    openEventModal(document.body, {
      model: store.get(),
      dateISO,
      canEdit: true,
      onSave: (input) => {
        header.setChip('saving');
        store
          .save(
            (m) => addEvent(m, input),
            loadToken(),
            `Add event: ${input.title} (${input.date})`
          )
          .then(() => {
            header.setChip('editing');
            render();
          })
          .catch((err) => {
            header.setChip('error');
            alert(err.message);
          });
      },
    });
  }

  function handleEventClick(ev) {
    openEventModal(document.body, {
      model: store.get(),
      event: ev,
      canEdit: state.canEdit,
      onSave: (input) => {
        header.setChip('saving');
        store
          .save(
            (m) => updateEvent(m, ev.id, input),
            loadToken(),
            `Update event: ${input.title}`
          )
          .then(() => {
            header.setChip('editing');
            render();
          })
          .catch((err) => {
            header.setChip('error');
            alert(err.message);
          });
      },
      onDelete: () => {
        header.setChip('saving');
        store
          .save(
            (m) => removeEvent(m, ev.id),
            loadToken(),
            `Remove event: ${ev.title}`
          )
          .then(() => {
            header.setChip('editing');
            render();
          })
          .catch((err) => {
            header.setChip('error');
            alert(err.message);
          });
      },
    });
  }

  const header = mountHeader(headerRoot, {
    onPrev: () => {
      const r = addMonths(state.year, state.month, -1);
      state.year = r.year;
      state.month = r.month;
      render();
    },
    onNext: () => {
      const r = addMonths(state.year, state.month, 1);
      state.year = r.year;
      state.month = r.month;
      render();
    },
    onToday: () => {
      const t = new Date();
      state.year = t.getFullYear();
      state.month = t.getMonth();
      render();
    },
    onToggleView: (view) => {
      state.view = view;
      header.setView(view);
      render();
    },
    onToggleTheme: () => {
      const current =
        document.documentElement.dataset.theme ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark');
      setTheme(current === 'dark' ? 'light' : 'dark');
    },
    onEditToken: () => openTokenFlow(),
  });

  header.setView(state.view);
  header.setChip(currentChipForCanEdit());

  try {
    await store.load(loadToken());
    header.setChip(currentChipForCanEdit());
  } catch {
    // Load failed (e.g. no token, private repo, network issue): keep the
    // store's empty model and surface an error chip so the page still renders.
    header.setChip('error');
  }

  render();
}

main();
