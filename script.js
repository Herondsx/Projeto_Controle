// ==============================================
// MOCK DATA E ESTADO DA APLICAÇÃO
// ==============================================

// Enums (para facilitar)
const TipoDispositivo = { Mecanico: 0, Eletrico: 1, Software: 2, Ferramental: 3, Outro: 99 };
const NivelPrioridade = { Baixa: 1, Media: 2, Alta: 3, Critica: 4 };
const StatusPrazo = { NoPrazo: 'NoPrazo', EmAtraso: 'EmAtraso', Concluido: 'Concluido', Standby: 'Standby' };
const StatusManual = { NoPrazo: 'NoPrazo', EmAtraso: 'EmAtraso', EmSimulacao: 'EmSimulacao', Concluido: 'Concluido', Standby: 'Standby' };

const tipoOptions = Object.entries(TipoDispositivo).map(([name, value]) => ({ value, name }));
const nivelOptions = Object.entries(NivelPrioridade).map(([name, value]) => ({ value, name }));

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const hoje = new Date().toISOString().split('T')[0];

const state = {
    projetoId: 1,
    classes: [],
    milestones: {}, // { classeId: [ms1, ms2] }
    dispositivos: [],
    editClasseId: null,
    editMilestoneId: null,
    selectedClasseId: null,
    editDeviceId: null // Controla se o modal de dispositivo está editando ou criando
};

let chartStatusInstance = null;
let chartFasesInstance = null;

// ==============================================
// LÓGICA DE DADOS MOCADOS (Seed)
// ==============================================
function gerarDadosDemo() {
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
        { Id: 1, Nome: "Estação 10 - Posicionamento", Tag: "EST10", Tipo: "Mecanico", Nivel: "Alta", Fornecedor: "Fornecedor A", Linha: "Linha 1", ClasseId: 1, DR1Percentual: 60, DR1Planejado: new Date(Date.now() + 5 * 86400000), DR1Ok: false, DoisDPercentual: 20, PlanoSequenciaPercentual: 10, ReleasePercentual: 0, Standby: false, ImagemPath: "https://placehold.co/64x64/0ea5e9/white?text=EST10", Produto: "Carroceria", OP: "OP123", Quantidade: 1, NewReTooling: "NEW", SeedTool: "REF-001", HorasTotais: 150, Horas2D: 30, chkERGONOMY: true, chkSELFASSESSMENT: true },
        { Id: 2, Nome: "Robô Solda A", Tag: "RB-A", Tipo: "Software", Nivel: "Media", Fornecedor: "Fornecedor B", Linha: "Linha 1", ClasseId: 2, DR2Percentual: 40, DR2Planejado: new Date(Date.now() + 32 * 86400000), DR2Ok: false, DoisDPercentual: 70, PlanoSequenciaPercentual: 30, ReleasePercentual: 0, Standby: false, ImagemPath: "https://placehold.co/64x64/22c55e/white?text=RB-A", Produto: "Porta", OP: "OP124", Quantidade: 2, NewReTooling: "RETOOLING", SeedTool: "REF-002", HorasTotais: 200, Horas2D: 50, chkREMARKSFROMDR1: true },
        { Id: 3, Nome: "Painel Elétrico B", Tag: "PE-B", Tipo: "Eletrico", Nivel: "Critica", Fornecedor: "Fornecedor C", Linha: "Linha 2", ClasseId: 3, DR3Percentual: 15, DR3Planejado: new Date(Date.now() - 5 * 86400000), DR3Ok: false, DoisDPercentual: 30, PlanoSequenciaPercentual: 15, ReleasePercentual: 5, Standby: false, ImagemPath: "https://placehold.co/64x64/f59e0b/white?text=PE-B", Produto: "Chassis", OP: "OP125", Quantidade: 1, NewReTooling: "NEW", SeedTool: "REF-003", HorasTotais: 300, Horas2D: 80, chkFEA: true },
        { Id: 4, Nome: "Gabarito C", Tag: "GAB-C", Tipo: "Ferramental", Nivel: "Baixa", Fornecedor: "Fornecedor D", Linha: "Linha 2", ClasseId: 1, DR1Percentual: 20, DR1Ok: false, Standby: true, ImagemPath: "https://placehold.co/64x64/6b7280/white?text=GAB-C", Produto: "Teto", OP: "OP126", Quantidade: 5, NewReTooling: "NEW", SeedTool: "REF-004", HorasTotais: 80, Horas2D: 10 },
        { Id: 5, Nome: "Esteira D", Tag: "EST-D", Tipo: "Mecanico", Nivel: "Media", Fornecedor: "Fornecedor E", Linha: "Linha 3", ClasseId: 2, DR2Percentual: 100, DR2Planejado: new Date(Date.now() - 10 * 86400000), DR2Ok: true, DR2Realizado: new Date(Date.now() - 12 * 86400000), PlanoSequenciaPercentual: 100, ReleasePercentual: 100, ReleaseOk: true, Standby: false, ImagemPath: "https://placehold.co/64x64/22c55e/white?text=EST-D", Produto: "Lateral", OP: "OP127", Quantidade: 1, NewReTooling: "RETOOLING", SeedTool: "REF-005", HorasTotais: 500, Horas2D: 120, chkCHECKLISTDR2: true }
    ];
    
    // Adiciona propriedades faltando e o novo StatusManual
    state.dispositivos.forEach(d => {
        // Garante que todas as propriedades existam
        d.DR1Percentual = d.DR1Percentual || 0;
        d.DR2Percentual = d.DR2Percentual || 0;
        d.DR3Percentual = d.DR3Percentual || 0;
        d.DoisDPercentual = d.DoisDPercentual || 0;
        d.PlanoSequenciaPercentual = d.PlanoSequenciaPercentual || 0;
        d.ReleasePercentual = d.ReleasePercentual || 0;
        
        // Adiciona todos os campos novos com valores padrão
        d.Tipo = d.Tipo || "Outro";
        d.Nivel = d.Nivel || "Media";
        d.Fornecedor = d.Fornecedor || "";
        d.Produto = d.Produto || "";
        d.Linha = d.Linha || "";
        d.OP = d.OP || "";
        d.Quantidade = d.Quantidade || 0;
        d.NewReTooling = d.NewReTooling || "";
        d.SeedTool = d.SeedTool || "";
        d.HorasTotais = d.HorasTotais || 0;
        d.Horas2D = d.Horas2D || 0;

        // Checkboxes DR1
        d.chkERGONOMY = d.chkERGONOMY || false;
        d.chkWEDGUNS = d.chkWEDGUNS || false;
        d.chkRPS = d.chkRPS || false;
        d.chkPRELIMINARYPAYLOAD = d.chkPRELIMINARYPAYLOAD || false;
        d.chkCHECKLISTDR1 = d.chkCHECKLISTDR1 || false;
        d.chkSELFASSESSMENT = d.chkSELFASSESSMENT || false;
        d.chkSCANER3D = d.chkSCANER3D || false;
        d.chkSEQUECEASBUILT = d.chkSEQUECEASBUILT || false;
        d.chkPRODUCT3D = d.chkPRODUCT3D || false;
        // Checkboxes DR2
        d.chkREMARKSFROMDR1 = d.chkREMARKSFROMDR1 || false;
        d.chkVALVEBLOCK = d.chkVALVEBLOCK || false;
        d.chkADVANCEDBILLOFMATERIAIS = d.chkADVANCEDBILLOFMATERIAIS || false;
        d.chkCHECKLISTDR2 = d.chkCHECKLISTDR2 || false;
        // Checkboxes DR3
        d.chkREMARKSFROMDR2 = d.chkREMARKSFROMDR2 || false;
        d.chkFINALPAYLOAD = d.chkFINALPAYLOAD || false;
        d.chkFEA = d.chkFEA || false;
        d.chkFILEFORCONSTRUCTIONQUOTE = d.chkFILEFORCONSTRUCTIONQUOTE || false;
        d.chkCHECKLISTDR3 = d.chkCHECKLISTDR3 || false;
        // Checkboxes Gerais
        d.chkPlanoSequencia = d.chkPlanoSequencia || false;
        d.chk2D = d.chk2D || false;
        
        // Listas
        d.DesignReview = d.DesignReview || [];
        d.Data2D = d.Data2D || null;

        // Define o StatusManual inicial com base no cálculo de prazo
        d.StatusManual = calcularStatusPrazo(d);
    });
    
    showToast("Dados de exemplo gerados.", "ok");
    renderTodasPaginas();
}

