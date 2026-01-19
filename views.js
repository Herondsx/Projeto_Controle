/* views.js - Camada visual/renderer */

// Helpers basicos
export const $ = (s) => document.querySelector(s);
export const $$ = (s) => document.querySelectorAll(s);

// Constantes visuais
export const TipoDispositivo = { Mecanico: 0, Eletrico: 1, Software: 2, Ferramental: 3, Outro: 99 };
export const NivelPrioridade = { Baixa: 1, Media: 2, Alta: 3, Critica: 4 };
export const StatusPrazo = { NoPrazo: "NoPrazo", EmAtraso: "EmAtraso", Concluido: "Concluido", Standby: "Standby" };
export const StatusManual = { NoPrazo: "NoPrazo", EmAtraso: "EmAtraso", EmSimulacao: "EmSimulacao", Concluido: "Concluido", Standby: "Standby" };
export const tipoOptions = Object.entries(TipoDispositivo).map(([name, value]) => ({ value, name }));
export const nivelOptions = Object.entries(NivelPrioridade).map(([name, value]) => ({ value, name }));
export const PLACEHOLDER_IMG = "https://placehold.co/64x64/EEE/111?text=IMG";

// Helpers de formatacao
export function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

export function formatarData(date) {
    if (!date) return "?";
    const d = new Date(date);
    if (isNaN(d)) return "?";
    if (typeof date === "string") d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("pt-BR");
}

export function formatarDataInput(date) {
    if (!date) return "";
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

export function imgSrc(d) {
    return d?.ImagemDataUrl || d?.ImagemPath || PLACEHOLDER_IMG;
}

export function mediaDisp(d) {
    return ((d.DR1Percentual || 0) + (d.DR2Percentual || 0) + (d.DR3Percentual || 0) + (d.DoisDPercentual || 0) + (d.PlanoSequenciaPercentual || 0) + (d.ReleasePercentual || 0)) / 6;
}

const appApi = () => window.__APP_API || {};

// Toast
export function showToast(msg, type = "ok", timeout = 3000) {
    if (!window.__lastToast) window.__lastToast = { msg: "", at: 0 };
    const container = $("#toast-container");
    if (!container) return;
    const now = Date.now();
    if (msg === window.__lastToast.msg && now - window.__lastToast.at < 600) return;
    window.__lastToast = { msg, at: now };
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="dot" aria-hidden="true"></span><div>${escapeHtml(msg)}</div>`;
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
        t.classList.remove("show");
        setTimeout(() => t.remove(), 250);
    }, timeout);
    const live = document.getElementById("sr-live");
    if (live) {
        live.textContent = "";
        setTimeout(() => (live.textContent = msg), 20);
    }
}

// Animacao de entrada
export function runSectionEnter(section) {
    if (!section) return;
    const nodes = section.querySelectorAll(".card, .kanban-col, .table-wrap, canvas, .kpi");
    nodes.forEach((el, idx) => {
        const delay = Math.min(idx * 60, 420) + "ms";
        el.style.setProperty("--anim-delay", delay);
        el.classList.remove("anim-enter");
        void el.offsetWidth;
        el.classList.add("anim-enter");
    });
}

// Auxiliares de dados
const classesDoProjeto = (state, pid) => {
    if (window.PS?.utils?.selectClassesByProject) return PS.utils.selectClassesByProject(state, pid);
    return (state.classes || []).filter((c) => (c.ProjetoId || 1) === pid);
};
const dispositivosDoProjeto = (state, pid) => {
    if (window.PS?.utils?.selectDispsByProject) return PS.utils.selectDispsByProject(state, pid);
    const clsIds = new Set(classesDoProjeto(state, pid).map((c) => c.Id));
    return (state.dispositivos || []).filter((d) => clsIds.has(d.ClasseId));
};

const CHECKLIST_TEMPLATE = {
    DR1: ["Helf assemente", "Definido pontos e acesso de solda preliminar", "Estudo de ergonomia sequencia de abastecimento", "Plano de fixacao", "Payload Preliminar aprovados", "Evolucao 3D de Dispositivos"],
    DR2: ["Remarcas interna e do DR01 atendidas", "Plano de sequencia preliminar", "Payload final com todas as condicoes", "Lista de material comercial antecipado", "Evolucao 3D de Dispositivos"],
    DR3: ["Remarcas interna e do DR02 atendidas", "Entrega de 3D para cotacao", "Plano de sequencia Final", "Calculo Estrutural FEA", "Shimms Book e Folga de Chapa", "Evolucao 2D de Dispositivos"],
};

// Variaveis de grafico
let chartStatusInstance = null;
let chartFasesInstance = null;
let chartLinhaInstance = null;
let chartTrendInstance = null;

export function initDashboardCharts() {
    if (typeof Chart === "undefined") return;
    const ctxStatus = $("#chart-status");
    if (ctxStatus && !chartStatusInstance) {
        Chart.defaults.color = "rgba(55, 65, 81, 0.8)";
        Chart.defaults.font.family = "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, 'Helvetica Neue', Arial";
        Chart.defaults.plugins.legend.position = "bottom";
        chartStatusInstance = new Chart(ctxStatus, {
            type: "bar",
            data: { labels: [], datasets: [{ label: "Qtd. Dispositivos", data: [], backgroundColor: ["#10b981", "#ef4444", "#3b82f6", "#22c55e", "#64748b"], borderRadius: 6 }] },
            options: { responsive: true, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
        });
    }
    const ctxFases = $("#chart-fases");
    if (ctxFases && !chartFasesInstance) {
        chartFasesInstance = new Chart(ctxFases, {
            type: "bar",
            data: { labels: ["DR1", "DR2", "DR3", "2D", "PS", "Release"], datasets: [{ label: "Media de Concluido (%)", data: [], backgroundColor: ["#0ea5e9", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#ef4444"], borderColor: "#ffffff", borderWidth: 1 }] },
            options: { responsive: true, indexAxis: "y", scales: { x: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%" } }, y: {} }, plugins: { legend: { display: false } } }
        });
    }
    const ctxTrend = $("#chart-trend");
    if (ctxTrend && !chartTrendInstance) {
        chartTrendInstance = new Chart(ctxTrend, {
            type: "line",
            data: { labels: ["DR1", "DR2", "DR3", "2D", "PS", "Release"], datasets: [{ label: "Media por Fase (%)", data: [], tension: 0.35, fill: false }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%" } } } }
        });
    }
    const ctxLinha = $("#chart-linha");
    if (ctxLinha && !chartLinhaInstance) {
        chartLinhaInstance = new Chart(ctxLinha, {
            type: "line",
            data: { labels: [], datasets: [{ label: "Media Geral (%)", data: [], tension: 0.25, fill: false, borderWidth: 2, pointRadius: 2 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
        });
    }
}

export function updateLineChart(state) {
    if (!chartLinhaInstance) return;
    const pid = state.projetoIdAtual || 1;
    const proj = (state.projetos || []).find((p) => p.Id === pid);
    if (!proj || !proj.DataInicio || !proj.DataFim) return;
    const start = new Date(proj.DataInicio);
    const end = new Date(proj.DataFim);
    if (isNaN(start) || isNaN(end)) return;
    let snaps = [];
    try { snaps = window.PS?.snapshots?.list ? PS.snapshots.list(pid) : []; } catch { snaps = []; }
    const dataPoints = snaps.filter((s) => new Date(s.ts) >= start);
    const fmt = (t) => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1}`; };
    chartLinhaInstance.data.labels = dataPoints.map((s) => fmt(s.ts));
    chartLinhaInstance.data.datasets[0].data = dataPoints.map((s) => s.media);
    chartLinhaInstance.options.plugins = chartLinhaInstance.options.plugins || {};
    chartLinhaInstance.options.plugins.title = { display: true, text: `Progresso (Fim Est.: ${formatarData(proj.DataFim)})` };
    chartLinhaInstance.update();
}

