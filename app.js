/* @ts-nocheck */
'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const TipoDispositivo = { Mecanico: 0, Eletrico: 1, Software: 2, Ferramental: 3, Outro: 99 };
const NivelPrioridade = { Baixa: 1, Media: 2, Alta: 3, Critica: 4 };
const StatusPrazo = { NoPrazo: "NoPrazo", EmAtraso: "EmAtraso", Concluido: "Concluido", Standby: "Standby" };
const StatusManual = { NoPrazo: "NoPrazo", EmAtraso: "EmAtraso", EmSimulacao: "EmSimulacao", Concluido: "Concluido", Standby: "Standby" };

const tipoOptions = Object.entries(TipoDispositivo).map(([name, value]) => ({ value, name }));
const nivelOptions = Object.entries(NivelPrioridade).map(([name, value]) => ({ value, name }));

const hojeISO = () => new Date().toISOString().split("T")[0];
const PLACEHOLDER_IMG = "https://placehold.co/64x64/EEE/111?text=IMG";

let state = {
    projetoId: 1,
    projetoIdAtual: 1,
    projetos: [],
    classes: [],
    milestones: {},
    dispositivos: [],
    editClasseId: null,
    editMilestoneId: null,
    selectedClasseId: null,
    editDeviceId: null
};

function syncStateFromStore() {
    if (window.PS?.store?.getState) {
        const st = PS.store.getState();
        state.projetoId = st.projetoIdAtual || st.projetoId || state.projetoId || 1;
        state.projetoIdAtual = state.projetoId;
        state.projetos = st.projetos || state.projetos || [];
        state.classes = st.classes || [];
        state.milestones = st.milestones || {};
        state.dispositivos = st.dispositivos || [];
        reviveDates();
    }
}

function getProjetoIdAtual() {
    return state.projetoId || state.projetoIdAtual || 1;
}

function classesDoProjeto(pid = getProjetoIdAtual()) {
    if (window.PS?.utils?.selectClassesByProject) return PS.utils.selectClassesByProject(state, pid);
    return (state.classes || []).filter((c) => (c.ProjetoId || 1) === pid);
}

function dispositivosDoProjeto(pid = getProjetoIdAtual()) {
    if (window.PS?.utils?.selectDispsByProject) return PS.utils.selectDispsByProject(state, pid);
    const clsIds = new Set(classesDoProjeto(pid).map((c) => c.Id));
    return (state.dispositivos || []).filter((d) => clsIds.has(d.ClasseId));
}

function imgSrc(d) {
    return d?.ImagemDataUrl || d?.ImagemPath || PLACEHOLDER_IMG;
}

function mediaDisp(d) {
    return ((d.DR1Percentual || 0) + (d.DR2Percentual || 0) + (d.DR3Percentual || 0) + (d.DoisDPercentual || 0) + (d.PlanoSequenciaPercentual || 0) + (d.ReleasePercentual || 0)) / 6;
}

const fileToDataURL = (file) => new Promise((res, rej) => {
    const fr = new FileReader(); fr.onerror = rej;
    fr.onload = () => res(fr.result);
    fr.readAsDataURL(file);
});

let chartStatusInstance = null;
let chartFasesInstance = null;
let chartLinhaInstance = null;
let chartTrendInstance = null;