function calcularStatusPrazo(d) {
    if (d.Standby) return StatusPrazo.Standby;

    const all100 =
        d.DR1Percentual >= 100 &&
        d.DR2Percentual >= 100 &&
        d.DR3Percentual >= 100 &&
        d.DoisDPercentual >= 100 &&
        d.PlanoSequenciaPercentual >= 100 &&
        d.ReleasePercentual >= 100;

    if (d.ReleaseOk || all100) return StatusPrazo.Concluido;

    const hojeDate = new Date();
    hojeDate.setHours(0, 0, 0, 0);

    const Atrasado = (plan, perc) => {
        if (!plan) return false;
        const planDate = new Date(plan);
        planDate.setHours(0, 0, 0, 0);
        return planDate < hojeDate && perc < 100;
    };

    if (Atrasado(d.DR1Planejado, d.DR1Percentual) ||
        Atrasado(d.DR2Planejado, d.DR2Percentual) ||
        Atrasado(d.DR3Planejado, d.DR3Percentual) ||
        Atrasado(d.DoisDPlanejado, d.DoisDPercentual) ||
        Atrasado(d.PlanoSequenciaPlanejado, d.PlanoSequenciaPercentual) ||
        Atrasado(d.ReleasePlanejado, d.ReleasePercentual)) {
        return StatusPrazo.EmAtraso;
    }

    return StatusPrazo.NoPrazo;
}


// ==============================================
// LÓGICA DE ROTEAMENTO
// ==============================================
function showPage(pageId) {
    $$('.page-content').forEach(p => p.classList.remove('active'));
    const targetPage = $(`#page-${pageId}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    $$('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageId);
    });

    switch (pageId) {
        case 'setup': renderSetup(); break;
        case 'descricaoevento': renderDescricaoEvento(); break;
        case 'dispositivos': renderDispositivos(); break;
        case 'cronograma': renderCronograma(); break;
        case 'dashboard': renderDashboardData(); break;
        case 'kanban': renderKanban(); break;
        case 'recurso': renderRecurso(); break;
    }
    
    if (window.SiteUX && window.SiteUX.moveInk) {
         window.SiteUX.moveInk($(`.nav-link[data-page="${pageId}"]`), false);
    }
}

function renderTodasPaginas() {
    renderSetup();
    renderDescricaoEvento();
    renderDispositivos();
    renderCronograma();
    renderDashboardData();
    renderKanban();
    renderRecurso();
}

// ==============================================
// RENDERIZAÇÃO PÁGINA: Setup
// ==============================================
function renderSetup() {
    const tableBody = $('#setup-classes-table');
    if (!tableBody) return;
    
    tableBody.innerHTML = ''; 
    
    const projetoId = parseInt($('#setup-projeto-id').value) || null;
    const sum = state.classes
        .filter(c => c.ProjetoId === projetoId)
        .reduce((acc, c) => acc + (c.Percentual || 0), 0);
    
    const sumBadge = $('#setup-sum-percent');
    sumBadge.textContent = `Soma % das Classes: ${sum}%`;
    sumBadge.className = "badge";
    if (sum > 100) sumBadge.classList.add("err");
    else if (sum === 100) sumBadge.classList.add("ok");
    else sumBadge.classList.add("warn");

    state.classes.filter(c => c.ProjetoId === projetoId).forEach(c => {
        const tr = document.createElement('tr');
        const isSelected = state.selectedClasseId === c.Id;
        tr.className = `row-hover ${isSelected ? "row-selected" : ""}`;
        tr.innerHTML = `
            <td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;border:1px solid rgba(255,255,255,.15);background:${c.CorHex || "#888"};"></span></td>
            <td>${escapeHtml(c.Nome)}</td>
            <td>${c.Percentual}%</td>
            <td>${c.Horas}</td>
            <td>${formatarData(c.DataBase)}</td>
            <td>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-sm" data-action="select-classe" data-id="${c.Id}">${isSelected ? "Ocultar" : "Detalhes"}</button>
                    <button class="btn btn-sm" data-action="edit-classe" data-id="${c.Id}">Editar</button>
                    <button class="btn btn-sm" data-action="delete-classe" data-id="${c.Id}">Excluir</button>
                    <button class="btn btn-sm" title="Inserir dispositivo" data-action="add-dispositivo" data-id="${c.Id}">+ Disp</button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
        
        if (isSelected) {
            const hierarchyTr = document.createElement('tr');
            hierarchyTr.className = 'hierarchy-row';
            hierarchyTr.innerHTML = `<td colspan="6" class="hierarchy-cell">${renderHierarchyContent(c)}</td>`;
            tableBody.appendChild(hierarchyTr);
        }
    });
    
    if (state.selectedClasseId) {
        const classe = state.classes.find(c => c.Id === state.selectedClasseId);
        $('#setup-milestones-section').style.display = 'block';
        $('#setup-milestones-title').innerHTML = `Milestones — <span style="color:${classe.CorHex}">${escapeHtml(classe.Nome)}</span>`;
    } else {
         $('#setup-milestones-section').style.display = 'none';
    }
}