export function updateDashboardCharts(state) {
    if (!chartStatusInstance || !chartFasesInstance) return;
    const pid = state.projetoIdAtual || 1;
    const dispositivos = dispositivosDoProjeto(state, pid);
    let counts = { NoPrazo: 0, EmAtraso: 0, EmSimulacao: 0, Concluido: 0, Standby: 0 };
    dispositivos.forEach((d) => { counts[d.StatusManual] = (counts[d.StatusManual] || 0) + 1; });
    chartStatusInstance.data.labels = [
        `No Prazo (${counts.NoPrazo || 0})`,
        `Em Atraso (${counts.EmAtraso || 0})`,
        `Em Simulacao (${counts.EmSimulacao || 0})`,
        `Concluido (${counts.Concluido || 0})`,
        `Standby (${counts.Standby || 0})`
    ];
    chartStatusInstance.data.datasets[0].data = [counts.NoPrazo || 0, counts.EmAtraso || 0, counts.EmSimulacao || 0, counts.Concluido || 0, counts.Standby || 0];
    chartStatusInstance.update();
    let fases = { DR1: 0, DR2: 0, DR3: 0, DoisD: 0, PlanoSequencia: 0, Release: 0 };
    const totalDisp = dispositivos.length;
    if (totalDisp > 0) {
        dispositivos.forEach((d) => {
            fases.DR1 += d.DR1Percentual || 0;
            fases.DR2 += d.DR2Percentual || 0;
            fases.DR3 += d.DR3Percentual || 0;
            fases.DoisD += d.DoisDPercentual || 0;
            fases.PlanoSequencia += d.PlanoSequenciaPercentual || 0;
            fases.Release += d.ReleasePercentual || 0;
        });
        chartFasesInstance.data.datasets[0].data = [
            (fases.DR1 / totalDisp).toFixed(1),
            (fases.DR2 / totalDisp).toFixed(1),
            (fases.DR3 / totalDisp).toFixed(1),
            (fases.DoisD / totalDisp).toFixed(1),
            (fases.PlanoSequencia / totalDisp).toFixed(1),
            (fases.Release / totalDisp).toFixed(1)
        ];
    } else {
        chartFasesInstance.data.datasets[0].data = [0, 0, 0, 0, 0, 0];
    }
    chartFasesInstance.update();
    if (chartTrendInstance) {
        chartTrendInstance.data.datasets[0].data = chartFasesInstance.data.datasets[0].data.slice();
        chartTrendInstance.update();
    }
}