let lastSnapshotAt = 0;
function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}
function formatarData(date) {
    if (!date) return "—";
    const d = new Date(date);
    if (isNaN(d)) return "—";
    if (typeof date === "string") d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("pt-BR");
}
function formatarDataInput(date) {
    if (!date) return "";
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

function liveAnnounce(msg) {
    let el = document.getElementById("sr-live");
    if (!el) {
        el = document.createElement("div");
        el.id = "sr-live";
        el.setAttribute("aria-live", "polite");
        el.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(1px,1px,1px,1px);";
        document.body.appendChild(el);
    }
    el.textContent = "";
    setTimeout(() => (el.textContent = msg), 20);
}

function showToast(msg, type = "ok", timeout = 3000) {
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
    liveAnnounce(msg);
}


function runSectionEnter(section) {
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
function enhanceNav() {
    const nav = document.querySelector("nav.top-nav");
    const menu = nav ? nav.querySelector(".menu") : null;
    if (!nav || !menu) return;
    let ink = nav.querySelector(".inkbar");
    if (!ink) {
        ink = document.createElement("span");
        ink.className = "inkbar";
        nav.appendChild(ink);
    }
    const moveInk = (el, animate = true) => {
        if (!el) return;
        const menuRect = menu.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        const left = rect.left - menuRect.left + menu.scrollLeft + 4;
        const width = Math.max(0, rect.width - 8);
        if (!animate) ink.style.transition = "none";
        ink.style.width = width + "px";
        ink.style.transform = `translateX(${left}px)`;
        if (!animate) requestAnimationFrame(() => (ink.style.transition = ""));
    };
    window.SiteUX = { ...(window.SiteUX || {}), moveInk };
    const activeOrFirst = () => menu.querySelector(".nav-link.active") || menu.querySelector(".nav-link");
    setTimeout(() => moveInk(activeOrFirst(), false), 60);
    menu.addEventListener("mouseover", (e) => {
        const el = e.target.closest(".nav-link");
        if (el) moveInk(el);
    });
    menu.addEventListener("focusin", (e) => {
        const el = e.target.closest(".nav-link");
        if (el) moveInk(el);
    });
    menu.addEventListener("mouseleave", () => moveInk(activeOrFirst()));
    menu.addEventListener("focusout", (e) => {
        if (!menu.contains(e.relatedTarget)) moveInk(activeOrFirst());
    });
    window.addEventListener("resize", () => moveInk(activeOrFirst(), false));
}

function calcularStatusPrazo(d) {
    if (d.Standby) return StatusPrazo.Standby;
    const all100 =
        (d.DR1Percentual || 0) >= 100 &&
        (d.DR2Percentual || 0) >= 100 &&
        (d.DR3Percentual || 0) >= 100 &&
        (d.DoisDPercentual || 0) >= 100 &&
        (d.PlanoSequenciaPercentual || 0) >= 100 &&
        (d.ReleasePercentual || 0) >= 100;
    if (d.ReleaseOk || all100) return StatusPrazo.Concluido;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const atrasado = (plan, perc) => {
        if (!plan) return false;
        const pd = new Date(plan);
        pd.setHours(0, 0, 0, 0);
        return pd < hoje && (perc || 0) < 100;
    };
    if (
        atrasado(d.DR1Planejado, d.DR1Percentual) ||
        atrasado(d.DR2Planejado, d.DR2Percentual) ||
        atrasado(d.DR3Planejado, d.DR3Percentual) ||
        atrasado(d.DoisDPlanejado, d.DoisDPercentual) ||
        atrasado(d.PlanoSequenciaPlanejado, d.PlanoSequenciaPercentual) ||
        atrasado(d.ReleasePlanejado, d.ReleasePercentual)
    ) return StatusPrazo.EmAtraso;
    return StatusPrazo.NoPrazo;
}

function snapshotNow() {
    const dispositivos = dispositivosDoProjeto();
    const total = dispositivos.length || 0;
    let soma = 0, f = { DR1: 0, DR2: 0, DR3: 0, DoisD: 0, PlanoSequencia: 0, Release: 0 };
    dispositivos.forEach((d) => {
        soma += ((d.DR1Percentual || 0) + (d.DR2Percentual || 0) + (d.DR3Percentual || 0) + (d.DoisDPercentual || 0) + (d.PlanoSequenciaPercentual || 0) + (d.ReleasePercentual || 0)) / 6;
        f.DR1 += d.DR1Percentual || 0;
        f.DR2 += d.DR2Percentual || 0;
        f.DR3 += d.DR3Percentual || 0;
        f.DoisD += d.DoisDPercentual || 0;
        f.PlanoSequencia += d.PlanoSequenciaPercentual || 0;
        f.Release += d.ReleasePercentual || 0;
    });
    const media = total ? soma / total : 0;
    return {
        ts: Date.now(),
        media,
        DR1: total ? f.DR1 / total : 0,
        DR2: total ? f.DR2 / total : 0,
        DR3: total ? f.DR3 / total : 0,
        DoisD: total ? f.DoisD / total : 0,
        PlanoSequencia: total ? f.PlanoSequencia / total : 0,
        Release: total ? f.Release / total : 0
    };
}
function recordSnapshot(force = false) {
    const now = Date.now();
    if (!force && now - lastSnapshotAt < 60 * 1000) return;
    lastSnapshotAt = now;
    if (window.PS?.snapshots) {
        PS.snapshots.record({ ...state, projetoIdAtual: getProjetoIdAtual() });
    }
    updateLineChart();
}

function gerarDadosDemo() {
    const nowISO = hojeISO();
    state.projetos = state.projetos?.length ? state.projetos : [{ Id: 1, Nome: "Projeto 1", Ativo: true, CriadoEm: nowISO, AtualizadoEm: nowISO }];
    state.projetoId = state.projetoId || 1;
    state.projetoIdAtual = state.projetoId;
    state.classes = [
        { Id: 1, Nome: "DR1", CorHex: "#0ea5e9", Percentual: 30, Horas: 120, ProjetoId: 1, DataBase: new Date(Date.now() + 7 * 86400000) },
        { Id: 2, Nome: "DR2", CorHex: "#22c55e", Percentual: 35, Horas: 160, ProjetoId: 1, DataBase: new Date(Date.now() + 30 * 86400000) },
        { Id: 3, Nome: "DR3", CorHex: "#f59e0b", Percentual: 35, Horas: 200, ProjetoId: 1, DataBase: new Date(Date.now() + 60 * 86400000) }
    ];
    state.milestones = {
        1: [
            { Id: 101, ClasseId: 1, Nome: "DR1.1", Ordem: 1, Data: new Date(Date.now() + 10 * 86400000), IsMain: true },
            { Id: 102, ClasseId: 1, Nome: "DR1.2", Ordem: 2, Data: new Date(Date.now() + 18 * 86400000), IsMain: false }
        ],
        2: [
            { Id: 201, ClasseId: 2, Nome: "DR2.1", Ordem: 1, Data: new Date(Date.now() + 35 * 86400000), IsMain: true },
            { Id: 202, ClasseId: 2, Nome: "DR2.2", Ordem: 2, Data: new Date(Date.now() + 45 * 86400000), IsMain: false }
        ],
        3: [
            { Id: 301, ClasseId: 3, Nome: "DR3.1", Ordem: 1, Data: new Date(Date.now() + 70 * 86400000), IsMain: true }
        ]
    };
    state.dispositivos = [
        { Id: 1, Nome: "Estação 10 - Posicionamento", Tag: "EST10", Tipo: TipoDispositivo.Mecanico, Nivel: NivelPrioridade.Alta, Fornecedor: "Fornecedor A", Linha: "Linha 1", ClasseId: 1, DR1Percentual: 60, DR1Planejado: new Date(Date.now() + 5 * 86400000), DR1Ok: false, DoisDPercentual: 20, PlanoSequenciaPercentual: 10, ReleasePercentual: 0, Standby: false, ImagemPath: "https://placehold.co/64x64/0ea5e9/white?text=EST10" },
        { Id: 2, Nome: "robo Solda A", Tag: "RB-A", Tipo: TipoDispositivo.Software, Nivel: NivelPrioridade.Media, Fornecedor: "Fornecedor B", Linha: "Linha 1", ClasseId: 2, DR2Percentual: 40, DR2Planejado: new Date(Date.now() + 32 * 86400000), DR2Ok: false, DoisDPercentual: 70, PlanoSequenciaPercentual: 30, ReleasePercentual: 0, Standby: false, ImagemPath: "https://placehold.co/64x64/22c55e/white?text=RB-A" },
        { Id: 3, Nome: "Painel Elétrico B", Tag: "PE-B", Tipo: TipoDispositivo.Eletrico, Nivel: NivelPrioridade.Critica, Fornecedor: "Fornecedor C", Linha: "Linha 2", ClasseId: 3, DR3Percentual: 15, DR3Planejado: new Date(Date.now() - 5 * 86400000), DR3Ok: false, DoisDPercentual: 30, PlanoSequenciaPercentual: 15, ReleasePercentual: 5, Standby: false, ImagemPath: "https://placehold.co/64x64/f59e0b/white?text=PE-B" },
        { Id: 4, Nome: "Gabarito C", Tag: "GAB-C", Tipo: TipoDispositivo.Ferramental, Nivel: NivelPrioridade.Baixa, Fornecedor: "Fornecedor D", Linha: "Linha 2", ClasseId: 1, DR1Percentual: 20, DR1Ok: false, Standby: true, ImagemPath: "https://placehold.co/64x64/6b7280/white?text=GAB-C" },
        { Id: 5, Nome: "Esteira D", Tag: "EST-D", Tipo: TipoDispositivo.Mecanico, Nivel: NivelPrioridade.Media, Fornecedor: "Fornecedor E", Linha: "Linha 3", ClasseId: 2, DR2Percentual: 100, DR2Planejado: new Date(Date.now() - 10 * 86400000), DR2Ok: true, DR2Realizado: new Date(Date.now() - 12 * 86400000), PlanoSequenciaPercentual: 100, ReleasePercentual: 100, ReleaseOk: true, Standby: false, ImagemPath: "https://placehold.co/64x64/22c55e/white?text=EST-D" }
    ];
    state.dispositivos.forEach((d) => {
        d.DR1Percentual = d.DR1Percentual || 0;
        d.DR2Percentual = d.DR2Percentual || 0;
        d.DR3Percentual = d.DR3Percentual || 0;
        d.DoisDPercentual = d.DoisDPercentual || 0;
        d.PlanoSequenciaPercentual = d.PlanoSequenciaPercentual || 0;
        d.ReleasePercentual = d.ReleasePercentual || 0;
        d.StatusManual = d.StatusManual || calcularStatusPrazo(d);
        d.LiberadoSimulacao = !!d.LiberadoSimulacao && d.StatusManual === StatusPrazo.Concluido;
        if (!d.FasesAtivas) d.FasesAtivas = { DR1: true, DR2: true, DR3: true, DoisD: true, PlanoSequencia: true, Release: true };
    });
    persistState(true);
    showToast("Dados de exemplo gerados.", "ok");
    renderTodasPaginas();
    renderSimulacao();
    recordSnapshot(true);
}

function reviveDates() {
    state.classes = (state.classes || []).map((c) => ({ ...c, DataBase: c.DataBase ? new Date(c.DataBase) : null }));
    const mm = {};
    Object.keys(state.milestones || {}).forEach((k) => {
        mm[k] = (state.milestones[k] || []).map((m) => ({ ...m, Data: m.Data ? new Date(m.Data) : null }));
    });
    state.milestones = mm;
    state.dispositivos = (state.dispositivos || []).map((d) => {
        const dd = { ...d };
        ["DR1Planejado", "DR1Realizado", "DR2Planejado", "DR2Realizado", "DR3Planejado", "DR3Realizado", "DoisDPlanejado", "DoisDRealizado", "PlanoSequenciaPlanejado", "PlanoSequenciaRealizado", "ReleasePlanejado", "ReleaseRealizado"].forEach((k) => { if (dd[k]) dd[k] = new Date(dd[k]); });
        dd.StatusManual = dd.StatusManual || calcularStatusPrazo(dd);
        dd.LiberadoSimulacao = !!dd.LiberadoSimulacao;
        if (!dd.FasesAtivas) dd.FasesAtivas = { DR1: true, DR2: true, DR3: true, DoisD: true, PlanoSequencia: true, Release: true };
        return dd;
    });
}

function persistMetrics() {
    if (window.PS?.metrics) {
        PS.metrics.recalc(state);
    }
}

function persistState(broadcast = false) {
    if (window.PS?.store) {
        const curr = PS.store.getState ? PS.store.getState() : {};
        const next = {
            ...curr,
            schemaVersion: 2,
            projetoIdAtual: state.projetoId || curr.projetoIdAtual || 1,
            projetos: state.projetos?.length ? state.projetos : (curr.projetos || []),
            classes: state.classes,
            milestones: state.milestones,
            dispositivos: state.dispositivos
        };
        PS.store.setState(next, broadcast);
        syncStateFromStore();
        persistMetrics();
        PS.snapshots?.record(state);
        return;
    }
    try {
        localStorage.setItem("ps:state:v2", JSON.stringify({
            schemaVersion: 2,
            projetoIdAtual: state.projetoId || 1,
            projetos: state.projetos || [],
            classes: state.classes,
            milestones: state.milestones,
            dispositivos: state.dispositivos
        }));
    } catch { }
    persistMetrics();
}

function tryLoadSaved() {
    try {
        if (window.PS?.store) {
            state = PS.store.init();
            state.projetoId = state.projetoIdAtual || state.projetoId || 1;
            state.projetoIdAtual = state.projetoId;
            reviveDates();
            persistMetrics();
            syncStateFromStore();
            return true;
        }
        const raw = localStorage.getItem("ps:state:v2");
        if (!raw) return false;
        const j = JSON.parse(raw);
        state.projetoId = j.projetoIdAtual || j.projetoId || 1;
        state.projetoIdAtual = state.projetoId;
        state.projetos = j.projetos || [];
        state.classes = j.classes || [];
        state.milestones = j.milestones || {};
        state.dispositivos = j.dispositivos || [];
        reviveDates();
        persistMetrics();
        syncStateFromStore();
        return true;
    } catch { return false; }
}

async function carregarEstadoInicial() {
    const loaded = tryLoadSaved();
    if (!loaded) gerarDadosDemo();
    syncStateFromStore();
}

function novoProjeto() {
    const nome = prompt("Nome do novo projeto (obrigatório):")?.trim();
    if (!nome) { showToast("Informe um nome para o projeto.", "err"); return; }
    let id = 1;
    if (window.PS?.store?.createProject) {
        id = PS.store.createProject(nome);
    } else {
        const now = hojeISO();
        const nextId = Math.max(0, ...(state.projetos || []).map((p) => p.Id || 0)) + 1;
        id = nextId;
        state.projetos = [...(state.projetos || []), { Id: nextId, Nome: nome, Ativo: true, CriadoEm: now, AtualizadoEm: now }];
        state.projetoId = nextId;
        state.projetoIdAtual = nextId;
        persistState(true);
    }
    if (window.PS?.store?.selectProject) {
        PS.store.selectProject(id);
    } else {
        state.projetoId = id;
        state.projetoIdAtual = id;
    }
    syncStateFromStore();
    atualizarProjetoSelector();
    renderTodasPaginas();
    showToast(`Projeto "${escapeHtml(nome)}" criado.`, "ok");
}
function abrirModalDispositivo(classeId) {
    syncStateFromStore();
    const projetoAtual = getProjetoIdAtual() || parseInt($("#setup-projeto-id")?.value) || 1;
    const classesProj = classesDoProjeto(projetoAtual);
    if (!classesProj.length) { showToast("Cadastre ao menos uma classe antes de adicionar dispositivo.", "err"); return; }
    state.selectedClasseId = classeId || state.selectedClasseId || classesProj[0].Id;
    state.editDeviceId = null;
    delete window.__dispImageDataUrl;
    const set = (id, v) => { const el = $(id); if (el) el.value = v; };
    ["#modal-disp-nome", "#modal-disp-tag", "#modal-disp-op", "#modal-disp-linha", "#modal-disp-newretooling", "#modal-disp-produto", "#modal-disp-seedtool", "#modal-disp-data2d", "#modal-disp-data-2d"].forEach(id => set(id, ""));
    set("#modal-disp-quant", "1");
    const imgInput = $("#modal-disp-img"); if (imgInput) imgInput.value = "";
    const imgPrev = $("#imgDispositivo-preview"); if (imgPrev) imgPrev.innerHTML = "Sem imagem";
    const tipoSel = $("#modal-disp-tipo");
    if (tipoSel && tipoSel.tagName === "SELECT") tipoSel.innerHTML = tipoOptions.map((t) => `<option value="${t.value}">${t.name}</option>`).join("");
    const nivelSel = $("#modal-disp-nivel");
    if (nivelSel && nivelSel.tagName === "SELECT") nivelSel.innerHTML = nivelOptions.map((n) => `<option value="${n.value}">${n.name}</option>`).join("");
    const chk = (id, v) => { const el = $(id); if (el) el.checked = v; };
    chk("#modal-disp-standby", false);
    chk("#chkPlanoSequencia", false);
    chk("#chk2D", false);
    set("#modal-disp-horas-totais", "0");
    set("#modal-disp-horas-2d", "0");
    $$("#frmInserirDispositivo .dr-group input[type='checkbox']").forEach(el => { el.checked = false; });
    const sel = $("#modal-disp-classes");
    if (sel) {
        sel.innerHTML = classesProj.map((c) => `<option value="${c.Id}" ${c.Id === state.selectedClasseId ? "selected" : ""}>${escapeHtml(c.Nome)}</option>`).join("");
        if (!sel.selectedOptions.length && sel.options.length) sel.options[0].selected = true;
    }
    $("#frmInserirDispositivo-backdrop")?.classList.add("show");
    $("#frmInserirDispositivo")?.classList.add("show");
}
function fecharModalDispositivo() {
    $("#frmInserirDispositivo-backdrop")?.classList.remove("show");
    $("#frmInserirDispositivo")?.classList.remove("show");
}
function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
}
function getNum(id) {
    const v = getVal(id);
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
}
function getBool(id) {
    const el = document.getElementById(id);
    return el ? !!el.checked : false;
}
function salvarModalDispositivo() {
    const nome = $("#modal-disp-nome")?.value?.trim() || getVal("txtNomeDispositivo") || "";
    if (!nome) { showToast("Nome do dispositivo é obrigatório.", "err"); return; }
    const tag = $("#modal-disp-tag")?.value || getVal("txtTagDispositivo") || "";
    const tipo = parseInt($("#modal-disp-tipo")?.value) || parseInt(getVal("txttipo")) || TipoDispositivo.Mecanico;
    const nivel = parseInt($("#modal-disp-nivel")?.value) || parseInt(getVal("txtNiveldePrioridade")) || NivelPrioridade.Media;
    const fornecedor = ($("#modal-disp-fornecedor")?.value || getVal("txtFornecedor") || "").trim();
    const linha = ($("#modal-disp-linha")?.value || getVal("txtLinha") || "").trim();
    const produto = ($("#modal-disp-produto")?.value || getVal("txtProduto") || "").trim();
    const quantidade = parseInt($("#modal-disp-quant")?.value) || getNum("txtQuantidade") || 1;
    const tipoSigla = ($("#modal-disp-tipo")?.value || getVal("txtTipoSigla") || "").toString();
    const op_st = ($("#modal-disp-op")?.value || getVal("txtOP") || getVal("txtOP_ST") || "").toString();
    const seedToolRef = ($("#modal-disp-seedtool")?.value || getVal("txtSeedToolReferencia") || "").toString();
    const newReTooling = ($("#modal-disp-newretooling")?.value || getVal("txtNEWReTooling") || "").toString();
    const standby = getBool("modal-disp-standby");
    const planoSeq = getBool("modal-disp-plano") || getBool("chkPlanoSequencia");
    const tem2d = getBool("modal-disp-2d") || getBool("chk2D");
    const data2d = $("#modal-disp-data2d")?.value ? new Date($("#modal-disp-data2d").value) : null;
    const horasTotais = parseFloat($("#modal-disp-horas-totais")?.value) || 0;
    const horas2d = parseFloat($("#modal-disp-horas-2d")?.value) || 0;
    const classesSelecionadas = Array.from($("#modal-disp-classes")?.selectedOptions || []).map(o => parseInt(o.value)).filter(Boolean);
    const destinoClasses = classesSelecionadas.length ? classesSelecionadas : [state.selectedClasseId].filter(Boolean);
    const checks = {
        SELFASSESSMENT: getBool("chkSELFASSESSMENT"),
        ERGONOMY: getBool("chkERGONOMY"),
        WEDGUNS: getBool("chkWEDGUNS"),
        SCANNER3D: getBool("chkSCANER3D") || getBool("chkSCANNER3D"),
        RPS: getBool("chkRPS"),
        SEQUENCEASBUILT: getBool("chkSEQUECEASBUILT") || getBool("chkSOURCEASBUILT"),
        PRELIMINARYPAYLOAD: getBool("chkPRELIMINARYPAYLOAD") || getBool("chkPRELIMINARYPAYAL"),
        PRODUCT3D: getBool("chkPRODUCT3D"),
        CHECKLISTDR1: getBool("chkCHECKLISTDR1"),
        REMARKSFROMDR1: getBool("chkREMARKSFROMDR1"),
        VALVEBLOCK: getBool("chkVALVEBLOCK"),
        ADVANCEDBILL: getBool("chkADVANCEDBILLOFMATERIAIS") || getBool("chkADVANCEDBILLOFMATERIALS"),
        CHECKLISTDR2: getBool("chkCHECKLISTDR2"),
        REMARKSFROMDR2: getBool("chkREMARKSFROMDR2"),
        FINALPAYLOAD: getBool("chkFINALPAYLOAD"),
        FEA: getBool("chkFEA"),
        FILEFORCONSTRUCTIONQUOTE: getBool("chkFILEFORCONSTRUCTIONQUOTE"),
        CHECKLISTDR3: getBool("chkCHECKLISTDR3")
    };
    const base = {
        Nome: nome,
        Tag: tag,
        Tipo: tipo,
        Nivel: nivel,
        Fornecedor: fornecedor || undefined,
        Linha: linha || undefined,
        Produto: produto || undefined,
        Quantidade: quantidade || undefined,
        TipoSigla: tipoSigla || undefined,
        OP_ST: op_st || undefined,
        SeedToolReferencia: seedToolRef || undefined,
        NEWReTooling: newReTooling || undefined,
        Standby: standby,
        FasesAtivas: {
            DR1: true, DR2: true, DR3: true,
            DoisD: tem2d || true,
            PlanoSequencia: planoSeq || true,
            Release: true
        },
        Checks: checks,
        DR1Percentual: 0, DR2Percentual: 0, DR3Percentual: 0,
        DoisDPercentual: tem2d ? 5 : 0,
        PlanoSequenciaPercentual: planoSeq ? 5 : 0,
        ReleasePercentual: 0,
        Data2D: data2d,
        HorasTotais: horasTotais,
        Horas2D: horas2d,
        ImagemDataUrl: window.__dispImageDataUrl || undefined,
        ImagemPath: undefined,
        LiberadoSimulacao: false
    };
    if (state.editDeviceId) {
        const idx = state.dispositivos.findIndex((d) => d.Id === state.editDeviceId);
        if (idx > -1) {
            const old = state.dispositivos[idx];
            const novo = { ...old, ...base };
            novo.StatusManual = calcularStatusPrazo(novo);
            state.dispositivos[idx] = novo;
        }
        showToast("Dispositivo atualizado.", "ok");
    } else {
        let created = 0;
        destinoClasses.forEach((clsId, i) => {
            const novo = { Id: Date.now() + i, ClasseId: clsId, ...base };
            novo.StatusManual = calcularStatusPrazo(novo);
            state.dispositivos.push(novo);
            created++;
        });
        showToast(`${created} dispositivo(s) salvo(s).`, "ok");
    }
    delete window.__dispImageDataUrl;
    persistState(true);
    fecharModalDispositivo();
    renderTodasPaginas();
    renderSimulacao();
    recordSnapshot();
}

function abrirHorasModal() {
    const tot = $("#modal-disp-horas-totais")?.value || "0";
    const h2d = $("#modal-disp-horas-2d")?.value || "0";
    const mtot = $("#modal-horas-totais");
    const mh2d = $("#modal-horas-2d");
    if (mtot) mtot.value = tot;
    if (mh2d) mh2d.value = h2d;
    $("#horas-modal-backdrop")?.classList.add("show");
    $("#horas-modal")?.classList.add("show");
}
function fecharHorasModal() {
    $("#horas-modal-backdrop")?.classList.remove("show");
    $("#horas-modal")?.classList.remove("show");
}
function salvarHorasModal() {
    const tot = $("#modal-horas-totais")?.value || "0";
    const h2d = $("#modal-horas-2d")?.value || "0";
    if ($("#modal-disp-horas-totais")) $("#modal-disp-horas-totais").value = tot;
    if ($("#modal-disp-horas-2d")) $("#modal-disp-horas-2d").value = h2d;
    showToast("Horas salvas.", "ok");
    fecharHorasModal();
}

function createFaseCard(d, fase) {
    const p = d[`${fase}Percentual`] || 0;
    const ok = d[`${fase}Ok`];
    const plan = d[`${fase}Planejado`];
    const real = d[`${fase}Realizado`];
    const badge = p >= 100 ? "ok" : p > 0 ? "warn" : "err";
    return `
    <div class="fase-card">
      <div class="fase-head">
        <span class="fase-title">${fase}</span>
        <span class="badge ${badge}">${p}%</span>
      </div>
      <div class="fase-body">
        <div class="toggle" title="Marcar ${fase} como OK">
          <input id="${fase}-${d.Id}" type="checkbox" ${ok ? "checked" : ""} data-action="toggle-dr" data-id="${d.Id}" data-fase="${fase}">
          <label for="${fase}-${d.Id}"><span class="knob"></span><span class="txt">${ok ? "Concluido" : "Pendente"}</span></label>
        </div>
        <small class="fase-info">Planejado: ${formatarData(plan)}<br/>Realizado: ${formatarData(real)}</small>
      </div>
    </div>
  `;
}

function renderDescricaoEvento() {
    const container = $("#desc-evento-lista");
    if (!container) return;
    syncStateFromStore();
    const dispositivos = dispositivosDoProjeto();
    container.innerHTML = "";
    dispositivos.forEach((d) => {
        const card = document.createElement("article");
        card.className = "card";
        card.style.padding = "12px";
        card.innerHTML = `
      <header style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="thumb"><img src="${imgSrc(d)}" alt="thumb"></div>
          <div>
            <div style="color:var(--title);font-weight:600;">${escapeHtml(d.Nome)}</div>
            <small style="color:var(--muted);">TAG: ${escapeHtml(d.Tag)} - Linha: ${escapeHtml(d.Linha || "N/A")}</small>
          </div>
        </div>
      </header>
      <div class="grid grid-3">
        ${createFaseCard(d, "DR1")}
        ${createFaseCard(d, "DR2")}
        ${createFaseCard(d, "DR3")}
      </div>
    `;
        container.appendChild(card);
    });
}

function renderDispositivos() {
    const grid = document.getElementById("dispositivos-grid");
    if (!grid) return;
    syncStateFromStore();
    const pid = getProjetoIdAtual();
    const cSel = $("#disp-filtro-classe");
    const tSel = $("#disp-filtro-tipo");
    const nSel = $("#disp-filtro-nivel");
    const buscaEl = $("#disp-filtro-busca");
    const classesProj = classesDoProjeto(pid);

    if (cSel) {
        const prev = cSel.value;
        cSel.innerHTML = '<option value="">(todas)</option>' + classesProj.map((c) => `<option value="${c.Id}">${escapeHtml(c.Nome)}</option>`).join("");
        cSel.dataset.pid = String(pid);
        if (prev && cSel.querySelector(`option[value="${prev}"]`)) cSel.value = prev; else cSel.value = "";
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

    const clsById = new Map(classesProj.map((c) => [c.Id, c]));
    let dispositivos = dispositivosDoProjeto(pid);

    dispositivos = dispositivos.filter((d) => {
        const okClasse = !classeId || d.ClasseId === classeId;
        const okTipo = !tipoVal || d.Tipo === tipoVal;
        const okNivel = !nivelVal || d.Nivel === nivelVal;
        const okBusca =
            !busca ||
            (d.Nome || "").toLowerCase().includes(busca) ||
            (d.Tag || "").toLowerCase().includes(busca) ||
            (d.Fornecedor || "").toLowerCase().includes(busca) ||
            (d.Linha || "").toLowerCase().includes(busca);
        return okClasse && okTipo && okNivel && okBusca;
    });

    grid.innerHTML = "";
    dispositivos
        .sort((a, b) => a.Nome.localeCompare(b.Nome))
        .forEach((d) => {
            const classe = clsById.get(d.ClasseId);
            const m = mediaDisp(d);
            const card = document.createElement("article");
            card.className = "device-card";
            card.innerHTML = `
      <div class="device-head">
        <div class="device-thumb"><img src="${imgSrc(d)}" alt="thumb"></div>
        <div>
          <div class="device-title">${escapeHtml(d.Nome)}</div>
          <div class="device-sub">TAG ${escapeHtml(d.Tag || "-")} - ${classe ? escapeHtml(classe.Nome) : "—"}</div>
        </div>
      </div>
      <div class="device-progress">
        <div class="bar"><span style="width:${m.toFixed(1)}%"></span></div>
        <small>${m.toFixed(1)}%</small>
      </div>
      <div class="device-overlay">
        <strong>Detalhes</strong>
        <small>Fornecedor: ${escapeHtml(d.Fornecedor || "-")}</small>
        <small>Produto: ${escapeHtml(d.Produto || "-")}</small>
        <small>Tipo/Nivel: ${escapeHtml(d.TipoSigla || d.Tipo || "-")} / ${escapeHtml(d.Nivel || "-")}</small>
        <small>2D/PS/Release: ${d.DoisDPercentual || 0}% - ${d.PlanoSequenciaPercentual || 0}% - ${d.ReleasePercentual || 0}%</small>
      </div>
    `;
            grid.appendChild(card);
        });
    if (!dispositivos.length) grid.innerHTML = '<div class="badge warn">Nenhum dispositivo encontrado.</div>';
}
function renderCronograma() {
    const startInput = $("#crono-start");
    const endInput = $("#crono-end");
    if (!startInput || !endInput) return;
    syncStateFromStore();
    const pid = getProjetoIdAtual();
    const classesProj = classesDoProjeto(pid);
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
            msHtml += `<div class="ms" title="${escapeHtml(m.Nome)} — ${formatarData(m.Data)}" style="left:${leftPct(m.Data)}%;"><span class="pin ${m.IsMain ? "main" : ""}"></span><span class="label">${escapeHtml(m.Nome)}</span></div>`;
        });
        row.innerHTML = `
      <div class="left">
        <div class="cls"><span class="dot" style="background:${c.CorHex || "#999"};"></span><strong>${escapeHtml(c.Nome)}</strong></div>
        <small class="meta">${c.DataBase ? `Base: ${formatarData(c.DataBase)} · ` : ""}${c.Percentual}% · ${c.Horas}h</small>
      </div>
      <div class="right"><div class="lane">${msHtml}</div></div>
    `;
        rows.appendChild(row);
    });
}