function renderHierarchyContent(classe) {
    const milestones = (state.milestones[classe.Id] || []).sort((a,b) => (a.Data > b.Data ? 1 : -1));
    const dispositivos = state.dispositivos.filter(d => d.ClasseId === classe.Id);
    
    const msHtml = milestones.length > 0 ?
        milestones.map(m => `<li>${escapeHtml(m.Nome)} (${formatarData(m.Data)}) ${m.IsMain ? "<strong>(Main)</strong>" : ""}</li>`).join('') :
        '<li>Nenhum milestone cadastrado.</li>';
        
    const dispHtml = dispositivos.length > 0 ?
        dispositivos.map(d => `<li>${escapeHtml(d.Nome)} (TAG: ${escapeHtml(d.Tag)})</li>`).join('') :
        '<li>Nenhum dispositivo cadastrado.</li>';
        
    return `
    <div class="hierarchy-content">
        <div class="grid grid-2">
            <div>
                <h4 class="app-title" style="font-size:14px; margin:0 0 8px 0; color: var(--title);">Milestones</h4>
                <ul>${msHtml}</ul>
            </div>
            <div>
                <h4 class="app-title" style="font-size:14px; margin:0 0 8px 0; color: var(--title);">Dispositivos</h4>
                <ul>${dispHtml}</ul>
            </div>
        </div>
    </div>`;
}

function setupFormClasseLimpar() {
    state.editClasseId = null;
    $('#setup-form-classe-title').textContent = "Nova Classe";
    $('#setup-classe-salvar').textContent = "Adicionar";
    $('#setup-classe-nome').value = "";
    $('#setup-classe-cor').value = "#0D9488";
    $('#setup-classe-percent').value = 0;
    $('#setup-classe-horas').value = 0;
    $('#setup-classe-data').value = hoje;
    $('#setup-classe-projetoid').value = $('#setup-projeto-id').value;
    $('#setup-status-classe').textContent = "";
}

function setupFormClasseSalvar() {
    const projetoId = parseInt($('#setup-projeto-id').value) || null;
    const novaClasse = {
        Id: state.editClasseId || Date.now(),
        Nome: $('#setup-classe-nome').value,
        CorHex: $('#setup-classe-cor').value,
        Percentual: parseInt($('#setup-classe-percent').value) || 0,
        Horas: parseFloat($('#setup-classe-horas').value) || 0,
        DataBase: new Date($('#setup-classe-data').value || hoje),
        ProjetoId: parseInt($('#setup-classe-projetoid').value) || null,
    };
    
    if (!novaClasse.Nome) {
        showToast("Nome é obrigatório.", "err");
        return;
    }
    
    if (state.editClasseId) {
        const index = state.classes.findIndex(c => c.Id === state.editClasseId);
        if (index > -1) state.classes[index] = novaClasse;
    } else {
        state.classes.push(novaClasse);
    }
    
    setupFormClasseLimpar();
    renderSetup();
    showToast("Classe salva.", "ok");
}

function setupFormMilestoneLimpar() {
    state.editMilestoneId = null;
    $('#setup-ms-salvar').textContent = "Adicionar";
    $('#setup-ms-nome').value = "";
    $('#setup-ms-data').value = hoje;
    $('#setup-ms-ordem').value = (state.milestones[state.selectedClasseId]?.length || 0) + 1;
    $('#setup-ms-main').checked = false;
    $('#setup-status-ms').textContent = "";
}

function setupFormMilestoneSalvar() {
    if (!state.selectedClasseId) return;
    
    const novoMS = {
        Id: state.editMilestoneId || Date.now(),
        ClasseId: state.selectedClasseId,
        Nome: $('#setup-ms-nome').value,
        Data: new Date($('#setup-ms-data').value || hoje),
        Ordem: parseInt($('#setup-ms-ordem').value) || 0,
        IsMain: $('#setup-ms-main').checked
    };
    
    if (!novoMS.Nome) {
        showToast("Nome do milestone é obrigatório.", "err");
        return;
    }
    
    if (!state.milestones[state.selectedClasseId]) {
        state.milestones[state.selectedClasseId] = [];
    }
    
    if (state.editMilestoneId) {
        const index = state.milestones[state.selectedClasseId].findIndex(m => m.Id === state.editMilestoneId);
        if (index > -1) state.milestones[state.selectedClasseId][index] = novoMS;
    } else {
        state.milestones[state.selectedClasseId].push(novoMS);
    }
    
    setupFormMilestoneLimpar();
    renderSetup();
    showToast("Milestone salvo.", "ok");
}

// ==============================================
// LÓGICA DO MODAL DE DISPOSITIVO (frmInserirDispositivo)
// ==============================================

function abrirModalDispositivo(classeId) {
    state.selectedClasseId = classeId; // Salva o ID da classe
    state.editDeviceId = null; // Garante que é um novo dispositivo
    
    const classe = state.classes.find(c => c.Id === classeId);
    if (!classe) return;
    
    $('#modal-dispositivo-title').textContent = `Novo Dispositivo — Classe ${classe.Nome}`;
    frmInserirDispositivo_Novo(); // Limpa o formulário
    
    // Popula as listas
    const drList = $('#modal-disp-dr-list');
    drList.innerHTML = '';
    (state.milestones[classe.Id] || []).forEach(ms => {
         drList.innerHTML += `<option value="${ms.Id}">${escapeHtml(ms.Nome)}</option>`;
    });
    
    $('#frmInserirDispositivo-backdrop').classList.add('show');
    $('#frmInserirDispositivo').classList.add('show');
}

function fecharModalDispositivo() {
    $('#frmInserirDispositivo-backdrop').classList.remove('show');
    $('#frmInserirDispositivo').classList.remove('show');
}

function frmInserirDispositivo_Novo() {
    // Limpa todos os campos
    $('#modal-disp-nome').value = "";
    $('#modal-disp-tipo').value = "";
    $('#modal-disp-tag').value = "";
    $('#modal-disp-op').value = "";
    $('#modal-disp-linha').value = "";
    $('#modal-disp-quant').value = "1";
    $('#modal-disp-newretooling').value = "";
    $('#modal-disp-produto').value = "";
    $('#modal-disp-seedtool').value = "";
    $('#modal-disp-nivel').value = "";
    $('#modal-disp-fornecedor').value = "";
    $('#modal-disp-standby').checked = false;
    
    // Limpa campos ocultos de horas
    $('#modal-disp-horas-totais').value = "0";
    $('#modal-disp-horas-2d').value = "0";
    
    // Limpa listas
    $('#modal-disp-dr-list').selectedIndex = -1;
    $('#modal-disp-data-2d').value = "";
    
    // Limpa checkboxes
    $$('#frmInserirDispositivo .dr-group input[type="checkbox"]').forEach(chk => chk.checked = false);
    $('#chkPlanoSequencia').checked = false;
    $('#chk2D').checked = false;
    
    state.editDeviceId = null; // Garante que estamos no modo "novo"
    showToast("Formulário limpo para novo dispositivo.", "ok");
}