export function renderDashboardData(state) {
    const section = document.getElementById("cs-page-dashboard");
    if (!section) return;
    const pid = state.projetoIdAtual || 1;
    const dispositivos = dispositivosDoProjeto(state, pid);
    let total = 0, prazo = 0, atraso = 0, concluido = 0, standby = 0, simulacao = 0, somaPercent = 0;
    dispositivos.forEach((d) => {
        total++;
        const st = d.StatusManual;
        if (st === StatusManual.Standby) standby++;
        else if (st === StatusManual.Concluido) concluido++;
        else if (st === StatusManual.EmAtraso) atraso++;
        else if (st === StatusManual.EmSimulacao) simulacao++;
        else if (st === StatusManual.NoPrazo) prazo++;
        somaPercent += ((d.DR1Percentual || 0) + (d.DR2Percentual || 0) + (d.DR3Percentual || 0) + (d.DoisDPercentual || 0) + (d.PlanoSequenciaPercentual || 0) + (d.ReleasePercentual || 0)) / 6;
    });
    const media = total > 0 ? somaPercent / total : 0;
    const s = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    s("#dash-kpi-total", total);
    s("#dash-kpi-prazo", prazo);
    s("#dash-kpi-atraso", atraso);
    s("#dash-kpi-concluido", concluido);
    s("#dash-kpi-standby", `Standby: ${standby}`);
    s("#dash-kpi-simulacao", `Em Simulacao: ${simulacao}`);
    const bar = $("#dash-meter-bar"); if (bar) bar.style.width = `${media.toFixed(1)}%`;
    s("#dash-meter-label", `${media.toFixed(1)}%`);
    const body = $("#dash-milestones-table");
    if (body) {
        body.innerHTML = "";
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const classesProj = classesDoProjeto(state, pid);
        const clsIds = new Set(classesProj.map((c) => c.Id));
        const classeMap = new Map(classesProj.map((c) => [c.Id, c]));
        const proximos = Object.values(state.milestones || {}).flat().filter((m) => clsIds.has(m.ClasseId) && new Date(m.Data) >= hoje).sort((a, b) => (a.Data > b.Data ? 1 : -1)).slice(0, 5);
        proximos.forEach((m) => {
            const classe = classeMap.get(m.ClasseId);
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td>${formatarData(m.Data)}</td>
        <td>${classe ? `<span class="badge" style="background:${classe.CorHex};color:#fff;border-color:rgba(0,0,0,.05)">${escapeHtml(classe.Nome)}</span>` : "?"}</td>
        <td>${escapeHtml(m.Nome)} ${m.IsMain ? "(Main)" : ""}</td>
      `;
            body.appendChild(tr);
        });
        if (proximos.length === 0) {
            body.innerHTML = '<tr><td colspan="3"><div class="badge warn">Sem marcos futuros.</div></td></tr>';
        }
    }
    updateDashboardCharts(state);
    updateLineChart(state);
}

export function updateLogoPreview(val) {
    const imgEl = document.getElementById("client-logo-img");
    if (!imgEl) return;
    const logos = {
        fiat: "assets/FIAT_logo.png",
        jeep: "assets/Jeep.svg.png",
        stellantis: "assets/Stellantis-Logo.png",
        vw: "assets/Volkswagen-logo.png",
        comau: "assets/logo_comau_azul.png",
        comau_ball: "assets/Comau_Ball.png"
    };
    if (val && logos[val]) {
        imgEl.src = logos[val];
        imgEl.style.padding = "0";
    } else {
        imgEl.src = "";
    }
}

export function renderSetup(state) {
    const pid = state.projetoIdAtual || 1;
    const proj = (state.projetos || []).find((p) => p.Id === pid);
    const setupPage = document.getElementById("cs-page-setup");
    if (!setupPage) return false;
    let container = document.getElementById("setup-container-wrapper");
    let created = false;
    if (!container) {
        created = true;
        setupPage.innerHTML = `
    <div id="setup-container-wrapper" class="card" style="padding: 30px;">
        <div class="setup-header" style="margin-bottom:30px; border-bottom:1px solid #eee; padding-bottom:15px;">
             <h2 class="app-title" style="font-size:22px;">Setup do Projeto</h2>
             <small class="muted">Definicoes visuais e estruturais</small>
        </div>

        <div class="setup-wrapper">
            <div class="client-logo-container">
                <img id="client-logo-img" class="client-logo-display" src="assets/Comau_Ball.png" alt="Logo Cliente">
                
                <div class="client-logo-select">
                    <label style="font-size:10px; color:#999; text-transform:uppercase; font-weight:bold;">Selecionar Cliente</label>
                    <select id="setup-client-select" class="input" style="width:100%; margin-top:5px; text-align:center;">
                        <option value="">-- Selecione --</option>
                        <option value="fiat">Fiat</option>
                        <option value="jeep">Jeep</option>
                        <option value="stellantis">Stellantis</option>
                        <option value="vw">Volkswagen</option>
                    </select>
                </div>
            </div>

            <div class="project-data-form">
                <div class="grid grid-2">
                    <div class="vertical-input-group">
                        <label>Nome do Projeto</label>
                        <input type="text" id="pd-projeto" placeholder="Ex: Projeto Pulse">
                    </div>
                    <div class="vertical-input-group">
                        <label>Centro de Custo</label>
                        <input type="text" id="pd-cc">
                    </div>
                </div>

                <div class="grid grid-3">
                    <div class="vertical-input-group">
                        <label>Cliente</label>
                        <input type="text" id="pd-cliente">
                    </div>
                    <div class="vertical-input-group">
                        <label>Planta</label>
                        <input type="text" id="pd-planta">
                    </div>
                    <div class="vertical-input-group">
                        <label>Area</label>
                        <input type="text" id="pd-area">
                    </div>
                </div>

                <div class="grid grid-2">
                    <div class="vertical-input-group">
                        <label>Design Leader</label>
                        <input type="text" id="pd-dl">
                    </div>
                    <div class="vertical-input-group">
                        <label>Technical Leader</label>
                        <input type="text" id="pd-tl">
                    </div>
                </div>

                <div style="text-align:right; margin-top:20px;">
                    <button class="btn btn-primary" id="btn-save-project-data" style="padding:10px 24px;">Salvar Alteracoes</button>
                </div>
            </div>
        </div>
    </div>

    <div class="card mt-4">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 class="app-title" style="font-size:16px;">Milestones do Projeto</h3>
            <button class="btn btn-sm ghost" id="btn-toggle-milestone-form">+ Novo</button>
        </div>
        <div id="setup-form-container">
             <div class="grid grid-4" style="background:#f8fafc; padding:12px; border-radius:12px; margin-bottom:12px;">
                 <div><label style="font-size:10px; font-weight:700;">NOME</label><input type="text" id="setup-classe-nome" class="input" style="width:100%"/></div>
                 <div><label style="font-size:10px; font-weight:700;">COR</label><input type="color" id="setup-classe-cor" value="#0D9488" style="width:100%; height:32px;"/></div>
                 <div><label style="font-size:10px; font-weight:700;">DATA BASE</label><input type="date" id="setup-classe-data" class="input" style="width:100%"/></div>
                 <div style="display:flex;align-items:end;gap:4px;">
                    <button class="btn btn-primary btn-sm" id="setup-classe-salvar" style="width:100%">Salvar</button>
                    <button class="btn ghost btn-sm" id="setup-classe-cancelar">X</button>
                 </div>
             </div>
        </div>
        <div class="table-wrap">
             <table class="table"><tbody id="setup-classes-table"></tbody></table>
        </div>
    </div>`;
    }

    if (proj) {
        const info = proj.Info || {};
        const setVal = (id, val) => { const el = $(id); if(el) el.value = val || ""; };
        setVal("#pd-cc", info.CentroCusto);
        setVal("#pd-cliente", info.Cliente);
        setVal("#pd-planta", info.Planta);
        setVal("#pd-projeto", info.ProjetoNome || proj.Nome);
        setVal("#pd-area", info.Area);
        setVal("#pd-dl", info.DesignLeader);
        setVal("#pd-tl", info.TechnicalLeader);
        const logoSel = $("#setup-client-select");
        if(logoSel && info.Logo) {
            logoSel.value = info.Logo;
            updateLogoPreview(info.Logo);
        }
    }

    const tb = $("#setup-classes-table");
    if (tb) {
        tb.innerHTML = "";
        const milestones = (state.classes || []).filter((c) => c.ProjetoId === pid);
        const sum = milestones.reduce((acc, c) => acc + (c.Percentual || 0), 0);
        const avg = milestones.length ? Math.round(sum / milestones.length) : 0;
        const sumEl = $("#setup-sum-percent");
        if (sumEl) sumEl.textContent = `Media Geral do Projeto: ${avg}%`;

        if(milestones.length === 0) {
            tb.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:#cbd5e1;">Nenhum milestone definido.</td></tr>';
        } else {
            milestones.forEach((c) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                        <td><div style="width:10px; height:10px; border-radius:50%; background:${c.CorHex || "#ccc"};"></div></td>
                        <td><strong style="color:#334155;">${escapeHtml(c.Nome)}</strong></td>
                        <td><span class="badge ${c.Percentual >= 100 ? 'ok' : ''}" style="padding:2px 6px; font-size:10px;">${c.Percentual || 0}%</span></td>
                        <td>${formatarData(c.DataBase)}</td>
                        <td style="text-align:right;">
                            <button class="btn btn-icon ghost" data-action="edit-classe" data-id="${c.Id}" style="width:24px; height:24px;">
                                <svg viewBox="0 0 24 24" style="width:12px; height:12px;" fill="none" stroke="currentColor"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                            </button>
                            <button class="btn btn-icon ghost" data-action="delete-classe" data-id="${c.Id}" style="width:24px; height:24px; color:#ef4444;">
                                <svg viewBox="0 0 24 24" style="width:12px; height:12px;" fill="none" stroke="currentColor"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                            </button>
                        </td>
                    `;
                tb.appendChild(tr);
            });
        }
    }
    return created;
}

