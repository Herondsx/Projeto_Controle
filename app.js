/* @ts-nocheck */
'use strict';

import * as View from './views.js';

const {
    $, $$,
    TipoDispositivo, NivelPrioridade, StatusPrazo, StatusManual,
    tipoOptions, nivelOptions,
    escapeHtml, formatarDataInput,
    showToast, runSectionEnter
} = View;

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

const hojeISO = () => new Date().toISOString().split("T")[0];

// Estado global
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

const PAGE_TRANSITION_MS = 420;
const ENABLE_EXPANDO = false;
let currentProjetoPage = "setup";
let isTransitioningPage = false;
let lastSnapshotAt = 0;
const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("ps:bus") : null;

// Helpers de dados
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

const fileToDataURL = (file) => new Promise((res, rej) => {
    const fr = new FileReader(); fr.onerror = rej;
    fr.onload = () => res(fr.result);
    fr.readAsDataURL(file);
});

function initCorporateSplash() {
    const overlay = document.getElementById("splash-overlay");
    if (!overlay) return;
    try {
        if (sessionStorage.getItem("ps:splash:seen") === "1") {
            overlay.parentNode && overlay.parentNode.removeChild(overlay);
            return;
        }
        sessionStorage.setItem("ps:splash:seen", "1");
    } catch { }
    const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
        overlay.parentNode && overlay.parentNode.removeChild(overlay);
        return;
    }
    setTimeout(() => {
        overlay.classList.add("splash-hide");
        setTimeout(() => {
            overlay.parentNode && overlay.parentNode.removeChild(overlay);
        }, 500);
    }, 1200);
}

function clearAllData() {
    if(!confirm("ATENCAO: Isso apagará TODOS os projetos, milestones e dispositivos. Deseja continuar?")) return;
    Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("ps:")) localStorage.removeItem(k);
    });
    sessionStorage.clear();
    state = { projetoId: 0, projetoIdAtual: 0, projetos: [], classes: [], milestones: {}, dispositivos: [] };
    window.location.reload();
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
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const atrasado = (plan, perc) => {
        if (!plan) return false;
        const pd = new Date(plan); pd.setHours(0, 0, 0, 0);
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
    View.updateLineChart(state);
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
    state.dispositivos = [];
    persistState(true);
    showToast("Dados de exemplo gerados.", "ok");
    renderTodasPaginas();
    renderSimulacao();
    recordSnapshot(true);
}

function reviveDates() {
    state.projetos = (state.projetos || []).map((p) => ({
        ...p,
        DataInicio: p.DataInicio ? new Date(p.DataInicio) : p.DataInicio,
        DataFim: p.DataFim ? new Date(p.DataFim) : p.DataFim
    }));
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
    if (!loaded) {
        state.projetos = [];
        state.classes = [];
        state.milestones = {};
        state.dispositivos = [];
        persistState();
    }
    syncStateFromStore();
}

/* --- CORREÇÃO: Criação de Projeto Sincronizada --- */
function novoProjeto() {
    let newId;

    // 1. Usa o Bridge para criar (Garante consistência do ID e Salvamento)
    if (window.PS && PS.store && PS.store.createProject) {
        newId = PS.store.createProject("Novo Projeto");
        syncStateFromStore();
    } else {
        // Fallback manual
        const now = hojeISO();
        newId = 1;
        if (state.projetos && state.projetos.length > 0) {
            newId = Math.max(...state.projetos.map(p => p.Id)) + 1;
        }
        const novo = {
            Id: newId,
            Nome: `Novo Projeto ${newId}`,
            Ativo: true,
            CriadoEm: now,
            AtualizadoEm: now,
            Info: { ProjetoNome: "" }
        };
        state.projetos = [...(state.projetos || []), novo];
        persistState(true);
    }

    // 2. Garante Info limpa
    const proj = state.projetos.find(p => p.Id === newId);
    if (proj) {
        proj.Info = { ProjetoNome: "", CentroCusto: "", Cliente: "", Planta: "", Area: "" };
        persistState(false);
    }

    // 3. Seleciona e navega
    setProjetoAtual(newId);
    if (location.hash !== "#status") {
        location.hash = "#status";
    }
    setTimeout(() => {
        showProjetoMecanicoPage("setup", { force: true });
        const inputNome = document.getElementById("pd-projeto");
        if (inputNome) inputNome.focus();
    }, 100);

    showToast("Projeto criado! Preencha os dados.", "ok");
}

function verificarProjetoExistente(force = false) {
    syncStateFromStore();
    const temProjetos = (state.projetos || []).length > 0;
    if (!temProjetos) {
        novoProjeto();
    }
}