function frmInserirDispositivo_Salvar() {
    // Coleta de todos os dados do formulário
    const novoDisp = {
        Id: state.editDeviceId || Date.now(),
        ClasseId: state.selectedClasseId,
        Nome: $('#modal-disp-nome').value,
        Tag: $('#modal-disp-tag').value,
        Tipo: $('#modal-disp-tipo').value,
        Nivel: $('#modal-disp-nivel').value,
        Fornecedor: $('#modal-disp-fornecedor').value,
        Linha: $('#modal-disp-linha').value,
        Produto: $('#modal-disp-produto').value,
        OP: $('#modal-disp-op').value,
        Quantidade: parseInt($('#modal-disp-quant').value) || 0,
        NewReTooling: $('#modal-disp-newretooling').value,
        SeedTool: $('#modal-disp-seedtool').value,
        
        Standby: $('#modal-disp-standby').checked,
        
        HorasTotais: parseFloat($('#modal-disp-horas-totais').value) || 0,
        Horas2D: parseFloat($('#modal-disp-horas-2d').value) || 0,

        // Checkboxes
        chkERGONOMY: $('#chkERGONOMY').checked,
        chkWEDGUNS: $('#chkWEDGUNS').checked,
        chkRPS: $('#chkRPS').checked,
        chkPRELIMINARYPAYLOAD: $('#chkPRELIMINARYPAYLOAD').checked,
        chkCHECKLISTDR1: $('#chkCHECKLISTDR1').checked,
        chkSELFASSESSMENT: $('#chkSELFASSESSMENT').checked,
        chkSCANER3D: $('#chkSCANER3D').checked,
        chkSEQUECEASBUILT: $('#chkSEQUECEASBUILT').checked,
        chkPRODUCT3D: $('#chkPRODUCT3D').checked,
        chkREMARKSFROMDR1: $('#chkREMARKSFROMDR1').checked,
        chkVALVEBLOCK: $('#chkVALVEBLOCK').checked,
        chkADVANCEDBILLOFMATERIAIS: $('#chkADVANCEDBILLOFMATERIAIS').checked,
        chkCHECKLISTDR2: $('#chkCHECKLISTDR2').checked,
        chkREMARKSFROMDR2: $('#chkREMARKSFROMDR2').checked,
        chkFINALPAYLOAD: $('#chkFINALPAYLOAD').checked,
        chkFEA: $('#chkFEA').checked,
        chkFILEFORCONSTRUCTIONQUOTE: $('#chkFILEFORCONSTRUCTIONQUOTE').checked,
        chkCHECKLISTDR3: $('#chkCHECKLISTDR3').checked,
        chkPlanoSequencia: $('#chkPlanoSequencia').checked,
        chk2D: $('#chk2D').checked,

        // Listas
        DesignReview: Array.from($('#modal-disp-dr-list').selectedOptions).map(opt => opt.value),
        Data2D: $('#modal-disp-data-2d').value || null,

        // Valores padrão
        DR1Percentual: 0, DR2Percentual: 0, DR3Percentual: 0,
        DoisDPercentual: 0, PlanoSequenciaPercentual: 0, ReleasePercentual: 0,
        ImagemPath: `https://placehold.co/64x64/555/white?text=${$('#modal-disp-tag').value || "Novo"}`
    };

    novoDisp.StatusManual = calcularStatusPrazo(novoDisp);
    
    if (!novoDisp.Nome) {
        showToast("Nome do dispositivo é obrigatório.", "err");
        return;
    }
    
    if (state.editDeviceId) {
        // Atualiza dispositivo existente
        const index = state.dispositivos.findIndex(d => d.Id === state.editDeviceId);
        if (index > -1) {
            state.dispositivos[index] = novoDisp;
            showToast("Dispositivo atualizado.", "ok");
        }
    } else {
        // Adiciona novo dispositivo
        state.dispositivos.push(novoDisp);
        showToast("Dispositivo salvo.", "ok");
    }
    
    fecharModalDispositivo();
    renderTodasPaginas(); // Atualiza tudo
}

function frmInserirDispositivo_Copiar() {
    showToast("Função 'Copiar Dados' ainda não implementada.", "warn");
    // Lógica futura:
    // const ultimoDisp = state.dispositivos[state.dispositivos.length - 1];
    // if (ultimoDisp) {
    //     carregarDadosNoModal(ultimoDisp);
    //     state.editDeviceId = null; // Garante que vai criar um novo
    //     $('#modal-dispositivo-title').textContent = "Novo Dispositivo (Cópia)";
    // }
}

function frmInserirDispositivo_Excluir() {
     showToast("Função 'Excluir' ainda não implementada.", "warn");
    // Lógica futura:
    // if (state.editDeviceId) {
    //     if (confirm("Tem certeza que deseja excluir este dispositivo?")) {
    //         state.dispositivos = state.dispositivos.filter(d => d.Id !== state.editDeviceId);
    //         fecharModalDispositivo();
    //         renderTodasPaginas();
    //         showToast("Dispositivo excluído.", "ok");
    //     }
    // } else {
    //     showToast("Nenhum dispositivo selecionado para excluir.", "err");
    // }
}

function abrirHorasModal() {
    // Carrega os valores dos campos ocultos para o modal
    $('#modal-horas-totais').value = $('#modal-disp-horas-totais').value || '0';
    $('#modal-horas-2d').value = $('#modal-disp-horas-2d').value || '0';
    
    $('#horas-modal-backdrop').classList.add('show');
    $('#horas-modal').classList.add('show');
}

function fecharHorasModal() {
    $('#horas-modal-backdrop').classList.remove('show');
    $('#horas-modal').classList.remove('show');
}

function salvarHorasModal() {
    // Salva os valores do modal de horas nos campos ocultos do modal principal
    $('#modal-disp-horas-totais').value = $('#modal-horas-totais').value;
    $('#modal-disp-horas-2d').value = $('#modal-horas-2d').value;
    
    showToast("Horas salvas (temporariamente).", "ok");
    fecharHorasModal();
}