export function renderDescricaoEvento(state) {
    const container = document.getElementById("desc-evento-lista");
    if (!container) return;
    const pid = state.projetoIdAtual || 1;
    const proj = (state.projetos || []).find((p) => p.Id === pid) || {};
    if (!proj.Checklists) proj.Checklists = {};

    container.innerHTML = "";
    container.className = "grid grid-3";

    ["DR1", "DR2", "DR3"].forEach((fase) => {
        const itens = CHECKLIST_TEMPLATE[fase];
        const col = document.createElement("div");
        col.className = "card";
        col.innerHTML = `
            <div style="border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:12px;">
                <h3 class="app-title" style="font-size:24px; font-weight:800; margin:0;">${fase}</h3>
            </div>
            <div class="checklist-items" style="display:flex; flex-direction:column; gap:8px;">
                ${itens.map((item, idx) => {
                    const key = `${fase}_${idx}`;
                    const checked = proj.Checklists[key] ? "checked" : "";
                    return `
                        <div class="check-row" style="display:flex; align-items:start; gap:8px;">
                            <input type="checkbox" id="chk_${key}" ${checked} 
                                   onchange="window.toggleProjectCheck && window.toggleProjectCheck('${key}')" 
                                   style="margin-top:4px;">
                            <label for="chk_${key}" style="font-size:12px; color:#334155; line-height:1.4;">${item}</label>
                        </div>
                    `;
                }).join("")}
            </div>
            <div class="mt-4 p-2" style="background:#f1f5f9; border-radius:8px; font-size:11px; color:#64748b;">
                <strong>OBS:</strong> Preencher checklist ${fase}
            </div>
        `;
        container.appendChild(col);
    });
}