function abrirModalDispositivo(classeId) {
    syncStateFromStore();
    const pid = getProjetoIdAtual();
    const proj = state.projetos.find(p => p.Id === pid);
    const classesProj = classesDoProjeto(pid);
    if (!classesProj.length) { showToast("Cadastre ao menos um Milestone antes.", "err"); return; }
    state.selectedClasseId = classeId || state.selectedClasseId || classesProj[0].Id;
    state.editDeviceId = null;
    delete window.__dispImageDataUrl;

    const imgEmpresa = document.getElementById("modal-img-empresa");
    const imgCliente = document.getElementById("modal-img-cliente");
    if(imgEmpresa) imgEmpresa.src = "assets/logo_comau_azul.png";
    const logos = { "fiat": "assets/FIAT_logo.png", "jeep": "assets/Jeep.svg.png", "stellantis": "assets/Stellantis-Logo.png", "vw": "assets/Volkswagen-logo.png" };
    const clienteKey = proj?.Info?.Logo || "";
    if(imgCliente) imgCliente.src = logos[clienteKey] || "";

    const set = (id, v) => { const el = $(id); if (el) el.value = v; };
    ["#modal-disp-nome", "#modal-disp-tag", "#modal-disp-op", "#modal-disp-linha", "#modal-disp-newretooling", "#modal-disp-produto", "#modal-disp-seedtool", "#modal-disp-data-2d", "#modal-disp-tiposigla"].forEach(id => set(id, ""));
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

const getVal = (id) => document.getElementById(id)?.value || "";
const getNum = (id) => { const n = parseFloat(getVal(id)); return isNaN(n) ? 0 : n; };
const getBool = (id) => !!document.getElementById(id)?.checked;

function salvarModalDispositivo() {
    const nome = $("#modal-disp-nome")?.value?.trim() || getVal("txtNomeDispositivo") || "";
    if (!nome) { showToast("Nome do dispositivo é obrigatório.", "err"); return; }
    const tag = $("#modal-disp-tag")?.value || getVal("txtTagDispositivo") || "";
    const tipo = parseInt($("#modal-disp-tipo")?.value) || TipoDispositivo.Mecanico;
    const nivel = parseInt($("#modal-disp-nivel")?.value) || NivelPrioridade.Media;
    const fornecedor = ($("#modal-disp-fornecedor")?.value || getVal("txtFornecedor") || "").trim();
    const linha = ($("#modal-disp-linha")?.value || getVal("txtLinha") || "").trim();
    const produto = ($("#modal-disp-produto")?.value || getVal("txtProduto") || "").trim();
    const quantidade = parseInt($("#modal-disp-quant")?.value) || getNum("txtQuantidade") || 1;
    const tipoSigla = ($("#modal-disp-tiposigla")?.value || "").toString().trim();
    const op_st = ($("#modal-disp-op")?.value || getVal("txtOP") || getVal("txtOP_ST") || "").toString();
    const seedToolRef = ($("#modal-disp-seedtool")?.value || getVal("txtSeedToolReferencia") || "").toString();
    const newReTooling = ($("#modal-disp-newretooling")?.value || getVal("txtNEWReTooling") || "").toString();
    const standby = getBool("modal-disp-standby");
    const planoSeq = getBool("modal-disp-plano") || getBool("chkPlanoSequencia");
    const tem2d = getBool("modal-disp-2d") || getBool("chk2D");
    const data2d = $("#modal-disp-data-2d")?.value ? new Date($("#modal-disp-data-2d").value) : null;
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
        FasesAtivas: { DR1: true, DR2: true, DR3: true, DoisD: !!tem2d, PlanoSequencia: !!planoSeq, Release: true },
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
    $("#modal-horas-totais") && ($("#modal-horas-totais").value = tot);
    $("#modal-horas-2d") && ($("#modal-horas-2d").value = h2d);
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

function setupFormClasseLimpar() {
    state.editClasseId = null;
    const today = hojeISO();
    $("#setup-form-classe-title") && ($("#setup-form-classe-title").textContent = "Novo Milestone");
    $("#setup-classe-salvar") && ($("#setup-classe-salvar").textContent = "Adicionar");
    $("#setup-classe-nome") && ($("#setup-classe-nome").value = "");
    $("#setup-classe-cor") && ($("#setup-classe-cor").value = "#0D9488");
    $("#setup-classe-percent") && ($("#setup-classe-percent").value = 0);
    $("#setup-classe-data") && ($("#setup-classe-data").value = today);
    $("#setup-status-classe") && ($("#setup-status-classe").textContent = "");
}

function setupFormClasseSalvar() {
    const nome = $("#setup-classe-nome")?.value?.trim();
    if (!nome) { showToast("Nome do milestone é obrigatorio.", "err"); return; }
    const cor = $("#setup-classe-cor")?.value || "#0D9488";
    const percent = parseInt($("#setup-classe-percent")?.value) || 0;
    const data = $("#setup-classe-data")?.value || hojeISO();
    const proj = getProjetoIdAtual();
    const cls = { Id: state.editClasseId || Date.now(), Nome: nome, CorHex: cor, Percentual: percent, Horas: 0, DataBase: new Date(data), ProjetoId: proj };
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
    showToast("Milestone salvo.", "ok");
    recordSnapshot();
    setupFormClasseLimpar();
    $("#setup-form-container")?.classList.remove("open");
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
    const novo = { Id: state.editMilestoneId || Date.now(), ClasseId: state.selectedClasseId, Nome: nome, Data: new Date(data), Ordem: ordem, IsMain: isMain };
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

// Navegação entre abas internas
const TAB_ORDER = ["setup", "descricaoevento", "dispositivos", "cronograma", "dashboard", "kanban", "recurso"];
const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function tabDirection(from, to) {
    const a = TAB_ORDER.indexOf(from);
    const b = TAB_ORDER.indexOf(to);
    if (a === -1 || b === -1) return "forward";
    return b < a ? "back" : "forward";
}

function clearTabAnimClasses(el) {
    if (!el) return;
    el.classList.remove(
        "is-animating",
        "was-active",
        "enter-from-right",
        "enter-from-left",
        "exit-to-left",
        "exit-to-right"
    );
}

function renderSetup() {
    const created = View.renderSetup(state);
    if (created) rebindSetupEvents();
}
function renderDescricaoEvento() { View.renderDescricaoEvento(state); }
function renderDispositivos() { View.renderDispositivos(state); }
function renderCronograma() { View.renderCronograma(state); }
function renderDashboardData() { View.renderDashboardData(state); }
function renderKanban() { View.renderKanban(state); }
function renderSimulacao() { View.renderSimulacao(state); }
function renderRecurso() { View.renderRecurso(state); }

function renderTodasPaginas() {
    syncStateFromStore();
    atualizarProjetoSelector();
    if ($("#cs-page-setup")) renderSetup();
    if ($("#cs-page-descricaoevento")) renderDescricaoEvento();
    if ($("#cs-page-dispositivos")) renderDispositivos();
    if ($("#cs-page-cronograma")) renderCronograma();
    if (document.querySelector("#cs-page-dashboard.page.active")) {
        View.initDashboardCharts();
        renderDashboardData();
    }
    if ($("#cs-page-kanban")) renderKanban();
    if ($("#cs-page-recurso")) renderRecurso();
    if ($("#cs-page-simulacao")) renderSimulacao();
    const activePageEl = document.querySelector(".cs-pages .page.active") || document.querySelector(".page.active");
    if (activePageEl?.dataset?.page) currentProjetoPage = activePageEl.dataset.page;
}

function rebindSetupEvents() {
    $("#btn-save-project-data")?.addEventListener("click", salvarDadosProjeto);
    $("#setup-client-select")?.addEventListener("change", (e) => View.updateLogoPreview(e.target.value));
    $("#btn-toggle-milestone-form")?.addEventListener("click", () => {
        const form = $("#setup-form-container");
        if(form) {
            form.classList.add("open");
            setupFormClasseLimpar();
        }
    });
    $("#setup-classe-cancelar")?.addEventListener("click", () => {
        $("#setup-form-container")?.classList.remove("open");
    });
    $("#setup-classe-salvar")?.addEventListener("click", setupFormClasseSalvar);
}

function salvarDadosProjeto() {
    syncStateFromStore();
    const pid = getProjetoIdAtual();
    const proj = (state.projetos || []).find((p) => p.Id === pid);
    if (!proj) return;

    const nomeInput = document.getElementById("pd-projeto");
    const novoNome = nomeInput?.value?.trim() || `Projeto ${pid}`;

    const info = {
        CentroCusto: document.getElementById("pd-cc")?.value,
        Cliente: document.getElementById("pd-cliente")?.value,
        Planta: document.getElementById("pd-planta")?.value,
        ProjetoNome: novoNome,
        Area: document.getElementById("pd-area")?.value,
        DesignLeader: document.getElementById("pd-dl")?.value,
        TechnicalLeader: document.getElementById("pd-tl")?.value,
        Logo: document.getElementById("setup-client-select")?.value
    };

    proj.Info = info;
    proj.Nome = novoNome;

    persistState(true);
    atualizarProjetoSelector();
    showToast("Dados do projeto e Nome atualizados!", "ok");
}

function showProjetoMecanicoPage(target, opts = {}) {
    const { animate = true, force = false } = opts;
    if (!target) return;

    if (isTransitioningPage) {
        if (Date.now() - (window._lastNavTime || 0) > 600) {
            isTransitioningPage = false;
        } else {
            return;
        }
    }
    window._lastNavTime = Date.now();

    if (!force && (target === currentProjetoPage || isTransitioningPage)) return;

    const container = document.getElementById("cs-pages");
    const incoming = container?.querySelector(`.page[data-page="${target}"]`) || document.querySelector(`.page[data-page="${target}"]`);
    const outgoing = container?.querySelector(`.page[data-page="${currentProjetoPage}"]`) || document.querySelector(`.page[data-page="${currentProjetoPage}"]`);

    if (!incoming) return;
    isTransitioningPage = true;

    $$("nav.top-nav .nav-link").forEach((a) => {
        const active = a.dataset.subPage === target;
        a.classList.toggle("active", active);
        if (active) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
    });
    if (window.SiteUX?.moveInk) window.SiteUX.moveInk($(`nav.top-nav .nav-link[data-sub-page="${target}"]`), false);

    const pageEl = document.getElementById(`cs-page-${target}`);
    const needsRender = force || (pageEl && pageEl.dataset.rendered !== "true");

    if (needsRender) {
        if (target === "setup") renderSetup();
        else if (target === "descricaoevento") renderDescricaoEvento();
        else if (target === "dispositivos") renderDispositivos();
        else if (target === "cronograma") renderCronograma();
        else if (target === "dashboard") { View.initDashboardCharts(); renderDashboardData(); }
        else if (target === "kanban") renderKanban();
        else if (target === "recurso") renderRecurso();
        if(pageEl) pageEl.dataset.rendered = "true"; 
    }

    try { PS?.utils?.setLastTab?.(getProjetoIdAtual(), target); } catch { }

    const reduced = !animate || prefersReducedMotion();

    if (reduced || !outgoing || outgoing === incoming) {
        clearTabAnimClasses(outgoing);
        clearTabAnimClasses(incoming);
        container?.querySelectorAll(".page.active").forEach((p) => p !== incoming && p.classList.remove("active"));
        incoming.classList.add("active");
        incoming.setAttribute("aria-hidden", "false");
        outgoing?.setAttribute("aria-hidden", "true");
        currentProjetoPage = target;
        isTransitioningPage = false;
        if (needsRender) runSectionEnter(incoming);
        return;
    }

    const dir = tabDirection(currentProjetoPage, target);
    const enterClass = dir === "back" ? "enter-from-left" : "enter-from-right";
    const exitClass = dir === "back" ? "exit-to-right" : "exit-to-left";

    clearTabAnimClasses(incoming);
    clearTabAnimClasses(outgoing);

    outgoing.classList.remove("active");
    outgoing.classList.add("was-active", "is-animating");
    outgoing.setAttribute("aria-hidden", "true");

    incoming.classList.add("is-animating", enterClass);
    incoming.setAttribute("aria-hidden", "false");

    void incoming.offsetWidth; 

    requestAnimationFrame(() => {
        incoming.classList.add("active");
        incoming.classList.remove(enterClass);
        outgoing.classList.add(exitClass);
    });

    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        clearTabAnimClasses(outgoing);
        clearTabAnimClasses(incoming);
        outgoing.classList.remove("active");
        incoming.classList.add("active");
        currentProjetoPage = target;
        isTransitioningPage = false;
        if (needsRender) runSectionEnter(incoming);
    };

    const FAILSAFE_MS = 500;
    const t = setTimeout(() => {
        finish();
        incoming.classList.remove("is-animating");
        outgoing.classList.remove("is-animating");
    }, FAILSAFE_MS);

    const onEnd = (e) => {
        if (!e || e.target !== incoming) return;
        if (e.propertyName && e.propertyName !== "transform") return;
        clearTimeout(t);
        incoming.removeEventListener("transitionend", onEnd);
        finish();
    };
    incoming.addEventListener("transitionend", onEnd, { once: true });
}

function atualizarProjetoSelector() {
    const triggerLabel = document.getElementById("project-trigger-label");
    const menuList = document.getElementById("project-menu-list");
    const wrapper = document.getElementById("project-dropdown-wrapper");

    if (wrapper) {
        wrapper.style.display = (location.hash === "#home" || !location.hash) ? "none" : "inline-block";
    }

    if (!triggerLabel || !menuList) return;

    syncStateFromStore();
    const pid = getProjetoIdAtual();
    const projetos = (state.projetos || []).filter(p => p.Ativo !== false);
    const atual = projetos.find(p => p.Id === pid) || projetos[0];
    triggerLabel.textContent = atual ? atual.Nome : "Selecione...";

    menuList.innerHTML = projetos.map(p => {
        const isActive = p.Id === pid;
        return `
            <button class="dropdown-item ${isActive ? 'active' : ''}" onclick="window.selectProjectFromMenu(${p.Id})">
                <span>${View.escapeHtml(p.Nome)}</span>
                ${isActive ? '<svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
            </button>
        `;
    }).join("");
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
    const sel = document.getElementById("projeto-selector");
    if (sel) sel.value = pid;
    persistState(true);
    atualizarProjetoSelector();
    renderTodasPaginas();
    if (document.querySelector(".cs-pages .page")) showProjetoMecanicoPage("setup");
    if (document.getElementById("sim-list-liberar")) renderSimulacao();
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

function renderHubKPIs() {
    const raw = localStorage.getItem("ps:metrics:v2") || localStorage.getItem("ps:metrics") || "{}";
    let m = {};
    try { m = JSON.parse(raw); } catch { m = {}; }
    const p = document.getElementById("hub-kpi-projetos");
    const d = document.getElementById("hub-kpi-dispositivos");
    const mar = document.getElementById("hub-kpi-marcos");
    if (p) p.textContent = String(m.projetos ?? 0);
    if (d) d.textContent = String(m.dispositivos ?? 0);
    if (mar) mar.textContent = String(m.marcos ?? 0);
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
        if (btn.id === "btn-clear-dados") {
            e.preventDefault();
            if (confirm("Tem certeza? Isso apaga tudo e reinicia o hub.")) {
                clearAllData();
                setTimeout(() => window.location.reload(), 500);
            }
            return;
        }
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
                $("#setup-form-classe-title") && ($("#setup-form-classe-title").textContent = `Editar Milestone #${classe.Id}`);
                $("#setup-classe-salvar") && ($("#setup-classe-salvar").textContent = "Salvar");
                $("#setup-classe-nome") && ($("#setup-classe-nome").value = classe.Nome);
                $("#setup-classe-cor") && ($("#setup-classe-cor").value = classe.CorHex);
                $("#setup-classe-percent") && ($("#setup-classe-percent").value = classe.Percentual);
                $("#setup-classe-data") && ($("#setup-classe-data").value = formatarDataInput(classe.DataBase));
                const form = $("#setup-form-container");
                if (form) form.classList.add("open");
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
            const idRaw = btn.dataset.id;
            const id = idRaw ? parseInt(idRaw) : NaN;
            const fallback = parseInt($("#disp-filtro-classe")?.value || "");
            abrirModalDispositivo(Number.isFinite(id) ? id : (Number.isFinite(fallback) ? fallback : null));
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

    $("#setup-classe-salvar") && $("#setup-classe-salvar").addEventListener("click", setupFormClasseSalvar);
    $("#btn-save-project-data") && $("#btn-save-project-data").addEventListener("click", salvarDadosProjeto);
    $("#setup-client-select") && $("#setup-client-select").addEventListener("change", (e) => View.updateLogoPreview(e.target.value));
    $("#btn-toggle-milestone-form") && $("#btn-toggle-milestone-form").addEventListener("click", () => {
        const form = $("#setup-form-container");
        if (form) {
            form.classList.add("open");
            setupFormClasseLimpar();
            $("#setup-classe-nome")?.focus();
        }
    });
    $("#setup-classe-cancelar") && $("#setup-classe-cancelar").addEventListener("click", () => {
        const form = $("#setup-form-container");
        if (form) form.classList.remove("open");
    });
    $("#setup-milestone-novo") && $("#setup-milestone-novo").addEventListener("click", setupFormMilestoneLimpar);
    $("#btn-app-reload") && $("#btn-app-reload").addEventListener("click", () => window.location.reload());

    $("#btn-add-dispositivo") && $("#btn-add-dispositivo").addEventListener("click", () => {
        const cls = parseInt($("#disp-filtro-classe")?.value || "");
        abrirModalDispositivo(Number.isFinite(cls) ? cls : null);
    });
    $("#btn-novo-projeto") && $("#btn-novo-projeto").addEventListener("click", (e) => { e.preventDefault(); novoProjeto(); });

    $("#modal-disp-fechar") && $("#modal-disp-fechar").addEventListener("click", fecharModalDispositivo);
    $("#frmInserirDispositivo-backdrop") && $("#frmInserirDispositivo-backdrop").addEventListener("click", fecharModalDispositivo);
    $("#modal-disp-salvar") && $("#modal-disp-salvar").addEventListener("click", salvarModalDispositivo);
    $("#modal-disp-horas") && $("#modal-disp-horas").addEventListener("click", abrirHorasModal);
    $("#modal-disp-novo") && $("#modal-disp-novo").addEventListener("click", () => abrirModalDispositivo(state.selectedClasseId));
    $("#modal-disp-excluir") && $("#modal-disp-excluir").addEventListener("click", () => {
        if (!state.editDeviceId) {
            showToast("Nenhum dispositivo em edição para excluir.", "err");
            return;
        }
        if (!confirm("Excluir este dispositivo?")) return;
        const id = state.editDeviceId;
        state.dispositivos = (state.dispositivos || []).filter((d) => d.Id !== id);
        state.editDeviceId = null;
        persistState(true);
        fecharModalDispositivo();
        renderTodasPaginas();
        renderSimulacao();
        recordSnapshot(true);
        showToast(`Dispositivo #${id} excluído.`, "ok");
    });
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
    $("#disp-filtro-busca") && $("#disp-filtro-busca").addEventListener("input", debounce(() => renderDispositivos(), 300));

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
            const t = ev?.data?.t;
            if (t === "state:changed" || t === "state:update" || t === "project:changed") {
                if (tryLoadSaved()) {
                    renderTodasPaginas();
                    renderSimulacao();
                    recordSnapshot(true);
                }
            }
        };
    }
    window.addEventListener("storage", (e) => {
        if (e.key === "ps:state:v2") {
            if (tryLoadSaved()) {
                renderTodasPaginas();
                renderSimulacao();
                recordSnapshot(true);
            }
        }
    });
}

function toggleProjectCheck(key) {
    const pid = getProjetoIdAtual();
    const proj = state.projetos.find((p) => p.Id === pid);
    if(proj) {
        if(!proj.Checklists) proj.Checklists = {};
        proj.Checklists[key] = !proj.Checklists[key];
        persistState(true);
    }
}

// SPA Router (home/status/simulacao)
const ViewRouter = (() => {
    const TRANS_MS = 500;
    const VALID = new Set(["home", "status", "simulacao"]);
    let stack = ["home"];
    let busy = false;
    let pendingExpando = null;
    const EXPANDO_MS = 520;
    const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
    const norm = (v) => (VALID.has(v) ? v : "home");
    const getHash = () => norm((location.hash || "#home").replace("#", ""));
    const el = (v) => document.getElementById(`view-${v}`);
    const viewContainer = () => document.getElementById("view-container");
    const rectOf = (node) => node?.getBoundingClientRect?.();

    function findHomeCardFor(viewName) {
        return document.querySelector(`.hub-card[data-route="${viewName}"]`);
    }

    function createExpando(sourceEl, targetRect) {
        const overlay = document.createElement("div");
        overlay.className = "expando-overlay";
        const backdrop = document.createElement("div");
        backdrop.className = "expando-backdrop";
        const clone = sourceEl.cloneNode(true);
        clone.classList.add("expando-clone", "is-clone");
        clone.removeAttribute("href");
        clone.setAttribute("aria-hidden", "true");
        overlay.appendChild(backdrop);
        overlay.appendChild(clone);
        document.body.appendChild(overlay);
        const fromR = rectOf(sourceEl);
        const toR = targetRect;
        sourceEl.classList.add("expando-source-hidden");
        clone.style.left = `${toR.left}px`;
        clone.style.top = `${toR.top}px`;
        clone.style.width = `${toR.width}px`;
        clone.style.height = `${toR.height}px`;
        clone.style.transitionTimingFunction = EASE;
        const cs = getComputedStyle(sourceEl);
        clone.style.borderRadius = cs.borderRadius || "24px";
        clone.style.boxShadow = cs.boxShadow || "0 18px 40px rgba(15, 23, 42, 0.7)";
        const scaleX = Math.max(0.001, fromR.width / toR.width);
        const scaleY = Math.max(0.001, fromR.height / toR.height);
        const dx = fromR.left - toR.left;
        const dy = fromR.top - toR.top;
        clone.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scaleX}, ${scaleY})`;
        return { overlay, backdrop, clone, fromR, toR, sourceEl };
    }

    function setHeader(view) {
        const shell = document.getElementById("app-shell");
        const title = document.getElementById("app-title");
        const sub = document.getElementById("app-subtitle");
        const proj = document.getElementById("projeto-selector");
        if (shell) shell.classList.toggle("can-back", view !== "home");
        if (proj) proj.style.display = view === "home" ? "none" : "inline-flex";
        if (title) {
            title.textContent = view === "home" ? "Central de Controle" : view === "status" ? "Projetos Mecanicos" : "Gestao de Simulacao";
        }
        if (sub) {
            sub.textContent = view === "home" ? "HTML/JS Preview - Comau" : view === "status" ? "Controle de Status - Setup/Dispositivos/Dashboard" : "Kanban de Liberacao - Process Simulate";
        }
    }

    function afterEnter(view) {
        if (view === "home") {
            renderHubKPIs?.();
        } else if (view === "status") {
            enhanceNav?.();
            renderTodasPaginas?.();
            const pid = getProjetoIdAtual?.() || 1;
            const last = PS?.utils?.getLastTab ? PS.utils.getLastTab(pid) : currentProjetoPage || "setup";
            showProjetoMecanicoPage?.(last, { animate: false, force: true });
        } else if (view === "simulacao") {
            renderSimulacao?.();
        }
    }

    function apply(cur, next, dir, animate) {
        if (cur === next) return;
        const curEl = el(cur);
        const nextEl = el(next);
        if (!nextEl) return;
        setHeader(next);
        const vc = viewContainer();
        const vcRect = rectOf(vc) || { left: 0, top: 0, width: innerWidth, height: innerHeight };
        vc?.classList.add("is-transitioning");

        const reduced =
            !animate ||
            (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

        const canExpandoForward =
            ENABLE_EXPANDO &&
            !reduced &&
            pendingExpando?.type === "forward" &&
            cur === "home" &&
            (next === "status" || next === "simulacao") &&
            pendingExpando?.fromEl;

        if (canExpandoForward) {
            busy = true;
            vc?.classList.add("is-expanding");
            curEl?.classList.add("view-active");
            curEl?.classList.remove("view-exit-left", "view-exit-right", "view-enter-left");
            nextEl.classList.add("view-active", "view-expando-prep");
            nextEl.classList.remove("view-exit-left", "view-exit-right", "view-enter-left");
            afterEnter(next);
            const { overlay, clone, sourceEl } = createExpando(pendingExpando.fromEl, vcRect);
            requestAnimationFrame(() => {
                overlay.classList.add("play", "morph");
                clone.style.transform = "translate3d(0,0,0) scale(1,1)";
                clone.style.borderRadius = "0px";
                clone.style.boxShadow = "0 24px 64px rgba(15, 23, 42, 0.40)";
            });
            const revealAt = Math.max(0, EXPANDO_MS - 140);
            setTimeout(() => {
                overlay.classList.add("reveal");
                nextEl.classList.remove("view-expando-prep");
            }, revealAt);
            const finish = () => {
                overlay.remove();
                sourceEl?.classList.remove("expando-source-hidden");
                nextEl.classList.remove("view-expando-prep");
                curEl?.classList.remove("view-active");
                vc?.classList.remove("is-expanding");
                vc?.classList.remove("is-transitioning");
                busy = false;
                pendingExpando = null;
            };
            setTimeout(finish, EXPANDO_MS + 40);
            return;
        }

        const canExpandoBack =
            ENABLE_EXPANDO &&
            !reduced &&
            pendingExpando?.type === "back" &&
            next === "home" &&
            (cur === "status" || cur === "simulacao");

        if (canExpandoBack) {
            busy = true;
            vc?.classList.add("is-expanding");
            const targetCard = pendingExpando.toEl || findHomeCardFor(cur);
            nextEl.classList.add("view-active", "view-expando-measure");
            afterEnter("home");
            curEl?.classList.add("view-active");
            if (!targetCard) {
                nextEl.classList.remove("view-expando-measure");
                vc?.classList.remove("is-expanding");
                vc?.classList.remove("is-transitioning");
                busy = false;
                pendingExpando = null;
            } else {
                const { overlay, clone, toR, sourceEl } = createExpando(targetCard, vcRect);
                clone.style.transform = "translate3d(0,0,0) scale(1,1)";
                clone.style.borderRadius = "0px";
                overlay.classList.add("play", "morph");
                const targetRect = rectOf(targetCard);
                const scaleX = Math.max(0.001, targetRect.width / toR.width);
                const scaleY = Math.max(0.001, targetRect.height / toR.height);
                const dx = targetRect.left - toR.left;
                const dy = targetRect.top - toR.top;
                requestAnimationFrame(() => {
                    overlay.classList.remove("play");
                    clone.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scaleX}, ${scaleY})`;
                    clone.style.borderRadius = getComputedStyle(targetCard).borderRadius || "24px";
                    clone.style.boxShadow = getComputedStyle(targetCard).boxShadow || "0 18px 40px rgba(15, 23, 42, 0.7)";
                });
                setTimeout(() => {
                    overlay.classList.remove("morph");
                }, Math.max(0, EXPANDO_MS - 160));
                const finish = () => {
                    overlay.remove();
                    sourceEl?.classList.remove("expando-source-hidden");
                    curEl?.classList.remove("view-active", "view-exit-left", "view-exit-right", "view-enter-left");
                    nextEl.classList.remove("view-expando-measure");
                    vc?.classList.remove("is-expanding");
                    vc?.classList.remove("is-transitioning");
                    busy = false;
                    pendingExpando = null;
                };
                setTimeout(finish, EXPANDO_MS + 40);
                return;
            }
        }

        [curEl, nextEl].forEach((x) => x && x.classList.remove("view-exit-left", "view-exit-right", "view-enter-left"));
        nextEl.classList.add("view-active");

        if (!animate || reduced) {
            if (curEl) curEl.classList.remove("view-active");
            afterEnter(next);
            vc?.classList.remove("is-transitioning");
            return;
        }

        busy = true;
        if (dir === "back") {
            nextEl.classList.add("view-enter-left");
            if (curEl) curEl.classList.add("view-exit-right");
        } else {
            if (curEl) curEl.classList.add("view-exit-left");
        }
        void nextEl.offsetWidth;
        requestAnimationFrame(() => {
            nextEl.classList.remove("view-enter-left");
        });
        setTimeout(() => {
            if (curEl) curEl.classList.remove("view-active", "view-exit-left", "view-exit-right");
            nextEl.classList.remove("view-exit-left", "view-exit-right", "view-enter-left");
            busy = false;
            afterEnter(next);
            vc?.classList.remove("is-transitioning");
        }, TRANS_MS);
    }

    function onHashChange(first = false) {
        const next = getHash();
        const cur = stack[stack.length - 1];
        if (next === cur) return;
        const isBack = stack.length > 1 && stack[stack.length - 2] === next;
        if (!pendingExpando && isBack && next === "home" && (cur === "status" || cur === "simulacao")) {
            pendingExpando = { type: "back", toEl: findHomeCardFor(cur) };
        }
        if (isBack) stack.pop();
        else stack.push(next);
        apply(cur, next, isBack ? "back" : "forward", !first);
    }

    function bind() {
        document.body.addEventListener("click", (e) => {
            const a = e.target.closest("[data-route]");
            if (!a) return;
            e.preventDefault();
            if (busy) return;
            const target = norm(a.dataset.route);
            const cur = stack[stack.length - 1];
            const isHubCard = a.classList.contains("hub-card");
            const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (ENABLE_EXPANDO && !reduced && cur === "home" && isHubCard && target !== "home") {
                pendingExpando = { type: "forward", fromEl: a };
                location.hash = "#" + target;
                return;
            }
            location.hash = "#" + target;
        });

        const backBtn = document.getElementById("app-back");
        backBtn?.addEventListener("click", () => {
            if (busy) return;
            const cur = stack[stack.length - 1];
            const prev = stack.length > 1 ? stack[stack.length - 2] : "home";
            const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (!reduced && prev === "home" && (cur === "status" || cur === "simulacao")) {
                pendingExpando = { type: "back", toEl: findHomeCardFor(cur) };
            }
            location.hash = "#" + prev;
        });

        window.addEventListener("hashchange", () => onHashChange(false));
    }

    function init() {
        bind();
        const initial = getHash();
        stack = ["home"];
        if (initial !== "home") stack.push(initial);
        ["home", "status", "simulacao"].forEach((v) => el(v)?.classList.remove("view-active"));
        el(initial)?.classList.add("view-active");
        setHeader(initial);
        afterEnter(initial);
        if (!location.hash) location.hash = "#home";
    }

    return { init };
})();