// ==============================================
// RENDERIZAÇÃO PÁGINA: DescricaoEvento
// ==============================================
function renderDescricaoEvento() {
    const container = $('#desc-evento-lista');
    if (!container) return;
    container.innerHTML = '';
    
    state.dispositivos.forEach(d => {
        const card = document.createElement('article');
        card.className = "card";
        card.style.padding = "12px";
        card.innerHTML = `
            <header style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div class="thumb">
                        <img src="${d.ImagemPath || 'https://placehold.co/64x64/1F2937/9CA3AF?text=IMG'}" alt="thumb" />
                    </div>
                    <div>
                        <div style="color:#F9FAFB;font-weight:600;">${escapeHtml(d.Nome)}</div>
                        <small style="color:#9CA3AF;">TAG: ${escapeHtml(d.Tag)} · Linha: ${escapeHtml(d.Linha)}</small>
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

function createFaseCard(d, fase) {
    const p = d[`${fase}Percentual`];
    const ok = d[`${fase}Ok`];
    const plan = d[`${fase}Planejado`];
    const real = d[`${fase}Realizado`];
    
    return `
    <div class="fase-card">
        <div class="fase-head">
            <span class="fase-title">${fase}</span>
            <span class="badge ${p >= 100 ? 'ok' : p > 0 ? 'warn' : 'err'}">${p}%</span>
        </div>
        <div class="fase-body">
            <div class="toggle" title="Marcar ${fase} como OK">
                <input id="${fase}-${d.Id}" type="checkbox" ${ok ? "checked" : ""} data-action="toggle-dr" data-id="${d.Id}" data-fase="${fase}">
                <label for="${fase}-${d.Id}">
                    <span class="knob"><svg viewBox="0 0 24 24" class="check"><path d="M20 6L9 17l-5-5" /></svg></span>
                    <span class="txt">${ok ? "Concluído" : "Pendente"}</span>
                </label>
            </div>
            <small class="fase-info">
                Planejado: ${formatarData(plan)}<br />
                Realizado: ${formatarData(real)}
            </small>
        </div>
    </div>`;
}

// ==============================================
// RENDERIZAÇÃO PÁGINA: Dispositivos
// ==============================================
function renderDispositivos() {
    const tableBody = $('#dispositivos-table');
    if (!tableBody) return;
    
    const filtroClasse = $('#disp-filtro-classe');
    filtroClasse.innerHTML = '<option value="">(todas)</option>' + 
        state.classes.map(c => `<option value="${c.Id}">${escapeHtml(c.Nome)}</option>`).join('');
        
    const filtroTipo = $('#disp-filtro-tipo');
    filtroTipo.innerHTML = '<option value="">(todos)</option>' +
        tipoOptions.map(t => `<option value="${t.value}">${t.name}</option>`).join(''); // Ainda usa o enum antigo, OK para filtro

    const filtroNivel = $('#disp-filtro-nivel');
    filtroNivel.innerHTML = '<option value="">(todos)</option>' +
        nivelOptions.map(n => `<option value="${n.value}">${n.name}</option>`).join(''); // Ainda usa o enum antigo, OK para filtro

    const classeId = filtroClasse.value ? parseInt(filtroClasse.value) : null;
    const tipoVal = filtroTipo.value ? parseInt(filtroTipo.value) : null;
    const nivelVal = filtroNivel.value ? parseInt(filtroNivel.value) : null;
    const busca = $('#disp-filtro-busca').value.toLowerCase();
    
    const filtrados = state.dispositivos.filter(d => {
        const okClasse = !classeId || d.ClasseId === classeId;
        // Ajusta filtro de tipo e nível para buscar na string
        const okTipo = !tipoVal || (d.Tipo || '').toLowerCase().includes(filtroTipo.options[filtroTipo.selectedIndex].text.toLowerCase());
        const okNivel = !nivelVal || (d.Nivel || '').toLowerCase().includes(filtroNivel.options[filtroNivel.selectedIndex].text.toLowerCase());
        
        const okBusca = !busca || (d.Nome || '').toLowerCase().includes(busca) ||
                                (d.Tag || '').toLowerCase().includes(busca) ||
                                (d.Fornecedor || '').toLowerCase().includes(busca) ||
                                (d.Linha || '').toLowerCase().includes(busca);
        return okClasse && okTipo && okNivel && okBusca;
    });

    tableBody.innerHTML = '';
    filtrados.sort((a,b) => a.Nome.localeCompare(b.Nome)).forEach(d => {
        const classe = state.classes.find(c => c.Id === d.ClasseId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${d.ImagemPath || 'https://placehold.co/64x64/1F2937/9CA3AF?text=IMG'}" alt="img" style="width:28px;height:28px;object-fit:contain;background:#0f1522;border-radius:8px;border:1px solid rgba(255,255,255,.12);padding:2px;" /></td>
            <td>${escapeHtml(d.Nome)}</td>
            <td>${escapeHtml(d.Tag)}</td>
            <td>
                ${classe ? `<span class="badge" style="background:${classe.CorHex};">${escapeHtml(classe.Nome)}</span>` : '<span class="badge">—</span>'}
            </td>
            <td>${escapeHtml(d.Tipo)}</td>
            <td>${escapeHtml(d.Nivel)}</td>
            <td>${escapeHtml(d.Fornecedor) || '—'}</td>
            <td>${d.DR1Percentual}%</td>
            <td>${d.DoisDPercentual}%</td>
            <td>${d.PlanoSequenciaPercentual}%</td>
            <td>${d.ReleasePercentual}%</td>
        `;
        tableBody.appendChild(tr);
    });
}

// ==============================================
// RENDERIZAÇÃO PÁGINA: Cronograma
// ==============================================
function renderCronograma() {
    const startInput = $('#crono-start');
    const endInput = $('#crono-end');
    
    if (!startInput.value || !endInput.value) {
        const todasDatas = Object.values(state.milestones).flat().map(m => new Date(m.Data));
        if (todasDatas.length > 0) {
            const min = new Date(Math.min(...todasDatas));
            const max = new Date(Math.max(...todasDatas));
            startInput.value = formatarDataInput(new Date(min.setDate(min.getDate() - 7)));
            endInput.value = formatarDataInput(new Date(max.setDate(max.getDate() + 7)));
        } else {
            startInput.value = formatarDataInput(new Date(Date.now() - 30 * 86400000));
            endInput.value = formatarDataInput(new Date(Date.now() + 60 * 86400000));
        }
    }
    
    const start = new Date(startInput.value);
    const end = new Date(endInput.value);
    const escala = $('#crono-escala').value;
    const ticksContainer = $('#crono-scale-ticks');
    const rowsContainer = $('#crono-rows');
    
    ticksContainer.innerHTML = '';
    rowsContainer.innerHTML = '';
    
    const totalDays = Math.max(1, (end - start) / 86400000);
    
    const leftPct = (d) => {
        const date = new Date(d);
        if (isNaN(date)) return 0;
        const span = (end - start);
        if (span <= 0) return 0;
        const off = (date - start);
        const pct = (off / span) * 100.0;
        return Math.max(0, Math.min(100, pct));
    };

    let d = new Date(start);
    while (d <= end) {
        const tick = document.createElement('div');
        tick.className = 'tick';
        let label = '';
        let widthPct = 0;
        
        if (escala === 'dia') {
            label = `${d.getDate()}/${d.getMonth()+1}`;
            widthPct = (1 / totalDays) * 100.0;
            d.setDate(d.getDate() + 1);
        } else if (escala === 'mes') {
            const dIni = new Date(d);
            const dFim = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            label = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
            
            const diasNoTick = (Math.min(end, dFim) - Math.max(start, dIni)) / 86400000 + 1;
            widthPct = (diasNoTick / totalDays) * 100.0;
            d.setMonth(d.getMonth() + 1);
            d.setDate(1);
        } else { // Semana
            const dIni = new Date(d);
            const dFim = new Date(d.setDate(d.getDate() + 6));
            label = `${dIni.getDate()}/${dIni.getMonth()+1}`;
            
            const diasNoTick = (Math.min(end, dFim) - Math.max(start, dIni)) / 86400000 + 1;
            widthPct = (diasNoTick / totalDays) * 100.0;
            d.setDate(d.getDate() + 1);
        }
        
        tick.style.width = `${widthPct}%`;
        tick.textContent = label;
        ticksContainer.appendChild(tick);
    }

    state.classes.forEach(c => {
        const row = document.createElement('div');
        row.className = 'gantt-row';
        const milestones = state.milestones[c.Id] || [];
        let msHtml = '';
        
        if (c.DataBase) {
            msHtml += `<div class="base-line" style="left:${leftPct(c.DataBase)}%; background:${c.CorHex || '#6b7280'};"></div>`;
        }
        
        milestones.forEach(m => {
            msHtml += `
            <div class="ms" title="${escapeHtml(m.Nome)} — ${formatarData(m.Data)}" style="left:${leftPct(m.Data)}%;">
                <span class="pin ${m.IsMain ? "main" : ""}"></span>
                <span class="label">${escapeHtml(m.Nome)}</span>
            </div>
            `;
        });
        
        row.innerHTML = `
            <div class="left">
                <div class="cls">
                    <span class="dot" style="background:${c.CorHex || "#6b7280"};"></span>
                    <strong>${escapeHtml(c.Nome)}</strong>
                </div>
                <small class="meta">
                    ${c.DataBase ? `Base: ${formatarData(c.DataBase)} · ` : ""}
                    ${c.Percentual}% · ${c.Horas}h
                </small>
            </div>
            <div class="right">
                <div class="lane">${msHtml}</div>
            </div>
        `;
        rowsContainer.appendChild(row);
    });
}