export function renderDispositivos(state) {
    const grid = document.getElementById("dispositivos-grid");
    if (!grid) return;
    const pid = state.projetoIdAtual || 1;
    const cSel = $("#disp-filtro-classe");
    const tSel = $("#disp-filtro-tipo");
    const nSel = $("#disp-filtro-nivel");
    const buscaEl = $("#disp-filtro-busca");

    const classesProj = classesDoProjeto(state, pid);
    if (cSel && cSel.dataset.pid !== String(pid)) {
        const prev = cSel.value;
        cSel.innerHTML = '<option value="">(todas)</option>' + classesProj.map((c) => `<option value="${c.Id}">${escapeHtml(c.Nome)}</option>`).join("");
        cSel.dataset.pid = String(pid);
        if (prev) cSel.value = prev;
    }
    if (tSel && !tSel.dataset._filled) {
        tSel.innerHTML = '<option value="">(todos)</option>' + tipoOptions.map((t) => `<option value="${t.value}">${t.name}</option>`).join("");
        tSel.dataset._filled = "1";
    }
    if (nSel && !nSel.dataset._filled) {
        nSel.innerHTML = '<option value="">(todos)</option>' + nivelOptions.map((n) => `<option value="${n.value}">${n.name}</option>`).join("");
        nSel.dataset._filled = "1";
    }

    const classeId = cSel && cSel.value ? parseInt(cSel.value) : null;
    const tipoVal = tSel && tSel.value ? parseInt(tSel.value) : null;
    const nivelVal = nSel && nSel.value ? parseInt(nSel.value) : null;
    const busca = (buscaEl?.value || "").toLowerCase();

    let dispositivos = dispositivosDoProjeto(state, pid);
    dispositivos = dispositivos.filter((d) => {
        const okClasse = !classeId || d.ClasseId === classeId;
        const okTipo = !tipoVal || d.Tipo === tipoVal;
        const okNivel = !nivelVal || d.Nivel === nivelVal;
        const okBusca = !busca || (d.Nome || "").toLowerCase().includes(busca) || (d.Tag || "").toLowerCase().includes(busca) || (d.Fornecedor || "").toLowerCase().includes(busca);
        return okClasse && okTipo && okNivel && okBusca;
    });

    grid.innerHTML = "";
    if (!dispositivos.length) {
        grid.innerHTML = '<div class="badge warn" style="grid-column: 1/-1; justify-self: start;">Nenhum dispositivo encontrado com estes filtros.</div>';
        return;
    }

    const clsById = new Map(classesProj.map((c) => [c.Id, c]));
    dispositivos.sort((a, b) => a.Nome.localeCompare(b.Nome)).forEach((d) => {
        const classe = clsById.get(d.ClasseId);
        const m = mediaDisp(d);
        const card = document.createElement("article");
        card.className = "device-card";
        card.innerHTML = `
            <div class="thumb-area">
                <img src="${imgSrc(d)}" alt="Imagem do Dispositivo" loading="lazy">
            </div>
            <div class="content-area">
                <div>
                    <div class="device-tag">${escapeHtml(d.Tag || "SEM TAG")}</div>
                    <div class="device-title" title="${escapeHtml(d.Nome)}">${escapeHtml(d.Nome)}</div>
                </div>
                <div class="device-footer">
                    <span class="badge" style="font-size:10px;">${classe ? escapeHtml(classe.Nome) : "-"}</span>
                    <div class="mini-progress" style="width: 60px; margin:0;">
                         <div class="mini-track"><span class="mini-fill" style="width:${m.toFixed(0)}%"></span></div>
                    </div>
                </div>
            </div>
        `;
        card.addEventListener("click", () => mostrarDetalheDispositivoFull(state, d));
        grid.appendChild(card);
    });
}

export function mostrarDetalheDispositivoFull(state, d) {
    const modal = document.getElementById("dispositivo-modal");
    const backdrop = document.getElementById("dispositivo-modal-backdrop");
    if (!modal || !backdrop) return;
    const classe = classesDoProjeto(state, state.projetoIdAtual || 1).find((c) => c.Id === d.ClasseId);
    const getChartStyle = (pct, color) => `conic-gradient(${color} ${pct}%, #f1f5f9 0)`;
    const cDR1 = d.DR1Percentual >= 100 ? "#22c55e" : "#3b82f6";
    const cDR2 = d.DR2Percentual >= 100 ? "#22c55e" : "#8b5cf6";
    const cDR3 = d.DR3Percentual >= 100 ? "#22c55e" : "#f59e0b";
    const c2D  = d.DoisDPercentual >= 100 ? "#22c55e" : "#ec4899";
    modal.innerHTML = `
        <div class="modal-head">
            <h3 class="app-title" style="margin:0;">Detalhes do Dispositivo</h3>
            <div style="display:flex;gap:8px">
                 <button class="btn btn-primary btn-sm" onclick="window.editDeviceAction && window.editDeviceAction(${d.Id}, ${d.ClasseId})">Editar</button>
                 <button class="btn ghost btn-sm" onclick="window.fecharModalDetalhe && window.fecharModalDetalhe()">Fechar</button>
            </div>
        </div>
        <div class="modal-body" style="overflow-x:hidden;">
            <div style="display:flex; gap:20px; margin-bottom:20px; align-items:center;">
                <div style="width: 80px; height: 80px; border-radius:50%; overflow:hidden; border:3px solid #fff; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
                    <img src="${imgSrc(d)}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div>
                    <h2 style="margin:0; font-size:20px;">${escapeHtml(d.Nome)}</h2>
                    <span class="badge" style="background:#f1f5f9; color:#333;">${escapeHtml(d.Tag)}</span>
                </div>
            </div>

            <h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; color:#94a3b8;">Informacoes Cadastrais</h4>
            <div class="grid grid-3" style="gap:10px; margin-bottom:20px; background:#f8fafc; padding:15px; border-radius:12px;">
                <div class="res-box"><span class="res-label">Linha</span><div class="res-value">${escapeHtml(d.Linha || "-")}</div></div>
                <div class="res-box"><span class="res-label">OP / ST</span><div class="res-value">${escapeHtml(d.OP_ST || "-")}</div></div>
                <div class="res-box"><span class="res-label">Produto</span><div class="res-value">${escapeHtml(d.Produto || "-")}</div></div>
                <div class="res-box"><span class="res-label">Tipo</span><div class="res-value">${escapeHtml(d.TipoSigla || "-")}</div></div>
                <div class="res-box"><span class="res-label">Fornecedor</span><div class="res-value">${escapeHtml(d.Fornecedor || "-")}</div></div>
                <div class="res-box"><span class="res-label">Nivel</span><div class="res-value">${d.Nivel === 4 ? 'Critica' : d.Nivel === 3 ? 'Alta' : 'Media'}</div></div>
            </div>

            <h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; color:#94a3b8;">Status Tecnico</h4>
            <div class="grid grid-4" style="gap:12px;">
                <div class="chart-box">
                    <div class="mini-chart-pie" style="background: ${getChartStyle(d.DR1Percentual, cDR1)}"><div class="mini-chart-value">${d.DR1Percentual}%</div></div>
                    <span style="font-size:11px; font-weight:600;">DR1</span>
                </div>
                <div class="chart-box">
                    <div class="mini-chart-pie" style="background: ${getChartStyle(d.DR2Percentual, cDR2)}"><div class="mini-chart-value">${d.DR2Percentual}%</div></div>
                    <span style="font-size:11px; font-weight:600;">DR2</span>
                </div>
                <div class="chart-box">
                    <div class="mini-chart-pie" style="background: ${getChartStyle(d.DR3Percentual, cDR3)}"><div class="mini-chart-value">${d.DR3Percentual}%</div></div>
                    <span style="font-size:11px; font-weight:600;">DR3</span>
                </div>
                <div class="chart-box">
                    <div class="mini-chart-pie" style="background: ${getChartStyle(d.DoisDPercentual, c2D)}"><div class="mini-chart-value">${d.DoisDPercentual}%</div></div>
                    <span style="font-size:11px; font-weight:600;">2D</span>
                </div>
            </div>
        </div>
    `;
    backdrop.classList.add("show");
    modal.classList.add("show");
    window.fecharModalDetalhe = () => { backdrop.classList.remove("show"); modal.classList.remove("show"); };
    backdrop.onclick = window.fecharModalDetalhe;
    window.editDeviceAction = (id, clsId) => appApi().editDevice?.(id, clsId);
}

