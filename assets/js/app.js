// assets/js/app.js — bootstrap: wires host/store/token/render/ui together.
import { todayISO, addMonths } from './dates.js';
import {
  addEvent, updateEvent, removeEvent,
  addTemplate, updateTemplate, removeTemplate,
} from './model.js';
import { createHost, detectHost } from './host.js';
import { createStore } from './store.js';
import { loadToken, saveToken, hasToken } from './token.js';
import { renderMonth, renderAgenda } from './render.js';
import {
  mountHeader,
  openEventModal,
  openTemplateManager,
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
    search: '',
  };

  function currentChipForCanEdit() {
    return state.canEdit ? 'editing' : 'readonly';
  }

  function render() {
    const model = store.get();
    header.setPeriod(state.year, state.month);
    contentRoot.innerHTML = '';
    if (state.view === 'agenda') {
      renderAgenda(contentRoot, model, {
        fromISO: todayISO(),
        query: state.search,
        onEventClick: handleEventClick,
      });
    } else {
      renderMonth(contentRoot, model, {
        year: state.year,
        month: state.month,
        todayISO: todayISO(),
        query: state.search,
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

  // Persist a template change through the store; returns the save promise so
  // the manager can refresh its list once the commit lands.
  function saveTemplateChange(mutator, message) {
    header.setChip('saving');
    return store
      .save(mutator, loadToken(), message)
      .then(() => {
        header.setChip('editing');
        render();
      })
      .catch((err) => {
        header.setChip('error');
        alert(err.message);
        throw err;
      });
  }

  function openTemplateFlow() {
    openTemplateManager(document.body, {
      getModel: () => store.get(),
      onSave: (input, editingId) =>
        saveTemplateChange(
          (m) => (editingId ? updateTemplate(m, editingId, input) : addTemplate(m, input)),
          editingId ? `Update template: ${input.name}` : `Add template: ${input.name}`
        ),
      onDelete: (id) => {
        const t = (store.get().templates || []).find((x) => x.id === id);
        return saveTemplateChange(
          (m) => removeTemplate(m, id),
          `Remove template: ${t ? t.name : id}`
        );
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
      onManageTemplates: openTemplateFlow,
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
    onSearch: (query) => {
      state.search = query;
      render();
    },
    onJump: (year, month) => {
      state.year = year;
      state.month = month;
      render();
    },
    onToggleTheme: () => {
      const order = ['dark', 'light', 'workbench'];
      const current =
        document.documentElement.dataset.theme ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark');
      const next = order[(order.indexOf(current) + 1) % order.length];
      setTheme(next);
      header.setTheme(next);
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

// Register the service worker for offline use and PWA installability. Optional:
// it's a progressive enhancement, so failure (e.g. insecure context) is ignored.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