function initDashboardCharts() {
    if (typeof Chart === "undefined") return;
    Chart.defaults.color = "rgba(55, 65, 81, 0.8)";
    Chart.defaults.font.family = "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, 'Helvetica Neue', Arial";
    Chart.defaults.plugins.legend.position = "bottom";
    const ctxStatus = $("#chart-status");
    if (ctxStatus && !chartStatusInstance) {
        chartStatusInstance = new Chart(ctxStatus, {
            type: "doughnut",
            data: { labels: [], datasets: [{ label: "Status dos Dispositivos", data: [], backgroundColor: ["#f59e0b", "#ef4444", "#2563eb", "#10b981", "#6b7280"], borderColor: "#ffffff", borderWidth: 2 }] },
            options: { responsive: true }
        });
    }
    const ctxFases = $("#chart-fases");
    if (ctxFases && !chartFasesInstance) {
        chartFasesInstance = new Chart(ctxFases, {
            type: "bar",
            data: { labels: ["DR1", "DR2", "DR3", "2D", "PS", "Release"], datasets: [{ label: "Média de Concluido (%)", data: [], backgroundColor: ["#0ea5e9", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#ef4444"], borderColor: "#ffffff", borderWidth: 1 }] },
            options: { responsive: true, indexAxis: "y", scales: { x: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%" } }, y: {} }, plugins: { legend: { display: false } } }
        });
    }
    const ctxTrend = $("#chart-trend");
    if (ctxTrend && !chartTrendInstance) {
        chartTrendInstance = new Chart(ctxTrend, {
            type: "line",
            data: { labels: ["DR1", "DR2", "DR3", "2D", "PS", "Release"], datasets: [{ label: "Média por Fase (%)", data: [], tension: 0.35, fill: false }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%" } } } }
        });
    }
    const ctxLinha = $("#chart-linha");
    if (ctxLinha && !chartLinhaInstance) {
        chartLinhaInstance = new Chart(ctxLinha, {
            type: "line",
            data: { labels: [], datasets: [{ label: "Média Geral (%)", data: [], tension: 0.25, fill: false, borderWidth: 2, pointRadius: 2 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
        });
        updateLineChart();
    }
}

function updateLineChart() {
    if (!chartLinhaInstance) return;
    let snaps = [];
    try {
        snaps = window.PS?.snapshots?.list ? PS.snapshots.list(getProjetoIdAtual()) : [];
    } catch { snaps = []; }
    const last = snaps.slice(-40);
    const fmt = (t) => {
        const d = new Date(t);
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    chartLinhaInstance.data.labels = last.map((s) => fmt(s.ts));
    chartLinhaInstance.data.datasets[0].data = last.map((s) => Number(s.media?.toFixed ? s.media.toFixed(1) : s.media));
    chartLinhaInstance.update();
}

function renderDashboardData() {
    syncStateFromStore();
    const pid = getProjetoIdAtual();
    const dispositivos = dispositivosDoProjeto(pid);
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
        const classesProj = classesDoProjeto(pid);
        const clsIds = new Set(classesProj.map((c) => c.Id));
        const classeMap = new Map(classesProj.map((c) => [c.Id, c]));
        const proximos = Object.values(state.milestones || {}).flat().filter((m) => clsIds.has(m.ClasseId) && new Date(m.Data) >= hoje).sort((a, b) => (a.Data > b.Data ? 1 : -1)).slice(0, 5);
        proximos.forEach((m) => {
            const classe = classeMap.get(m.ClasseId);
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td>${formatarData(m.Data)}</td>
        <td>${classe ? `<span class="badge" style="background:${classe.CorHex};color:#fff;border-color:rgba(0,0,0,.05)">${escapeHtml(classe.Nome)}</span>` : "—"}</td>
        <td>${escapeHtml(m.Nome)} ${m.IsMain ? "(Main)" : ""}</td>
      `;
            body.appendChild(tr);
        });
        if (proximos.length === 0) {
            body.innerHTML = '<tr><td colspan="3"><div class="badge warn">Sem marcos futuros.</div></td></tr>';
        }
    }
    updateDashboardCharts();
    recordSnapshot();
}

function updateDashboardCharts() {
    syncStateFromStore();
    const dispositivos = dispositivosDoProjeto();
    if (!chartStatusInstance || !chartFasesInstance) return;
        let counts = { NoPrazo: 0, EmAtraso: 0, EmSimulacao: 0, Concluido: 0, Standby: 0 };
    dispositivos.forEach((d) => { counts[d.StatusManual] = (counts[d.StatusManual] || 0) + 1; });
    chartStatusInstance.data.labels = [
        `No Prazo (${counts.NoPrazo || 0})`,
        `Em Atraso (${counts.EmAtraso || 0})`,
        `Em Simulacao (${counts.EmSimulacao || 0})`,
        `Concluido (${counts.Concluido || 0})`,
        `Standby (${counts.Standby || 0})`
    ];
    chartStatusInstance.data.datasets[0].data = [
        counts.NoPrazo || 0, counts.EmAtraso || 0, counts.EmSimulacao || 0, counts.Concluido || 0, counts.Standby || 0
    ];
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

let draggingElement = null;

function createKanbanCard(d) {
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
        <small class="subtitle">TAG: ${escapeHtml(d.Tag)} - Linha: ${escapeHtml(d.Linha || "N/A")}</small>
      </div>
    </div>
    <div class="mini-progress">
      <div class="mini-progress-bar" style="width:${media.toFixed(1)}%;"></div>
      <span>${media.toFixed(1)}%</span>
    </div>
  `;
    card.addEventListener("dragstart", (e) => {
        draggingElement = e.target.closest(".kanban-card");
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => (card.style.opacity = "0.5"), 0);
    });
    card.addEventListener("dragend", () => {
        card.style.opacity = "1";
        draggingElement = null;
    });
    return card;
}

function setupKanbanDropZones(root = document) {
    root.querySelectorAll(".kanban-col").forEach((col) => {
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
            const disp = state.dispositivos.find((x) => x.Id === id);
            if (!disp) return;
            if (col.closest("#page-simulacao") || (root.getElementById && root.getElementById("sim-list-liberar"))) {
                if (newStatus === "liberado") {
                    disp.LiberadoSimulacao = true;
                    disp.StatusManual = StatusManual.Concluido;
                }
                if (newStatus === "para-liberar") {
                    disp.LiberadoSimulacao = false;
                    if (disp.StatusManual === StatusManual.Concluido) disp.StatusManual = StatusManual.EmSimulacao;
                }
                showToast(`Dispositivo #${id} ${disp.LiberadoSimulacao ? "liberado" : "a liberar"} para Simulacao.`, "ok");
                persistState(true);
                renderSimulacao();
                renderDashboardData();
                recordSnapshot();
            } else {
                if (disp.StatusManual !== newStatus) {
                    disp.StatusManual = newStatus;
                    showToast(`Dispositivo #${id} movido para ${newStatus}.`, "ok");
                    persistState(true);
                    renderKanban();
                    renderDashboardData();
                    renderSimulacao();
                    recordSnapshot();
                }
            }
        });
    });
}

function renderKanban() {
    syncStateFromStore();
    const dispositivos = dispositivosDoProjeto();
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
        if (target) target.appendChild(createKanbanCard(d));
    });
    const s = (id, n) => { const el = $(id); if (el) el.textContent = `(${n})`; };
    s("#kanban-label-prazo", counts.NoPrazo || 0);
    s("#kanban-label-atraso", counts.EmAtraso || 0);
    s("#kanban-label-simulacao", counts.EmSimulacao || 0);
    s("#kanban-label-concluido", counts.Concluido || 0);
    s("#kanban-label-standby", counts.Standby || 0);
    setupKanbanDropZones(document);
}

function renderSimulacao() {
    syncStateFromStore();
    const dispositivos = dispositivosDoProjeto();
    const listParaLiberar = $("#sim-list-liberar");
    const listLiberado = $("#sim-list-liberado");
    const lblLiberar = $("#sim-label-liberar");
    const lblLiberado = $("#sim-label-liberado");
    if (!listParaLiberar || !listLiberado) return;
    listParaLiberar.innerHTML = "";
    listLiberado.innerHTML = "";
    let c1 = 0, c2 = 0;
    dispositivos.forEach((d) => {
        const card = createKanbanCard(d);
        card.addEventListener("click", () => mostrarDetalheSim(d));
        if (d.StatusManual === StatusManual.EmSimulacao || d.StatusManual === StatusManual.Concluido) {
            if (d.LiberadoSimulacao) {
                listLiberado.appendChild(card);
                c2++;
            } else {
                listParaLiberar.appendChild(card);
                c1++;
            }
        }
    });
    if (lblLiberar) lblLiberar.textContent = `(${c1})`;
    if (lblLiberado) lblLiberado.textContent = `(${c2})`;
    setupKanbanDropZones(document);
}

function renderTodasPaginas() {
    syncStateFromStore();
    atualizarProjetoSelector();
    if ($("#sub-page-setup")) renderSetup();
    if ($("#sub-page-descricaoevento")) renderDescricaoEvento();
    if ($("#sub-page-dispositivos")) renderDispositivos();
    if ($("#sub-page-cronograma")) renderCronograma();
    if ($("#sub-page-dashboard")) {
        if (!chartStatusInstance || !chartFasesInstance || !chartLinhaInstance) initDashboardCharts();
        renderDashboardData();
    }
    if ($("#sub-page-kanban")) renderKanban();
    if ($("#sub-page-recurso")) renderRecurso();
    runSectionEnter(document.querySelector(".sub-page-content.active"));
}

function renderRecurso() {
    const ini = $("#rec-data-inicio");
    const fim = $("#rec-data-fim");
    if (ini && !ini.value) ini.value = hojeISO();
    if (fim && !fim.value) {
        const d = new Date(); d.setDate(d.getDate() + 14);
        fim.value = formatarDataInput(d);
    }
    calcularRecurso();
}

function mostrarDetalheSim(d) {
    const modal = document.getElementById("sim-detail");
    const backdrop = document.getElementById("sim-detail-backdrop");
    const body = document.getElementById("sim-detail-body");
    if (!modal || !backdrop || !body) return;
    syncStateFromStore();
    const classe = classesDoProjeto(getProjetoIdAtual()).find((c) => c.Id === d.ClasseId);
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
function contarDiasUteis(inicio, fim) {
    if (fim < inicio) return 0;
    let c = 0;
    const d = new Date(inicio);
    while (d <= fim) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) c++;
        d.setDate(d.getDate() + 1);
    }
    return c;
}
function calcularRecurso() {
    const horasPlan = parseFloat($("#rec-horas-plan")?.value) || 0;
    const horasDia = parseFloat($("#rec-horas-dia")?.value) || 8;
    const inef = parseFloat($("#rec-ineficiencia")?.value) || 0;
    const start = new Date($("#rec-data-inicio")?.value);
    const end = new Date($("#rec-data-fim")?.value);
    const diasUteis = contarDiasUteis(start, end);
    const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    setText("#rec-dias-uteis", `Dias úteis no período: ${diasUteis}`);
    if (horasDia <= 0 || diasUteis <= 0) {
        setText("#rec-status-msg", "Período ou horas/dia inválidos.");
        setText("#rec-res-horas-ajustadas", "0 h");
        setText("#rec-res-capacidade", "0 h");
        setText("#rec-res-pessoas", "0");
        return;
    }
    const horasAjustadas = horasPlan * (1 + Math.max(0, inef));
    const capacidade = horasDia * diasUteis;
    const pessoas = horasAjustadas / capacidade;
    setText("#rec-res-horas-ajustadas", `${horasAjustadas.toFixed(2)} h`);
    setText("#rec-res-capacidade", `${capacidade.toFixed(2)} h`);
    setText("#rec-res-pessoas", (Math.ceil(pessoas * 100) / 100).toFixed(2));
    setText("#rec-status-msg", "Cálculo atualizado.");
}

function showProjetoMecanicoPage(subPageId) {
    $$(".sub-page-content").forEach((p) => p.classList.remove("active"));
    const target = document.getElementById(`sub-page-${subPageId}`);
    if (target) {
        target.classList.add("active");
        requestAnimationFrame(() => runSectionEnter(target));
    }
    $$("nav.top-nav .nav-link").forEach((a) => a.classList.toggle("active", a.dataset.subPage === subPageId));
    if (window.SiteUX && window.SiteUX.moveInk) window.SiteUX.moveInk($(`nav.top-nav .nav-link[data-sub-page="${subPageId}"]`), false);
    if (subPageId === "setup") renderSetup();
    else if (subPageId === "descricaoevento") renderDescricaoEvento();
    else if (subPageId === "dispositivos") renderDispositivos();
    else if (subPageId === "cronograma") renderCronograma();
    else if (subPageId === "dashboard") renderDashboardData();
    else if (subPageId === "kanban") renderKanban();
    else if (subPageId === "recurso") renderRecurso();
}

function atualizarProjetoSelector() {
    const sel = document.getElementById("projeto-selector");
    if (!sel) return;
    syncStateFromStore();
    const source = window.PS?.store?.getState ? PS.store.getState() : { projetoIdAtual: getProjetoIdAtual(), projetos: state.projetos || [] };
    const { projetoIdAtual, projetos = [] } = source || {};
    sel.innerHTML = projetos
        .filter((p) => p.Ativo !== false)
        .map((p) => `<option value="${p.Id}">${escapeHtml(p.Nome)}</option>`)
        .join("");
    sel.value = String(projetoIdAtual || (projetos[0]?.Id ?? 1));
}

function setProjetoAtual(id) {
    const pid = parseInt(id) || 1;
    if (window.PS?.store?.selectProject) {
        PS.store.selectProject(pid);
        syncStateFromStore();
    } else {
        state.projetoId = pid;
        state.projetoIdAtual = pid;
    }
    state.selectedClasseId = null;
    state.editClasseId = null;
    state.editMilestoneId = null;
    const input = document.getElementById("setup-projeto-id");
    if (input) input.value = pid;
    const sel = document.getElementById("projeto-selector");
    if (sel) {
        sel.value = pid;
    }
    persistState(true);
    atualizarProjetoSelector();
    renderTodasPaginas();
    if (document.querySelector(".sub-page-content")) showProjetoMecanicoPage("setup");
    if (document.getElementById("sim-list-liberar")) renderSimulacao();
}

function renderSetup() {
    syncStateFromStore();
    const tb = $("#setup-classes-table");
    if (!tb) return;
    const projInput = $("#setup-projeto-id");
    if (projInput && !projInput.value) projInput.value = state.projetoId || 1;
    const projetoId = parseInt(projInput?.value) || state.projetoId || 1;
    const sum = (state.classes || []).filter((c) => c.ProjetoId === projetoId).reduce((acc, c) => acc + (c.Percentual || 0), 0);
    const sumBadge = $("#setup-sum-percent");
    if (sumBadge) {
        sumBadge.textContent = `Soma % das Classes: ${sum}%`;
        sumBadge.className = "badge";
        if (sum > 100) sumBadge.classList.add("err");
        else if (sum === 100) sumBadge.classList.add("ok");
        else sumBadge.classList.add("warn");
    }
    tb.innerHTML = "";
    (state.classes || []).filter((c) => c.ProjetoId === projetoId).forEach((c) => {
        const tr = document.createElement("tr");
        const isSelected = state.selectedClasseId === c.Id;
        tr.className = `row-hover ${isSelected ? "row-selected" : ""}`;
        tr.innerHTML = `
            <td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;border:1px solid rgba(0,0,0,.08);background:${c.CorHex || "#888"};"></span></td>
            <td>${escapeHtml(c.Nome)}</td>
            <td>${c.Percentual || 0}%</td>
            <td>${c.Horas || 0}</td>
            <td>${formatarData(c.DataBase)}</td>
            <td>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-sm" data-action="select-classe" data-id="${c.Id}">${isSelected ? "Ocultar" : "Detalhes"}</button>
                    <button class="btn btn-sm" data-action="edit-classe" data-id="${c.Id}">Editar</button>
                    <button class="btn btn-sm" data-action="delete-classe" data-id="${c.Id}">Excluir</button>
                </div>
            </td>
        `;
        tb.appendChild(tr);
        if (isSelected) {
            const ms = (state.milestones[c.Id] || []).length;
            const disp = (state.dispositivos || []).filter((d) => d.ClasseId === c.Id).length;
            const extra = document.createElement("tr");
            extra.className = "hierarchy-row";
            extra.innerHTML = `<td colspan="6" class="hierarchy-cell"><div class="hierarchy-content"><strong>Resumo</strong><div style="margin-top:6px;">Milestones: ${ms} · Dispositivos: ${disp}</div></div></td>`;
            tb.appendChild(extra);
        }
    });
    const msSection = $("#setup-milestones-section");
    if (msSection) {
        if (state.selectedClasseId) {
            msSection.style.display = "block";
            const cls = state.classes.find((c) => c.Id === state.selectedClasseId);
            $("#setup-milestones-title") && ($("#setup-milestones-title").textContent = `Milestones — ${escapeHtml(cls?.Nome || "")}`);
        } else {
            msSection.style.display = "none";
        }
    }
}

function setupFormClasseLimpar() {
    state.editClasseId = null;
    const pid = state.projetoId || parseInt($("#setup-projeto-id")?.value) || 1;
    const today = hojeISO();
    $("#setup-form-classe-title") && ($("#setup-form-classe-title").textContent = "Nova Classe");
    $("#setup-classe-salvar") && ($("#setup-classe-salvar").textContent = "Adicionar");
    $("#setup-classe-nome") && ($("#setup-classe-nome").value = "");
    $("#setup-classe-cor") && ($("#setup-classe-cor").value = "#0D9488");
    $("#setup-classe-percent") && ($("#setup-classe-percent").value = 0);
    $("#setup-classe-horas") && ($("#setup-classe-horas").value = 0);
    $("#setup-classe-data") && ($("#setup-classe-data").value = today);
    $("#setup-classe-projetoid") && ($("#setup-classe-projetoid").value = pid);
    $("#setup-status-classe") && ($("#setup-status-classe").textContent = "");
}

function setupFormClasseSalvar() {
    const nome = $("#setup-classe-nome")?.value?.trim();
    if (!nome) { showToast("Nome da classe é obrigatório.", "err"); return; }
    const cor = $("#setup-classe-cor")?.value || "#0D9488";
    const percent = parseInt($("#setup-classe-percent")?.value) || 0;
    const horas = parseFloat($("#setup-classe-horas")?.value) || 0;
    const data = $("#setup-classe-data")?.value || hojeISO();
    const proj = parseInt($("#setup-classe-projetoid")?.value) || state.projetoId || 1;
    const cls = {
        Id: state.editClasseId || Date.now(),
        Nome: nome,
        CorHex: cor,
        Percentual: percent,
        Horas: horas,
        DataBase: new Date(data),
        ProjetoId: proj
    };
    if (state.editClasseId) {
        const idx = state.classes.findIndex((c) => c.Id === state.editClasseId);
        if (idx > -1) state.classes[idx] = cls;
    } else {
        state.classes.push(cls);
    }
    state.selectedClasseId = null;
    state.editClasseId = null;
    persistState(true);
    renderSetup();
    showToast("Classe salva.", "ok");
    recordSnapshot();
    setupFormClasseLimpar();
}

function setupFormMilestoneLimpar() {
    state.editMilestoneId = null;
    const today = hojeISO();
    $("#setup-ms-salvar") && ($("#setup-ms-salvar").textContent = "Adicionar");
    $("#setup-ms-nome") && ($("#setup-ms-nome").value = "");
    $("#setup-ms-data") && ($("#setup-ms-data").value = today);
    $("#setup-ms-ordem") && ($("#setup-ms-ordem").value = (state.milestones[state.selectedClasseId]?.length || 0) + 1);
    $("#setup-ms-main") && ($("#setup-ms-main").checked = false);
    $("#setup-status-ms") && ($("#setup-status-ms").textContent = "");
}

function setupFormMilestoneSalvar() {
    if (!state.selectedClasseId) { showToast("Selecione uma classe para adicionar milestone.", "err"); return; }
    const nome = $("#setup-ms-nome")?.value?.trim();
    if (!nome) { showToast("Nome do milestone é obrigatório.", "err"); return; }
    const data = $("#setup-ms-data")?.value || hojeISO();
    const ordem = parseInt($("#setup-ms-ordem")?.value) || 0;
    const isMain = $("#setup-ms-main")?.checked || false;
    const novo = {
        Id: state.editMilestoneId || Date.now(),
        ClasseId: state.selectedClasseId,
        Nome: nome,
        Data: new Date(data),
        Ordem: ordem,
        IsMain: isMain
    };
    if (!state.milestones[state.selectedClasseId]) state.milestones[state.selectedClasseId] = [];
    if (state.editMilestoneId) {
        const idx = state.milestones[state.selectedClasseId].findIndex((m) => m.Id === state.editMilestoneId);
        if (idx > -1) state.milestones[state.selectedClasseId][idx] = novo;
    } else {
        state.milestones[state.selectedClasseId].push(novo);
    }
    state.editMilestoneId = null;
    persistState(true);
    renderSetup();
    showToast("Milestone salvo.", "ok");
    recordSnapshot();
    setupFormMilestoneLimpar();
}


function bindGlobalEvents() {
    if (window.__appBound) return;
    window.__appBound = true;

    document.body.addEventListener("click", (e) => {
        const navLink = e.target.closest("a.nav-link[data-sub-page]");
        if (navLink) {
            e.preventDefault();
            showProjetoMecanicoPage(navLink.dataset.subPage);
            return;
        }
        const btn = e.target.closest("button, a");
        if (!btn) return;
        const action = btn.dataset.action;
        if (!action) return;
        if (action === "select-classe") {
            const id = parseInt(btn.dataset.id);
            state.selectedClasseId = state.selectedClasseId === id ? null : id;
            renderSetup();
            if (state.selectedClasseId) setupFormMilestoneLimpar();
        } else if (action === "edit-classe") {
            const id = parseInt(btn.dataset.id);
            const classe = state.classes.find((c) => c.Id === id);
            if (classe) {
                state.editClasseId = classe.Id;
                $("#setup-form-classe-title") && ($("#setup-form-classe-title").textContent = `Editar Classe #${classe.Id}`);
                $("#setup-classe-salvar") && ($("#setup-classe-salvar").textContent = "Salvar");
                $("#setup-classe-nome") && ($("#setup-classe-nome").value = classe.Nome);
                $("#setup-classe-cor") && ($("#setup-classe-cor").value = classe.CorHex);
                $("#setup-classe-percent") && ($("#setup-classe-percent").value = classe.Percentual);
                $("#setup-classe-horas") && ($("#setup-classe-horas").value = classe.Horas);
                $("#setup-classe-data") && ($("#setup-classe-data").value = formatarDataInput(classe.DataBase));
                $("#setup-classe-projetoid") && ($("#setup-classe-projetoid").value = classe.ProjetoId || "");
            }
        } else if (action === "delete-classe") {
            const id = parseInt(btn.dataset.id);
            if (confirm("Tem certeza que quer excluir esta classe?")) {
                state.classes = state.classes.filter((c) => c.Id !== id);
                delete state.milestones[id];
                if (state.selectedClasseId === id) state.selectedClasseId = null;
                persistState(true);
                renderSetup();
                showToast("Classe excluída.", "ok");
                recordSnapshot();
            }
        } else if (action === "add-dispositivo") {
            const id = parseInt(btn.dataset.id);
            abrirModalDispositivo(id);
        }
    });

    document.addEventListener("change", (e) => {
        const el = e.target;
        if (el && el.matches('input[data-action="toggle-dr"]')) {
            const id = parseInt(el.dataset.id);
            const fase = el.dataset.fase;
            const disp = state.dispositivos.find((d) => d.Id === id);
            if (!disp) return;
            const isChecked = el.checked;
            disp[`${fase}Ok`] = isChecked;
            disp[`${fase}Percentual`] = isChecked ? 100 : 0;
            disp[`${fase}Realizado`] = isChecked ? new Date() : null;
            persistState(true);
            renderDescricaoEvento();
            renderDashboardData();
            recordSnapshot();
        }
    });

    $("#setup-recarregar") && $("#setup-recarregar").addEventListener("click", () => { renderSetup(); showToast("Dados recarregados.", "ok"); });
    $("#setup-nova-classe") && $("#setup-nova-classe").addEventListener("click", setupFormClasseLimpar);
    $("#setup-classe-salvar") && $("#setup-classe-salvar").addEventListener("click", setupFormClasseSalvar);
    $("#setup-classe-limpar") && $("#setup-classe-limpar").addEventListener("click", setupFormClasseLimpar);
    $("#setup-milestone-novo") && $("#setup-milestone-novo").addEventListener("click", setupFormMilestoneLimpar);
    $("#setup-ms-salvar") && $("#setup-ms-salvar").addEventListener("click", setupFormMilestoneSalvar);
    $("#setup-ms-limpar") && $("#setup-ms-limpar").addEventListener("click", setupFormMilestoneLimpar);

    $("#btn-add-dispositivo") && $("#btn-add-dispositivo").addEventListener("click", () => abrirModalDispositivo());
    $("#btn-novo-projeto") && $("#btn-novo-projeto").addEventListener("click", (e) => { e.preventDefault(); novoProjeto(); });
    $("#projeto-selector") && $("#projeto-selector").addEventListener("change", (e) => setProjetoAtual(e.target.value));

    $("#modal-disp-fechar") && $("#modal-disp-fechar").addEventListener("click", fecharModalDispositivo);
    $("#frmInserirDispositivo-backdrop") && $("#frmInserirDispositivo-backdrop").addEventListener("click", fecharModalDispositivo);
    $("#modal-disp-salvar") && $("#modal-disp-salvar").addEventListener("click", salvarModalDispositivo);
    $("#modal-disp-horas") && $("#modal-disp-horas").addEventListener("click", abrirHorasModal);
    $("#modal-disp-limpar") && $("#modal-disp-limpar").addEventListener("click", () => abrirModalDispositivo(state.selectedClasseId));
    $("#modal-disp-img") && $("#modal-disp-img").addEventListener("change", async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
            const dataUrl = await fileToDataURL(f);
            const prev = document.getElementById("imgDispositivo-preview");
            if (prev) prev.innerHTML = `<img src="${dataUrl}" alt="preview" style="max-width:100%;border-radius:10px;">`;
            window.__dispImageDataUrl = dataUrl;
        } catch { showToast("Falha ao processar imagem.", "err"); }
    });

    $("#modal-horas-fechar") && $("#modal-horas-fechar").addEventListener("click", fecharHorasModal);
    $("#horas-modal-backdrop") && $("#horas-modal-backdrop").addEventListener("click", fecharHorasModal);
    $("#modal-horas-salvar") && $("#modal-horas-salvar").addEventListener("click", salvarHorasModal);

    $("#disp-filtro-classe") && $("#disp-filtro-classe").addEventListener("change", renderDispositivos);
    $("#disp-filtro-tipo") && $("#disp-filtro-tipo").addEventListener("change", renderDispositivos);
    $("#disp-filtro-nivel") && $("#disp-filtro-nivel").addEventListener("change", renderDispositivos);
    $("#disp-filtro-busca") && $("#disp-filtro-busca").addEventListener("input", renderDispositivos);

    $("#crono-recarregar") && $("#crono-recarregar").addEventListener("click", renderCronograma);

    $("#rec-calcular") && $("#rec-calcular").addEventListener("click", calcularRecurso);

    $("#sim-add-robo") && $("#sim-add-robo").addEventListener("click", () => {
        const nome = $("#sim-robo-nome")?.value || "";
        if (nome) {
            showToast(`Robo "${escapeHtml(nome)}" adicionado (Simulacao).`, "ok");
            $("#sim-robo-nome").value = "";
        } else {
            showToast("Insira um nome para o robo.", "err");
        }
    });

    if (bc) {
        bc.onmessage = (ev) => {
            if (ev?.data?.t === "state:update") {
                if (tryLoadSaved()) {
                    renderTodasPaginas();
                    renderSimulacao();
                    recordSnapshot(true);
                }
            }
        };
    }
    window.addEventListener("storage", (e) => {
        if (e.key === "ps:state") {
            if (tryLoadSaved()) {
                renderTodasPaginas();
                renderSimulacao();
                recordSnapshot(true);
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    enhanceNav();
    bindGlobalEvents();
    initDashboardCharts();
    setupKanbanDropZones(document);
    const isSimPage = !!document.getElementById("sim-list-liberar") || !!document.getElementById("sim-root");
    carregarEstadoInicial().then(() => {
        if (isSimPage) {
            renderSimulacao();
        } else {
            renderTodasPaginas();
            showProjetoMecanicoPage("setup");
        }
    });
});

window.enhanceNav = enhanceNav;
window.initDashboardCharts = initDashboardCharts;
window.setupKanbanDropZones = setupKanbanDropZones;
window.gerarDadosDemo = gerarDadosDemo;
window.renderTodasPaginas = renderTodasPaginas;
window.showProjetoMecanicoPage = showProjetoMecanicoPage;
window.renderDispositivos = renderDispositivos;
window.renderCronograma = renderCronograma;
window.calcularRecurso = calcularRecurso;
window.fecharModalDispositivo = fecharModalDispositivo;
window.salvarModalDispositivo = salvarModalDispositivo;
window.fecharHorasModal = fecharHorasModal;
window.salvarHorasModal = salvarHorasModal;
window.setupFormClasseLimpar = setupFormClasseLimpar;
window.setupFormClasseSalvar = setupFormClasseSalvar;
window.setupFormMilestoneLimpar = setupFormMilestoneLimpar;
window.setupFormMilestoneSalvar = setupFormMilestoneSalvar;
window.renderSetup = renderSetup;
window.renderSimulacao = renderSimulacao;



