export function renderCronograma(state) {
    const startInput = $("#crono-start");
    const endInput = $("#crono-end");
    if (!startInput || !endInput) return;
    const pid = state.projetoIdAtual || 1;
    const classesProj = classesDoProjeto(state, pid);
    const clsIds = new Set(classesProj.map((c) => c.Id));
    const milestonesFlat = Object.values(state.milestones || {}).flat().filter((m) => clsIds.has(m.ClasseId));
    if (!startInput.value || !endInput.value) {
        const datas = milestonesFlat.map((m) => new Date(m.Data));
        if (datas.length) {
            const min = new Date(Math.min(...datas));
            const max = new Date(Math.max(...datas));
            startInput.value = formatarDataInput(new Date(min.setDate(min.getDate() - 7)));
            endInput.value = formatarDataInput(new Date(max.setDate(max.getDate() + 7)));
        } else {
            startInput.value = formatarDataInput(new Date(Date.now() - 30 * 86400000));
            endInput.value = formatarDataInput(new Date(Date.now() + 60 * 86400000));
        }
    }
    const start = new Date(startInput.value);
    const end = new Date(endInput.value);
    const escala = $("#crono-escala")?.value || "semana";
    const ticks = $("#crono-scale-ticks");
    const rows = $("#crono-rows");
    ticks.innerHTML = "";
    rows.innerHTML = "";
    const totalDays = Math.max(1, (end - start) / 86400000);
    const leftPct = (d) => {
        const date = new Date(d);
        if (isNaN(date)) return 0;
        const span = end - start;
        if (span <= 0) return 0;
        const off = date - start;
        const pct = (off / span) * 100;
        return Math.max(0, Math.min(100, pct));
    };
    let d = new Date(start);
    while (d <= end) {
        const tick = document.createElement("div");
        tick.className = "tick";
        let label = "";
        let widthPct = 0;
        if (escala === "dia") {
            label = `${d.getDate()}/${d.getMonth() + 1}`;
            widthPct = (1 / totalDays) * 100;
            d.setDate(d.getDate() + 1);
        } else if (escala === "mes") {
            const dIni = new Date(d);
            const dFim = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            label = `${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
            const dias = (Math.min(end, dFim) - Math.max(start, dIni)) / 86400000 + 1;
            widthPct = (dias / totalDays) * 100;
            d.setMonth(d.getMonth() + 1);
            d.setDate(1);
        } else {
            const dIni = new Date(d);
            const dFim = new Date(d);
            dFim.setDate(d.getDate() + 6);
            label = `${dIni.getDate()}/${dIni.getMonth() + 1}`;
            const dias = (Math.min(end, dFim) - Math.max(start, dIni)) / 86400000 + 1;
            widthPct = (dias / totalDays) * 100;
            d.setDate(d.getDate() + 7);
        }
        tick.style.width = `${widthPct}%`;
        tick.textContent = label;
        ticks.appendChild(tick);
    }
    classesProj.forEach((c) => {
        const row = document.createElement("div");
        row.className = "gantt-row";
        const milestones = state.milestones[c.Id] || [];
        let msHtml = "";
        if (c.DataBase) msHtml += `<div class="base-line" style="left:${leftPct(c.DataBase)}%; background:${c.CorHex || "#999"};"></div>`;
        milestones.forEach((m) => {
            msHtml += `<div class="ms" title="${escapeHtml(m.Nome)} ? ${formatarData(m.Data)}" style="left:${leftPct(m.Data)}%;"><span class="pin ${m.IsMain ? "main" : ""}"></span><span class="label">${escapeHtml(m.Nome)}</span></div>`;
        });
        row.innerHTML = `
      <div class="left">
        <div class="cls"><span class="dot" style="background:${c.CorHex || "#999"};"></span><strong>${escapeHtml(c.Nome)}</strong></div>
        <small class="meta">${c.DataBase ? `Base: ${formatarData(c.DataBase)} ? ` : ""}${c.Percentual}%</small>
      </div>
      <div class="right"><div class="lane">${msHtml}</div></div>
    `;
        rows.appendChild(row);
    });
}

let draggingElement = null;