function enhanceNav() {
    const nav = document.querySelector("nav.top-nav");
    if (!nav) return;
    if (nav.dataset.bound === "1") return;
    nav.dataset.bound = "1";
    const menu = nav ? nav.querySelector(".menu") : null;
    if (!menu) return;
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

// Exposições globais
window.enhanceNav = enhanceNav;
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
window.toggleProjectCheck = toggleProjectCheck;
window.abrirModalDispositivo = abrirModalDispositivo;
window.salvarDadosProjeto = salvarDadosProjeto;

window.__APP_API = {
    persistState: (broadcast = false) => persistState(broadcast),
    renderDashboardData: () => renderDashboardData(),
    renderKanban: () => renderKanban(),
    renderSimulacao: () => renderSimulacao(),
    recordSnapshot: () => recordSnapshot(true),
    calcularRecurso: () => calcularRecurso(),
    editDevice: (id, clsId) => {
        state.editDeviceId = id;
        abrirModalDispositivo(clsId);
        const disp = state.dispositivos.find((x) => x.Id === id);
        if (disp) {
            $("#modal-disp-nome").value = disp.Nome;
            $("#modal-disp-tag").value = disp.Tag;
            $("#modal-disp-fornecedor").value = disp.Fornecedor || "";
            $("#modal-disp-linha").value = disp.Linha || "";
            $("#modal-disp-produto").value = disp.Produto || "";
            $("#modal-disp-op").value = disp.OP_ST || "";
            $("#modal-disp-tiposigla").value = disp.TipoSigla || "";
            $("#modal-disp-nivel").value = disp.Nivel;
            $("#modal-disp-tipo").value = disp.Tipo;
        }
        window.fecharModalDetalhe?.();
    }
};

// Dropdown custom de projetos
window.toggleProjectMenu = (e) => {
    e?.stopPropagation();
    const menu = document.getElementById("project-menu-list");
    menu?.classList.toggle("show");
};
window.closeProjectMenu = () => {
    const menu = document.getElementById("project-menu-list");
    menu?.classList.remove("show");
};
window.selectProjectFromMenu = (id) => {
    window.closeProjectMenu();
    setTimeout(() => setProjetoAtual(id), 50);
};

document.addEventListener("DOMContentLoaded", () => {
    const trigger = document.getElementById("project-trigger");
    if (trigger) trigger.addEventListener("click", window.toggleProjectMenu);
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#project-dropdown-wrapper")) {
            window.closeProjectMenu();
        }
    });
});

