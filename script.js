/* script.js
   — Camada de comportamento para o painel (router, inkbar, kanban, gantt, modais, toasts)
   — Tudo em JS puro, resistente à ausência de elementos (fail-safe).
*/

(() => {
  // ===== Utilitários gerais =====
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 10)}`;

  const isDate = (d) => d instanceof Date && !isNaN(d);
  const parseISO = (s) => {
    if (s instanceof Date) return s;
    const d = new Date(s);
    return isDate(d) ? d : null;
  };

  const pct = (value, start, end) => {
    const p = ((value - start) / (end - start)) * 100;
    return clamp(p, 0, 100);
  };

  // ===== Toasts =====
  const Toasts = (() => {
    let container;
    const ensure = () => {
      container = $(".toast-container");
      if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
      }
    };
    const show = (msg, type = "ok", ms = 4000) => {
      ensure();
      const el = document.createElement("div");
      el.className = `toast ${type}`;
      el.innerHTML = `
        <span class="dot"></span>
        <div style="display:grid;gap:4px">
          <strong>${type === "ok" ? "Sucesso" : type === "warn" ? "Atenção" : "Erro"}</strong>
          <div>${msg}</div>
        </div>
      `;
      container.appendChild(el);
      // animação de entrada
      requestAnimationFrame(() => el.classList.add("show"));
      // saída
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 250);
      }, ms);
    };
    return { show };
  })();

  // Expor toasts globalmente
  window.toast = (m, t = "ok", ms = 4000) => Toasts.show(m, t, ms);

  // ===== Router + Inkbar =====
  const Router = (() => {
    let links = [];
    let pages = [];
    let inkbar;
    let menu;

    const moveInkbar = (active) => {
      if (!inkbar || !active || !menu) return;
      const aRect = active.getBoundingClientRect();
      const mRect = menu.getBoundingClientRect();
      const left = aRect.left - mRect.left + menu.scrollLeft;
      inkbar.style.width = `${aRect.width}px`;
      inkbar.style.transform = `translateX(${left}px)`;
      inkbar.style.opacity = 1;
    };

    const activate = (targetId) => {
      // Páginas
      pages.forEach((p) => p.classList.toggle("active", `#${p.id}` === targetId));
      // Links
      links.forEach((a) => {
        const t = a.getAttribute("data-target") || a.getAttribute("href");
        a.classList.toggle("active", t === targetId);
      });
      const active = links.find(
        (a) => (a.getAttribute("data-target") || a.getAttribute("href")) === targetId
      );
      moveInkbar(active);
    };

    const handleClick = (e) => {
      const a = e.currentTarget;
      const t = a.getAttribute("data-target") || a.getAttribute("href");
      if (!t || !t.startsWith("#")) return;
      e.preventDefault();
      history.replaceState({}, "", t);
      activate(t);
    };

    const init = () => {
      pages = $$(".page-content");
      menu = $(".menu");
      inkbar = $(".inkbar") || (() => {
        const b = document.createElement("div");
        b.className = "inkbar";
        menu?.appendChild(b);
        return b;
      })();

      links = $$(".nav-link");
      links.forEach((a) => on(a, "click", handleClick));

      // Rota inicial via hash ou primeira página
      let initial = location.hash && $(location.hash) ? location.hash : null;
      if (!initial && pages.length) initial = `#${pages[0].id}`;
      if (initial) activate(initial);

      on(window, "resize", () => {
        const active = $(".nav-link.active");
        moveInkbar(active);
      });
      // Foco via teclado mantém inkbar visível
      links.forEach((a) => on(a, "focus", () => moveInkbar(a)));
      // Scroll do menu também ajusta a inkbar
      on(menu, "scroll", () => {
        const active = $(".nav-link.active");
        moveInkbar(active);
      });
    };

    return { init, activate };
  })();

  // ===== Modais =====
  const Modals = (() => {
    const open = (id) => {
      const modal = document.getElementById(id);
      const backdrop = document.getElementById(`${id}-backdrop`) || $("#modal-backdrop");
      if (!modal || !backdrop) return;
      backdrop.classList.add("show");
      modal.classList.add("show");
    };
    const close = (id) => {
      const modal = document.getElementById(id);
      const backdrop = document.getElementById(`${id}-backdrop`) || $("#modal-backdrop");
      if (!modal || !backdrop) return;
      backdrop.classList.remove("show");
      modal.classList.remove("show");
    };
    const bind = () => {
      // Abrir com [data-modal-target="idDoModal"]
      $$('[data-modal-target]').forEach((btn) => {
        on(btn, "click", () => open(btn.getAttribute("data-modal-target")));
      });
      // Fechar com [data-close-modal="idDoModal"] ou [data-close-modal] (fechar pai)
      $$('[data-close-modal]').forEach((btn) => {
        on(btn, "click", () => {
          const id = btn.getAttribute("data-close-modal");
          if (id) close(id);
          else {
            const md = btn.closest(".modal");
            if (md?.id) close(md.id);
          }
        });
      });
      // Clique fora fecha
      $$(".modal-backdrop").forEach((bd) => {
        on(bd, "click", (e) => {
          if (e.target !== bd) return;
          const id = bd.id?.replace("-backdrop", "");
          if (id) close(id);
        });
      });
    };
    return { open, close, bind };
  })();
  window.openModal = Modals.open;
  window.closeModal = Modals.close;

  // ===== Meters & KPIs =====
  const Metrics = (() => {
    const apply = (data = {}) => {
      // KPI: <span class="kpi-value" data-key="projetos"></span>
      $$(".kpi-value[data-key]").forEach((el) => {
        const k = el.getAttribute("data-key");
        if (k in data) el.textContent = data[k];
      });
      // Subtexto
      $$(".kpi-sub[data-key]").forEach((el) => {
        const k = el.getAttribute("data-key");
        if (k in data) el.textContent = data[k];
      });
      // Meter: <div class="meter" data-key="ocupacao"><div class="bar"></div><span></span></div>
      $$(".meter[data-key]").forEach((m) => {
        const k = m.getAttribute("data-key");
        const v = clamp(Number(data[k] ?? 0), 0, 100);
        const bar = $(".bar", m);
        const label = $("span", m);
        if (bar) bar.style.width = `${v}%`;
        if (label) label.textContent = `${v}%`;
      });
    };
    return { apply };
  })();

  // ===== Kanban (drag & drop com persistência em localStorage) =====
  const Kanban = (() => {
    const STORAGE = "ct_kanban_v1";
    let board;
    let columns = new Map(); // status -> listElement

    const load = () => {
      try {
        const raw = localStorage.getItem(STORAGE);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : null;
      } catch {
        return null;
      }
    };
    const save = () => {
      const items = [];
      columns.forEach((list, status) => {
        $$(".kanban-card", list).forEach((c) => {
          items.push({
            id: c.dataset.id,
            status,
            title: $(".meta .title", c)?.textContent || "",
            subtitle: $(".meta .subtitle", c)?.textContent || "",
            progress: Number($(".mini-progress-bar", c)?.style.width.replace("%", "") || 0),
            thumbText: $(".thumb span", c)?.textContent || "",
          });
        });
      });
      localStorage.setItem(STORAGE, JSON.stringify(items));
    };

    const createCard = (o) => {
      const c = document.createElement("div");
      c.className = "kanban-card";
      c.draggable = true;
      c.dataset.id = o.id || uid("card");
      c.innerHTML = `
        <div class="card-head">
          <div class="thumb">${o.thumb ? `<img src="${o.thumb}" alt="">` : `<span>${o.thumbText || "T"}</span>`}</div>
          <div class="meta">
            <div class="title">${o.title || "Tarefa"}</div>
            <div class="subtitle">${o.subtitle || ""}</div>
          </div>
        </div>
        <div class="mini-progress">
          <div class="mini-progress-bar" style="width:${clamp(o.progress ?? 0, 0, 100)}%"></div>
          <span>${clamp(o.progress ?? 0, 0, 100)}%</span>
        </div>
      `;
      // Drag handlers
      on(c, "dragstart", (e) => {
        c.classList.add("dragging");
        e.dataTransfer.setData("text/plain", c.dataset.id);
        e.dataTransfer.effectAllowed = "move";
      });
      on(c, "dragend", () => c.classList.remove("dragging"));
      return c;
    };

    const add = (status, obj) => {
      const list = columns.get(status);
      if (!list) return;
      list.appendChild(createCard(obj));
      save();
    };

    const bindColumn = (col) => {
      const list = $(".kanban-list", col);
      if (!list) return;
      const status = col.getAttribute("data-status") || uid("status");
      columns.set(status, list);

      on(col, "dragover", (e) => {
        e.preventDefault();
        col.classList.add("over");
        e.dataTransfer.dropEffect = "move";
      });
      on(col, "dragleave", () => col.classList.remove("over"));
      on(col, "drop", (e) => {
        e.preventDefault();
        col.classList.remove("over");
        const id = e.dataTransfer.getData("text/plain");
        const card = $(`.kanban-card[data-id="${CSS.escape(id)}"]`, board);
        if (!card) return;

        // Inserir na posição correta (após o item sob o cursor, se houver)
        const after = $$(".kanban-card", list).find((el) => {
          const r = el.getBoundingClientRect();
          return e.clientY < r.top + r.height / 2;
        });
        if (after) list.insertBefore(card, after);
        else list.appendChild(card);

        save();
        toast("Card movido.", "ok", 1500);
      });
    };

    const init = () => {
      board = $("#kanban");
      if (!board) return;

      $$(".kanban-col", board).forEach(bindColumn);

      // Seed se não houver nada salvo
      const saved = load();
      if (saved && saved.length && columns.size) {
        saved.forEach((it) => add(it.status, it));
      } else {
        // Exemplo inicial (ajuste/remoção livre)
        const statuses = [...columns.keys()];
        const seed = [
          { title: "Preparar células no PS", subtitle: "Stellantis – Avenger", progress: 15, thumbText: "PS" },
          { title: "Avaliar colisões", subtitle: "Linha Solda – Gate 2", progress: 40, thumbText: "COL" },
          { title: "Exportar COJT", subtitle: "Robô 2VCT01", progress: 70, thumbText: "COJT" },
          { title: "Validação com Produto", subtitle: "Fixture #08", progress: 55, thumbText: "VAL" },
          { title: "Relatório licenças", subtitle: "lmutil – status", progress: 90, thumbText: "LIC" },
        ];
        seed.forEach((s, i) => add(statuses[i % statuses.length], s));
        save();
      }
    };

    return { init, add, save };
  })();
  window.kanbanAdd = Kanban.add;

  // ===== Gantt (cronograma leve) =====
  const Gantt = (() => {
    // Espera uma estrutura:
    // {
    //   container: "#cronograma", // wrapper .gantt
    //   start: "2025-05-01",
    //   end:   "2025-07-01",
    //   ticks: "week" | "day",
    //   rows: [
    //     { label:"Cenários", color:"#2563eb", start:"2025-05-03", end:"2025-05-18", milestones:[{at:"2025-05-10", label:"v1"}] },
    //     ...
    //   ]
    // }
    const buildScale = (wrap, start, end, mode = "week") => {
      const sc = $(".scale", wrap);
      if (!sc) return;
      sc.innerHTML = "";
      const s = +start, e = +end;
      const dayMs = 24 * 60 * 60 * 1000;

      if (mode === "day") {
        const days = Math.max(1, Math.ceil((e - s) / dayMs));
        for (let i = 0; i <= days; i++) {
          const d = new Date(s + i * dayMs);
          const t = document.createElement("div");
          t.className = "tick";
          t.textContent = d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
          t.style.flex = "1 0 80px"; // largura mínima confortável
          sc.appendChild(t);
        }
      } else {
        // Por semana
        let d = new Date(start);
        // Alinhar no domingo (ou segunda, conforme preferência)
        const weekday = d.getDay(); // 0 dom .. 6 sáb
        d = new Date(+d - weekday * dayMs);
        while (+d <= +end) {
          const t = document.createElement("div");
          t.className = "tick";
          const endWeek = new Date(+d + 6 * dayMs);
          const label = `${d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })} – ${endWeek.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })}`;
          t.textContent = label;
          t.style.flex = "1 0 120px";
          sc.appendChild(t);
          d = new Date(+d + 7 * dayMs);
        }
      }
    };

    const buildRows = (wrap, cfg) => {
      const head = $(".gantt-head", wrap);
      const body = $(".gantt-body", wrap) || wrap;
      const laneAreaWidth = $(".right", head)?.getBoundingClientRect().width || 800;

      // Linha vertical de "hoje"
      const today = new Date();
      const s = +cfg._start, e = +cfg._end;
      const todayPct = pct(+today, s, e);

      cfg.rows.forEach((r) => {
        const row = document.createElement("div");
        row.className = "gantt-row";

        // Esquerda (título/meta)
        const left = document.createElement("div");
        left.className = "left cls";
        left.innerHTML = `
          <span class="dot" style="background:${r.color || '#2563eb'}"></span>
          <div style="display:grid">
            <div class="app-title" style="font-size:14px">${r.label || "Tarefa"}</div>
            <div class="meta" style="font-size:12px">
              ${new Date(r._start).toLocaleDateString()} – ${new Date(r._end).toLocaleDateString()}
            </div>
          </div>
        `;

        // Direita (eixo temporal)
        const right = document.createElement("div");
        right.className = "right";
        const lane = document.createElement("div");
        lane.className = "lane";
        right.appendChild(lane);

        // Barra da tarefa
        const leftPct = pct(+r._start, s, e);
        const widthPct = clamp(pct(+r._end, s, e) - leftPct, 0.5, 100);

        const bar = document.createElement("div");
        // estilo inline para evitar dependência de CSS extra
        Object.assign(bar.style, {
          position: "absolute",
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          top: "14px",
          height: "16px",
          borderRadius: "10px",
          background: `linear-gradient(180deg, ${r.color || "#2563eb"}, ${r.color || "#2563eb"}CC)`,
          boxShadow: "0 8px 18px rgba(37,99,235,.25), inset 0 1px 0 rgba(255,255,255,.25)",
        });
        lane.appendChild(bar);

        // Linha de hoje
        const base = document.createElement("div");
        base.className = "base-line";
        Object.assign(base.style, {
          left: `${todayPct}%`,
          background: "rgba(255,255,255,.25)",
        });
        lane.appendChild(base);

        // Milestones
        (r.milestones || []).forEach((m, i) => {
          const at = parseISO(m.at);
          if (!at) return;
          const mPct = pct(+at, s, e);
          const ms = document.createElement("div");
          ms.className = "ms";
          ms.style.left = `${mPct}%`;
          ms.innerHTML = `
            <span class="pin ${i === 0 ? "main" : ""}"></span>
            <span class="label">${m.label || at.toLocaleDateString()}</span>
          `;
          lane.appendChild(ms);
        });

        row.appendChild(left);
        row.appendChild(right);
        wrap.appendChild(row);
      });
    };

    const init = (cfg) => {
      const wrap = $(cfg.container);
      if (!wrap) return;

      // Normalizar datas
      cfg._start = parseISO(cfg.start);
      cfg._end = parseISO(cfg.end);
      if (!isDate(cfg._start) || !isDate(cfg._end) || cfg._start >= cfg._end) return;
      cfg.rows = (cfg.rows || []).map((r) => ({
        ...r,
        _start: parseISO(r.start) || cfg._start,
        _end: parseISO(r.end) || cfg._end,
      }));

      buildScale(wrap, cfg._start, cfg._end, cfg.ticks || "week");
      buildRows(wrap, cfg);
    };

    return { init };
  })();

  // ===== Tabela com hierarquia inline =====
  const HierarchyTable = (() => {
    const toggle = (tr) => {
      if (!tr) return;
      const table = tr.closest("table");
      if (!table) return;

      // já existe?
      const next = tr.nextElementSibling;
      if (next && next.classList.contains("hierarchy-row")) {
        next.remove();
        tr.classList.toggle("row-selected");
        return;
      }

      // dados
      const json = tr.getAttribute("data-hierarchy");
      let items = [];
      try {
        if (json) items = JSON.parse(json);
      } catch {}
      const colSpan = tr.children.length;

      const row = document.createElement("tr");
      row.className = "hierarchy-row";
      const td = document.createElement("td");
      td.className = "hierarchy-cell";
      td.colSpan = colSpan;
      td.innerHTML = `
        <div class="hierarchy-content">
          ${
            items.length
              ? `<ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul>`
              : `<em style="color:#9CA3AF">Sem detalhes adicionais.</em>`
          }
        </div>
      `;
      row.appendChild(td);
      tr.insertAdjacentElement("afterend", row);
      tr.classList.add("row-selected");
    };

    const bind = () => {
      $$('tr[data-hierarchy]').forEach((tr) => {
        on(tr, "click", () => toggle(tr));
      });
    };

    return { bind, toggle };
  })();

  // ===== Ações declarativas via data-action =====
  const Actions = (() => {
    const map = {
      "open-modal": (btn) => Modals.open(btn.getAttribute("data-target") || btn.getAttribute("data-modal-target")),
      "close-modal": (btn) => Modals.close(btn.getAttribute("data-target") || btn.getAttribute("data-close-modal")),
      "add-card": (btn) => {
        const status = btn.getAttribute("data-status") || "backlog";
        Kanban.add(status, {
          title: btn.getAttribute("data-title") || "Nova tarefa",
          subtitle: btn.getAttribute("data-subtitle") || "",
          progress: Number(btn.getAttribute("data-progress") || 0),
          thumbText: (btn.getAttribute("data-thumb") || "NT").slice(0, 3),
        });
        toast("Tarefa adicionada ao Kanban.", "ok", 1800);
      },
      "route": (btn) => {
        const tgt = btn.getAttribute("data-target");
        if (tgt && tgt.startsWith("#")) Router.activate(tgt);
      },
    };

    const init = () => {
      $$("[data-action]").forEach((el) => {
        const a = el.getAttribute("data-action");
        if (map[a]) on(el, "click", () => map[a](el));
      });
    };
    return { init };
  })();

  // ===== Boot =====
  const init = () => {
    Router.init();
    Modals.bind();
    Kanban.init();
    HierarchyTable.bind();
    Actions.init();

    // KPIs iniciais (exemplo)
    Metrics.apply({
      projetos: 18,
      andamentos: 7,
      finalizados: 9,
      ocupacao: 72,
      backlog: 11,
      simulação: 4,
      validação: 3,
    });

    // Gantt (se existir .gantt no DOM)
    const gantt = $(".gantt");
    if (gantt) {
      // Tentar capturar range por data-* no container (opcional)
      const sAttr = gantt.getAttribute("data-start") || new Date(new Date().getFullYear(), 0, 1).toISOString();
      const eAttr = gantt.getAttribute("data-end") || new Date(new Date().getFullYear(), 11, 31).toISOString();

      Gantt.init({
        container: ".gantt",
        start: sAttr,
        end: eAttr,
        ticks: "week",
        rows: [
          { label: "Célula 2VCT01 — Setup", color: "#2563eb", start: sAttr, end: addDaysISO(sAttr, 28), milestones: [{ at: addDaysISO(sAttr, 7), label: "v0.1" }] },
          { label: "Leitura de Backup / WeldScanner", color: "#10B981", start: addDaysISO(sAttr, 10), end: addDaysISO(sAttr, 36), milestones: [{ at: addDaysISO(sAttr, 20), label: "QA" }] },
          { label: "PDL Remaker — Ajustes", color: "#F59E0B", start: addDaysISO(sAttr, 18), end: addDaysISO(sAttr, 50), milestones: [{ at: addDaysISO(sAttr, 40), label: "freeze" }] },
          { label: "Exportação COJT / Rebuild", color: "#EF4444", start: addDaysISO(sAttr, 30), end: addDaysISO(sAttr, 65), milestones: [{ at: addDaysISO(sAttr, 58), label: "gate" }] },
        ],
      });
    }
  };

  const addDaysISO = (iso, days) => {
    const d = parseISO(iso) || new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  on(document, "DOMContentLoaded", init);
})();