function createKanbanCard(state, d) {
    const card = document.createElement("article");
    card.className = "kanban-card";
    card.draggable = true;
    card.dataset.id = d.Id;
    const media = mediaDisp(d);
    
    card.innerHTML = `
    <div class="card-head">
      <div class="thumb"><img src="${imgSrc(d)}" alt="thumb"></div>
      <div class="meta">
        <div class="title">${escapeHtml(d.Nome)}</div>
        <small class="subtitle">TAG: ${escapeHtml(d.Tag)}</small>
      </div>
    </div>
    <div class="mini-progress">
      <div class="mini-track"><span class="mini-fill" style="width:${media.toFixed(1)}%"></span></div>
      <span>${media.toFixed(1)}%</span>
    </div>
    <div style="font-size:9px; color:#9ca3af; margin-top:6px; text-align:right;">Toque para mover ou detalhes</div>
  `;

    // Drag para desktop
    card.addEventListener("dragstart", (e) => {
        draggingElement = e.target.closest(".kanban-card");
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => (card.style.opacity = "0.5"), 0);
    });
    card.addEventListener("dragend", () => {
        card.style.opacity = "1";
        draggingElement = null;
    });

    // Clique para mobile/alternativo
    card.addEventListener("click", () => {
        // Se for simulacao, o click será sobrescrito lá
        if (document.getElementById("sim-root")) return;
        showMoveMenu(state, d);
    });

    return card;
}

// Menu de movimento (mobile-friendly)
function showMoveMenu(state, d) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop show";

    const menu = document.createElement("div");
    menu.className = "modal small show";
    menu.style.zIndex = "200";

    const options = [
        { label: "No Prazo", val: "NoPrazo", icon: "🟢" },
        { label: "Em Atraso", val: "EmAtraso", icon: "🔴" },
        { label: "Em Simulação", val: "EmSimulacao", icon: "🔵" },
        { label: "Concluído", val: "Concluido", icon: "✅" },
        { label: "Standby", val: "Standby", icon: "⏸️" }
    ];

    menu.innerHTML = `
        <div class="modal-head">
            <h3 class="app-title" style="margin:0;">Mover: ${escapeHtml(d.Nome)}</h3>
            <button class="btn ghost btn-sm" id="move-close">X</button>
        </div>
        <div class="modal-body">
            <p style="font-size:12px; color:#6b7280; margin-bottom:12px;">
                Status atual: <strong>${d.StatusManual}</strong>. Selecione o novo destino:
            </p>
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${options.map(opt => `
                    <button class="btn" style="justify-content:flex-start; width:100%; ${d.StatusManual === opt.val ? 'border-color:var(--primary); background:#eff6ff;' : ''}" 
                        onclick="window.__moveCard(${d.Id}, '${opt.val}')">
                        <span style="font-size:16px;">${opt.icon}</span> 
                        <span style="flex:1; text-align:left;">${opt.label}</span>
                        ${d.StatusManual === opt.val ? '<span>(Atual)</span>' : ''}
                    </button>
                `).join('')}
            </div>
            <div style="margin-top:16px; border-top:1px solid #eee; padding-top:12px;">
                 <button class="btn ghost" style="width:100%" onclick="window.__editCard(${d.Id}, ${d.ClasseId})">Editar Detalhes</button>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(menu);

    const close = () => { backdrop.remove(); menu.remove(); delete window.__moveCard; delete window.__editCard; };
    backdrop.onclick = close;
    menu.querySelector("#move-close").onclick = close;

    window.__moveCard = (id, newStatus) => {
        if (d.StatusManual !== newStatus) {
            d.StatusManual = newStatus;
            window.showToast?.(`Movido para ${newStatus}`, "ok");
            window.__APP_API?.persistState(true);
            window.__APP_API?.renderKanban();
            window.__APP_API?.renderDashboardData();
            window.__APP_API?.recordSnapshot();
        }
        close();
    };

    window.__editCard = (id, clsId) => {
        close();
        window.__APP_API?.editDevice(id, clsId);
    };
}

export function setupKanbanDropZones(state, root = document) {
    root.querySelectorAll(".kanban-col").forEach((col) => {
        if (col.dataset.dndBound === "1") return;
        col.dataset.dndBound = "1";
        col.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            col.classList.add("over");
        });
        col.addEventListener("dragleave", () => col.classList.remove("over"));
        col.addEventListener("drop", (e) => {
            e.preventDefault();
            col.classList.remove("over");
            if (!draggingElement) return;
            const list = col.querySelector(".kanban-list");
            if (!list) return;
            list.appendChild(draggingElement);
            const id = parseInt(draggingElement.dataset.id);
            const newStatus = col.dataset.status;
            const disp = (state.dispositivos || []).find((x) => x.Id === id);
            if (!disp) return;
            const isSim = newStatus === "liberado" || newStatus === "para-liberar";
            if (isSim) {
                if (newStatus === "liberado") {
                    disp.LiberadoSimulacao = true;
                    disp.StatusManual = StatusManual.Concluido;
                }
                if (newStatus === "para-liberar") {
                    disp.LiberadoSimulacao = false;
                    if (disp.StatusManual === StatusManual.Concluido) disp.StatusManual = StatusManual.EmSimulacao;
                }
                showToast(`Dispositivo #${id} ${disp.LiberadoSimulacao ? "liberado" : "a liberar"} para Simulacao.`, "ok");
                appApi().persistState?.(true);
                appApi().renderSimulacao?.();
                appApi().renderDashboardData?.();
                appApi().recordSnapshot?.();
            } else {
                if (disp.StatusManual !== newStatus) {
                    disp.StatusManual = newStatus;
                    showToast(`Dispositivo #${id} movido para ${newStatus}.`, "ok");
                    appApi().persistState?.(true);
                    appApi().renderKanban?.();
                    appApi().renderDashboardData?.();
                    appApi().renderSimulacao?.();
                    appApi().recordSnapshot?.();
                }
            }
        });
    });
}