document.addEventListener("DOMContentLoaded", async () => {
    try { initCorporateSplash(); } catch { }
    bindGlobalEvents();
    View.initDashboardCharts();
    View.setupKanbanDropZones?.(state, document);
    await carregarEstadoInicial();
    verificarProjetoExistente();
    renderHubKPIs();
    ViewRouter.init();
});

// Controle do Drawer
window.toggleDrawer = () => {
    const overlay = document.getElementById("drawer-overlay");
    const panel = document.getElementById("drawer-menu");
    overlay?.classList.toggle("open");
    panel?.classList.toggle("open");
};

// Navegação via Drawer
window.mobileNavigate = (target) => {
    showProjetoMecanicoPage(target);
    window.toggleDrawer();
    document.querySelectorAll(".drawer-item").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.subPage === target);
    });
    const title = document.getElementById("mobile-nav-title");
    if (title) {
        const names = { setup: "Setup", descricaoevento: "Descrição Evento", dispositivos: "Dispositivos", cronograma: "Cronograma", dashboard: "Dashboard", kanban: "Kanban", recurso: "Recurso" };
        title.textContent = names[target] || "Menu";
    }
};

const originalShowPage = window.showProjetoMecanicoPage;
window.showProjetoMecanicoPage = function(target, opts) {
    if (originalShowPage) originalShowPage(target, opts);
    document.querySelectorAll(".drawer-item").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.subPage === target);
    });
    const title = document.getElementById("mobile-nav-title");
    if (title) {
        const activeBtn = document.querySelector(`.drawer-item[data-sub-page="${target}"]`);
        if (activeBtn) title.textContent = activeBtn.textContent.trim().replace(/^.. /, "");
    }
};