// ==============================================
// RENDERIZAÇÃO PÁGINA: Dashboard
// ==============================================
function renderDashboardData() {
    let total = 0, prazo = 0, atraso = 0, concluido = 0, standby = 0, simulacao = 0, somaPercent = 0;
    
    state.dispositivos.forEach(d => {
        total++;
        const status = d.StatusManual;
        
        if (status === StatusManual.Standby) standby++;
        else if (status === StatusManual.Concluido) concluido++;
        else if (status === StatusManual.EmAtraso) atraso++;
        else if (status === StatusManual.EmSimulacao) simulacao++;
        else if (status === StatusManual.NoPrazo) prazo++;
        
        somaPercent += (d.DR1Percentual + d.DR2Percentual + d.DR3Percentual + d.DoisDPercentual + d.PlanoSequenciaPercentual + d.ReleasePercentual) / 6.0;
    });
    
    const media = total > 0 ? somaPercent / total : 0;
    
    $('#dash-kpi-total').textContent = total;
    $('#dash-kpi-prazo').textContent = prazo;
    $('#dash-kpi-atraso').textContent = atraso;
    $('#dash-kpi-concluido').textContent = concluido;
    $('#dash-kpi-standby').textContent = `Standby: ${standby}`;
    $('#dash-kpi-simulacao').textContent = `Em Simulação: ${simulacao}`;
    
    $('#dash-meter-bar').style.width = `${media.toFixed(1)}%`;
    $('#dash-meter-label').textContent = `${media.toFixed(1)}%`;
    
    const tableBody = $('#dash-milestones-table');
    tableBody.innerHTML = '';
    const hojeDate = new Date();
    hojeDate.setHours(0, 0, 0, 0);
    
    const proximos = Object.values(state.milestones).flat()
        .filter(m => new Date(m.Data) >= hojeDate)
        .sort((a,b) => (a.Data > b.Data ? 1 : -1))
        .slice(0, 5);
        
    proximos.forEach(m => {
        const classe = state.classes.find(c => c.Id === m.ClasseId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatarData(m.Data)}</td>
            <td>
                ${classe ? `<span class="badge" style="background:${classe.CorHex};">${escapeHtml(classe.Nome)}</span>` : '—'}
            </td>
            <td>${escapeHtml(m.Nome)} ${m.IsMain ? "(Main)" : ""}</td>
        `;
        tableBody.appendChild(tr);
    });
    if (proximos.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3"><div class="badge warn">Sem marcos futuros.</div></td></tr>';
    }
    
    updateDashboardCharts();
}

function initDashboardCharts() {
    Chart.defaults.color = 'rgba(156, 163, 175, 0.7)';
    Chart.defaults.font.family = "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, 'Helvetica Neue', Arial";
    Chart.defaults.plugins.legend.position = 'bottom';
    
    const ctxStatus = $('#chart-status');
    if (ctxStatus) {
         chartStatusInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    label: 'Status dos Dispositivos',
                    data: [],
                    backgroundColor: [
                        'rgba(245, 158, 11, 0.7)', // warn
                        'rgba(239, 68, 68, 0.7)',  // error
                        'rgba(37, 99, 235, 0.7)',  // primary-light
                        'rgba(16, 185, 129, 0.7)', // success
                        'rgba(107, 114, 128, 0.7)' // gray
                    ],
                    borderColor: '#1F2937',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#9CA3AF'
                        }
                    }
                }
            }
        });
    }
    
    const ctxFases = $('#chart-fases');
    if (ctxFases) {
        chartFasesInstance = new Chart(ctxFases, {
            type: 'bar',
            data: {
                labels: ['DR1', 'DR2', 'DR3', '2D', 'PS', 'Release'],
                datasets: [{
                    label: 'Média de Conclusão (%)',
                    data: [],
                    backgroundColor: [
                        'rgba(14, 165, 233, 0.7)',
                        'rgba(34, 197, 94, 0.7)', 
                        'rgba(245, 158, 11, 0.7)',
                        'rgba(168, 85, 247, 0.7)',
                        'rgba(236, 72, 153, 0.7)',
                        'rgba(239, 68, 68, 0.7)'
                    ],
                    borderColor: '#1F2937',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            callback: (value) => value + '%'
                        }
                    },
                    y: {
                         grid: {
                            display: false
                         }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}

function updateDashboardCharts() {
    if (!chartStatusInstance || !chartFasesInstance) return;
    
    let counts = { NoPrazo: 0, EmAtraso: 0, EmSimulacao: 0, Concluido: 0, Standby: 0 };
    state.dispositivos.forEach(d => {
        counts[d.StatusManual]++;
    });
    
    chartStatusInstance.data.labels = [
        `No Prazo (${counts.NoPrazo})`,
        `Em Atraso (${counts.EmAtraso})`,
        `Em Simulação (${counts.EmSimulacao})`,
        `Concluído (${counts.Concluido})`,
        `Standby (${counts.Standby})`
    ];
    chartStatusInstance.data.datasets[0].data = [
        counts.NoPrazo,
        counts.EmAtraso,
        counts.EmSimulacao,
        counts.Concluido,
        counts.Standby
    ];
    chartStatusInstance.update();
    
    let fases = { DR1: 0, DR2: 0, DR3: 0, DoisD: 0, PlanoSequencia: 0, Release: 0 };
    const totalDisp = state.dispositivos.length;
    
    if (totalDisp > 0) {
         state.dispositivos.forEach(d => {
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
         chartFasesInstance.data.datasets[0].data = [0,0,0,0,0,0];
    }
    chartFasesInstance.update();
}


// ==============================================
// RENDERIZAÇÃO PÁGINA: Kanban
// ==============================================
let draggingElement = null;

function renderKanban() {
    const cols = {
        NoPrazo: $('#kanban-list-prazo'),
        EmAtraso: $('#kanban-list-atraso'),
        EmSimulacao: $('#kanban-list-simulacao'),
        Concluido: $('#kanban-list-concluido'),
        Standby: $('#kanban-list-standby')
    };
    
    Object.values(cols).forEach(col => col.innerHTML = '');
    
    let counts = { NoPrazo: 0, EmAtraso: 0, EmSimulacao: 0, Concluido: 0, Standby: 0 };
    
    state.dispositivos.forEach(d => {
        const status = d.StatusManual;
        counts[status]++;
        
        const targetCol = cols[status];
        if (!targetCol) return; 
        
        const card = document.createElement('article');
        card.className = 'kanban-card';
        card.draggable = true;
        card.dataset.id = d.Id;
        
        const media = (d.DR1Percentual + d.DR2Percentual + d.DR3Percentual + d.DoisDPercentual + d.PlanoSequenciaPercentual + d.ReleasePercentual) / 6.0;
        
        card.innerHTML = `
            <div class="card-head">
                <div class="thumb">
                    <img src="${d.ImagemPath || 'https://placehold.co/64x64/1F2937/9CA3AF?text=IMG'}" alt="thumb" />
                </div>
                <div class="meta">
                    <div class="title">${escapeHtml(d.Nome)}</div>
                    <small class="subtitle">TAG: ${escapeHtml(d.Tag)} · Linha: ${escapeHtml(d.Linha)}</small>
                </div>
            </div>
            <div class="mini-progress">
                <div class="mini-progress-bar" style="width:${media.toFixed(1)}%;"></div>
                <span>${media.toFixed(1)}%</span>
            </div>
        `;
        
        card.addEventListener('dragstart', (e) => {
            draggingElement = e.target.closest('.kanban-card');
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => card.style.opacity = '0.5', 0);
        });
        card.addEventListener('dragend', (e) => {
            card.style.opacity = '1';
            draggingElement = null;
        });

        targetCol.appendChild(card);
    });
    
    $('#kanban-label-prazo').textContent = `(${counts.NoPrazo})`;
    $('#kanban-label-atraso').textContent = `(${counts.EmAtraso})`;
    $('#kanban-label-simulacao').textContent = `(${counts.EmSimulacao})`;
    $('#kanban-label-concluido').textContent = `(${counts.Concluido})`;
    $('#kanban-label-standby').textContent = `(${counts.Standby})`;
}

function setupKanbanDropZones() {
    $$('.kanban-col').forEach(col => {
        col.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            col.classList.add('over');
        });
        col.addEventListener('dragleave', e => col.classList.remove('over'));
        col.addEventListener('drop', e => {
            e.preventDefault();
            col.classList.remove('over');
            if (draggingElement) {
                const list = col.querySelector('.kanban-list');
                list.appendChild(draggingElement);
                
                const id = parseInt(draggingElement.dataset.id);
                const newStatus = col.dataset.status; 
                
                const disp = state.dispositivos.find(d => d.Id === id);
                if (disp && disp.StatusManual !== newStatus) {
                    disp.StatusManual = newStatus;
                    showToast(`Dispositivo #${id} movido para ${newStatus}.`, 'ok');
                    
                    renderKanban(); 
                    renderDashboardData();
                }
            }
        });
    });
}