export function renderKanban(state) {
    const dispositivos = dispositivosDoProjeto(state, state.projetoIdAtual || 1);
    const cols = {
        NoPrazo: $("#kanban-list-prazo"),
        EmAtraso: $("#kanban-list-atraso"),
        EmSimulacao: $("#kanban-list-simulacao"),
        Concluido: $("#kanban-list-concluido"),
        Standby: $("#kanban-list-standby")
    };
    if (!cols.NoPrazo) return;
    Object.values(cols).forEach((c) => c && (c.innerHTML = ""));
    let counts = { NoPrazo: 0, EmAtraso: 0, EmSimulacao: 0, Concluido: 0, Standby: 0 };
    dispositivos.forEach((d) => {
        const st = d.StatusManual;
        counts[st] = (counts[st] || 0) + 1;
        const target = cols[st];
        if (target) target.appendChild(createKanbanCard(state, d));
    });
    const s = (id, n) => { const el = $(id); if (el) el.textContent = `(${n})`; };
    s("#kanban-label-prazo", counts.NoPrazo || 0);
    s("#kanban-label-atraso", counts.EmAtraso || 0);
    s("#kanban-label-simulacao", counts.EmSimulacao || 0);
    s("#kanban-label-concluido", counts.Concluido || 0);
    s("#kanban-label-standby", counts.Standby || 0);
    setupKanbanDropZones(state, document);
}

export function renderSimulacao(state) {
    const dispositivos = dispositivosDoProjeto(state, state.projetoIdAtual || 1);
    const listParaLiberar = $("#sim-list-liberar");
    const listLiberado = $("#sim-list-liberado");
    const lblLiberar = $("#sim-label-liberar");
    const lblLiberado = $("#sim-label-liberado");
    if (!listParaLiberar || !listLiberado) return;
    listParaLiberar.innerHTML = "";
    listLiberado.innerHTML = "";
    let c1 = 0, c2 = 0;
    dispositivos.forEach((d) => {
        if (d.StatusManual === StatusManual.EmSimulacao || d.StatusManual === StatusManual.Concluido) {
            const card = createKanbanCard(state, d);
            card.onclick = (e) => {
                e.stopPropagation();
                mostrarDetalheSim(state, d);
            };
            if (d.LiberadoSimulacao) {
                listLiberado.appendChild(card); c2++;
            } else { listParaLiberar.appendChild(card); c1++; }
        }
    });
    if (lblLiberar) lblLiberar.textContent = `(${c1})`;
    if (lblLiberado) lblLiberado.textContent = `(${c2})`;
    setupKanbanDropZones(state, document);
}

export function mostrarDetalheSim(state, d) {
    const modal = document.getElementById("sim-detail");
    const backdrop = document.getElementById("sim-detail-backdrop");
    const body = document.getElementById("sim-detail-body");
    if (!modal || !backdrop || !body) return;
    const classe = classesDoProjeto(state, state.projetoIdAtual || 1).find((c) => c.Id === d.ClasseId);
    body.innerHTML = `
      <div class="sim-detail-head" style="display:flex;align-items:center;gap:12px;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="thumb"><img src="${imgSrc(d)}" alt="dispositivo"></div>
          <div>
            <div class="app-title" style="margin:0;">${escapeHtml(d.Nome)}</div>
            <small class="muted">TAG: ${escapeHtml(d.Tag || "-")} - Linha: ${escapeHtml(d.Linha || "-")} - Classe: ${classe ? escapeHtml(classe.Nome) : "-"}</small>
          </div>
        </div>
        <span class="badge ${d.StatusManual === StatusManual.Concluido ? "ok" : d.StatusManual === StatusManual.EmSimulacao ? "primary" : "warn"}">${d.StatusManual || "-"}</span>
      </div>
      <div class="grid grid-2 mt-3">
        <div class="res-box">
          <div class="res-label">Fornecedor</div>
          <div class="res-value">${escapeHtml(d.Fornecedor || "-")}</div>
        </div>
        <div class="res-box">
          <div class="res-label">Produto</div>
          <div class="res-value">${escapeHtml(d.Produto || "-")}</div>
        </div>
        <div class="res-box">
          <div class="res-label">Tipo</div>
          <div class="res-value">${escapeHtml(d.TipoSigla || d.Tipo || "-")}</div>
        </div>
        <div class="res-box">
          <div class="res-label">Nivel</div>
          <div class="res-value">${escapeHtml(d.Nivel || "-")}</div>
        </div>
        <div class="res-box">
          <div class="res-label">Classe</div>
          <div class="res-value">${classe ? escapeHtml(classe.Nome) : "-"}</div>
        </div>
        <div class="res-box">
          <div class="res-label">Status</div>
          <div class="res-value">${escapeHtml(d.StatusManual || "-")}</div>
        </div>
      </div>
      <div class="grid grid-3 mt-3">
        <div class="res-box"><div class="res-label">DR1</div><div class="res-value">${d.DR1Percentual || 0}%</div></div>
        <div class="res-box"><div class="res-label">DR2</div><div class="res-value">${d.DR2Percentual || 0}%</div></div>
        <div class="res-box"><div class="res-label">DR3</div><div class="res-value">${d.DR3Percentual || 0}%</div></div>
        <div class="res-box"><div class="res-label">2D</div><div class="res-value">${d.DoisDPercentual || 0}%</div></div>
        <div class="res-box"><div class="res-label">Plano Seq.</div><div class="res-value">${d.PlanoSequenciaPercentual || 0}%</div></div>
        <div class="res-box"><div class="res-label">Release</div><div class="res-value">${d.ReleasePercentual || 0}%</div></div>
      </div>
    `;
    backdrop.classList.add("show");
    modal.classList.add("show");
    const close = () => { backdrop.classList.remove("show"); modal.classList.remove("show"); };
    backdrop.onclick = close;
    document.getElementById("sim-detail-close")?.addEventListener("click", close, { once: true });
}

export function renderRecurso() {
    const ini = $("#rec-data-inicio");
    const fim = $("#rec-data-fim");
    const hojeISO = new Date().toISOString().split("T")[0];
    if (ini && !ini.value) ini.value = hojeISO;
    if (fim && !fim.value) {
        const d = new Date(); d.setDate(d.getDate() + 14);
        fim.value = formatarDataInput(d);
    }
    appApi().calcularRecurso?.();
}