// ==============================================
// RENDERIZAÇÃO PÁGINA: Recurso
// ==============================================
function renderRecurso() {
    if (!$('#rec-data-inicio').value) $('#rec-data-inicio').value = hoje;
    if (!$('#rec-data-fim').value) {
        const fim = new Date();
        fim.setDate(fim.getDate() + 14);
        $('#rec-data-fim').value = formatarDataInput(fim);
    }
    calcularRecurso();
}

function calcularRecurso() {
    const horasPlan = parseFloat($('#rec-horas-plan').value) || 0;
    const horasDia = parseFloat($('#rec-horas-dia').value) || 8;
    const ineficiencia = parseFloat($('#rec-ineficiencia').value) || 0;
    const start = new Date($('#rec-data-inicio').value);
    const end = new Date($('#rec-data-fim').value);
    
    const diasUteis = contarDiasUteis(start, end);
    $('#rec-dias-uteis').textContent = `Dias úteis no período: ${diasUteis}`;
    
    if (horasDia <= 0 || diasUteis <= 0) {
        $('#rec-status-msg').textContent = "Período ou horas/dia inválidos.";
        $('#rec-res-horas-ajustadas').textContent = "0 h";
        $('#rec-res-capacidade').textContent = "0 h";
        $('#rec-res-pessoas').textContent = "0";
        return;
    }
    
    const horasAjustadas = horasPlan * (1.0 + Math.max(0.0, ineficiencia));
    const capacidadePessoa = horasDia * diasUteis;
    const pessoas = horasAjustadas / capacidadePessoa;
    
    $('#rec-res-horas-ajustadas').textContent = `${horasAjustadas.toFixed(2)} h`;
    $('#rec-res-capacidade').textContent = `${capacidadePessoa.toFixed(2)} h`;
    $('#rec-res-pessoas').textContent = (Math.ceil(pessoas * 100.0) / 100.0).toFixed(2);
    $('#rec-status-msg').textContent = "Cálculo atualizado.";
}

function contarDiasUteis(inicio, fim) {
    if (fim < inicio) return 0;
    let count = 0;
    const d = new Date(inicio);
    while (d <= fim) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) {
            count++;
        }
        d.setDate(d.getDate() + 1);
    }
    return count;
}

// ==============================================
// HELPERS (Formatação, Toasts, etc.)
// ==============================================
function escapeHtml(s) {
    return (s || '')
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

function formatarData(date) {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d)) return '—';
    if (typeof date === 'string') d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('pt-BR');
}

function formatarDataInput(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const liveAnnounce = (msg) => {
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
};

const showToast = (msg, type = "ok", timeout = 3200) => {
    const container = $("#toast-container");
    if (!container) return;
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="dot" aria-hidden="true"></span><div>${escapeHtml(msg)}</div>`;
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
        t.classList.remove("show");
        setTimeout(() => t.remove(), 300);
    }, timeout);
    liveAnnounce(msg);
};

function enhanceNav() {
    const nav = document.querySelector("nav.top-nav");
    const menu = nav ? nav.querySelector(".menu") : null;
    if (!nav || !menu) return;
    nav.style.position = "relative";
    const ink = document.createElement("span");
    ink.className = "inkbar";
    nav.appendChild(ink);

    const moveInk = (el, animate = true) => {
        if (!el) return;
        try {
            const menuRect = menu.getBoundingClientRect();
            const rect = el.getBoundingClientRect();
            const left = rect.left - menuRect.left + menu.scrollLeft + 4;
            const width = Math.max(0, rect.width - 8);
            if (!animate) ink.style.transition = "none";
            ink.style.width = width + "px";
            ink.style.transform = `translateX(${left}px)`;
            if (!animate) requestAnimationFrame(() => (ink.style.transition = ""));
        } catch(e) {}
    };
    window.SiteUX = { ...window.SiteUX, moveInk };
    
    const activeOrFirst = () => menu.querySelector(".nav-link.active") || menu.querySelector(".nav-link");
    setTimeout(() => moveInk(activeOrFirst(), false), 100);

    menu.addEventListener("mouseover", (e) => moveInk(e.target.closest(".nav-link")));
    menu.addEventListener("focusin", (e) => moveInk(e.target.closest(".nav-link")));
    menu.addEventListener("mouseleave", () => moveInk(activeOrFirst()));
    menu.addEventListener("focusout", (e) => {
        if (!menu.contains(e.relatedTarget)) moveInk(activeOrFirst());
    });
    window.addEventListener("resize", () => moveInk(activeOrFirst(), false));
}

// ==============================================
// INICIALIZAÇÃO E EVENT LISTENERS
// ==============================================
document.addEventListener('DOMContentLoaded', () => {
    enhanceNav();
    setupKanbanDropZones();
    initDashboardCharts();
    gerarDadosDemo();
    showPage('setup');

    // --- LISTENERS GLOBAIS (delegação) ---
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        
        const navLink = target.closest('.nav-link');
        if (navLink && navLink.dataset.page) {
            e.preventDefault();
            showPage(navLink.dataset.page);
        }
        
        // --- Ações Setup ---
        if (target.dataset.action === 'select-classe') {
            const id = parseInt(target.dataset.id);
            state.selectedClasseId = state.selectedClasseId === id ? null : id;
            renderSetup();
            if (state.selectedClasseId) {
                setupFormMilestoneLimpar();
            }
        }
        if (target.dataset.action === 'edit-classe') {
            const classe = state.classes.find(c => c.Id === parseInt(target.dataset.id));
            if (classe) {
                state.editClasseId = classe.Id;
                $('#setup-form-classe-title').textContent = `Editar Classe #${classe.Id}`;
                $('#setup-classe-salvar').textContent = "Salvar";
                $('#setup-classe-nome').value = classe.Nome;
                $('#setup-classe-cor').value = classe.CorHex;
                $('#setup-classe-percent').value = classe.Percentual;
                $('#setup-classe-horas').value = classe.Horas;
                $('#setup-classe-data').value = formatarDataInput(classe.DataBase);
                $('#setup-classe-projetoid').value = classe.ProjetoId || '';
            }
        }
        if (target.dataset.action === 'delete-classe') {
            if (confirm('Tem certeza que quer excluir esta classe?')) {
                const id = parseInt(target.dataset.id);
                state.classes = state.classes.filter(c => c.Id !== id);
                delete state.milestones[id];
                if (state.selectedClasseId === id) state.selectedClasseId = null;
                renderSetup();
                showToast("Classe excluída.", "ok");
            }
        }
        if (target.dataset.action === 'add-dispositivo') {
            abrirModalDispositivo(parseInt(target.dataset.id));
        }

        // --- Ações Milestone ---
        if (target.dataset.action === 'edit-ms') {
            const ms = (state.milestones[state.selectedClasseId] || []).find(m => m.Id === parseInt(target.dataset.id));
            if (ms) {
                state.editMilestoneId = ms.Id;
                $('#setup-ms-salvar').textContent = "Salvar";
                $('#setup-ms-nome').value = ms.Nome;
                $('#setup-ms-data').value = formatarDataInput(ms.Data);
                $('#setup-ms-ordem').value = ms.Ordem;
                $('#setup-ms-main').checked = ms.IsMain;
            }
        }
        if (target.dataset.action === 'delete-ms') {
                if (confirm('Tem certeza que quer excluir este milestone?')) {
                    const id = parseInt(target.dataset.id);
                    if (state.milestones[state.selectedClasseId]) {
                        state.milestones[state.selectedClasseId] = state.milestones[state.selectedClasseId].filter(m => m.Id !== id);
                    }
                    renderSetup();
                    showToast("Milestone excluído.", "ok");
                }
        }
        
        // --- Ações Descrição Evento ---
        if (target.dataset.action === 'toggle-dr') {
            const id = parseInt(target.dataset.id);
            const fase = target.dataset.fase;
            const disp = state.dispositivos.find(d => d.Id === id);
            if (disp) {
                const isChecked = target.checked;
                disp[`${fase}Ok`] = isChecked;
                disp[`${fase}Percentual`] = isChecked ? 100 : 0;
                disp[`${fase}Realizado`] = isChecked ? new Date() : null;
                renderDescricaoEvento();
                renderDashboardData();
            }
        }
    });
    
    // --- LISTENERS DE BOTÕES ESPECÍFICOS ---
    
    // Setup
    $('#setup-recarregar').addEventListener('click', () => {
        renderSetup();
        showToast("Dados recarregados.", "ok");
    });
    $('#setup-gerar-demo').addEventListener('click', gerarDadosDemo);
    $('#setup-nova-classe').addEventListener('click', setupFormClasseLimpar);
    $('#setup-classe-salvar').addEventListener('click', setupFormClasseSalvar);
    $('#setup-classe-limpar').addEventListener('click', setupFormClasseLimpar);
    $('#setup-milestone-novo').addEventListener('click', setupFormMilestoneLimpar);
    $('#setup-ms-salvar').addEventListener('click', setupFormMilestoneSalvar);
    $('#setup-ms-limpar').addEventListener('click', setupFormMilestoneLimpar);
    
    // Modal Dispositivo (frmInserirDispositivo)
    $('#modal-disp-fechar').addEventListener('click', fecharModalDispositivo);
    $('#frmInserirDispositivo-backdrop').addEventListener('click', fecharModalDispositivo);
    $('#modal-disp-salvar').addEventListener('click', frmInserirDispositivo_Salvar);
    $('#modal-disp-novo').addEventListener('click', frmInserirDispositivo_Novo);
    $('#modal-disp-copiar').addEventListener('click', frmInserirDispositivo_Copiar);
    $('#modal-disp-excluir').addEventListener('click', frmInserirDispositivo_Excluir);
    $('#modal-disp-horas').addEventListener('click', abrirHorasModal);
    $('#modal-disp-inserir-img').addEventListener('click', () => {
         showToast("Função 'Inserir Imagem' não implementada (simulação).", "warn");
    });

    // Modal Horas (frmInserirHORAS)
    $('#modal-horas-fechar').addEventListener('click', fecharHorasModal);
    $('#horas-modal-backdrop').addEventListener('click', fecharHorasModal);
    $('#modal-horas-salvar').addEventListener('click', salvarHorasModal);
    
    // Dispositivos (filtros)
    $('#disp-filtro-classe').addEventListener('change', renderDispositivos);
    $('#disp-filtro-tipo').addEventListener('change', renderDispositivos);
    $('#disp-filtro-nivel').addEventListener('change', renderDispositivos);
    $('#disp-filtro-busca').addEventListener('input', renderDispositivos);

    // Cronograma
    $('#crono-recarregar').addEventListener('click', renderCronograma);
    
    // Recurso
    $('#rec-calcular').addEventListener('click', calcularRecurso);
});
