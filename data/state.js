/* data/state.js - shared state manager */
(function (w) {
    const STORAGE_KEY = "controleStatus:v1";

    function defaultState() {
        return {
            projects: [],
            projetos: [],
            setup: { classes: [], dispositivosCatalogo: [] },
            ui: { currentProjectId: null },
            // compat fields usados pelos scripts atuais
            projetoId: 1,
            projetoIdAtual: 1,
            classes: [],
            milestones: {},
            dispositivos: []
        };
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultState();
            const st = JSON.parse(raw);
            return { ...defaultState(), ...st };
        } catch {
            return defaultState();
        }
    }

    function save(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state || defaultState()));
        } catch { /* ignore */ }
    }

    function migrate(state) {
        // Legacy keys to migrate from
        try {
            const legacy = localStorage.getItem("ps:state:v2");
            if (legacy) {
                const j = JSON.parse(legacy);
                state.projetoId = j.projetoIdAtual || j.projetoId || state.projetoId || 1;
                state.projetoIdAtual = state.projetoId;
                state.projetos = j.projetos || state.projetos || [];
                state.projects = state.projects?.length ? state.projects : (state.projetos || []);
                state.classes = j.classes || state.classes || [];
                state.setup = state.setup || { classes: [] };
                state.setup.classes = state.classes;
                state.milestones = j.milestones || state.milestones || {};
                state.dispositivos = j.dispositivos || state.dispositivos || [];
                state.ui = state.ui || { currentProjectId: state.projetoId };
                localStorage.removeItem("ps:state:v2");
            }
            const projLegacy = localStorage.getItem("projects");
            if (projLegacy) {
                state.projects = JSON.parse(projLegacy) || state.projects;
                state.projetos = state.projects;
                localStorage.removeItem("projects");
            }
            const clsLegacy = localStorage.getItem("classes");
            if (clsLegacy) {
                state.classes = JSON.parse(clsLegacy) || state.classes;
                state.setup = state.setup || {};
                state.setup.classes = state.classes;
                localStorage.removeItem("classes");
            }
            const dispLegacy = localStorage.getItem("dispositivos");
            if (dispLegacy) {
                state.dispositivos = JSON.parse(dispLegacy) || state.dispositivos;
                localStorage.removeItem("dispositivos");
            }
        } catch { /* ignore migrate errors */ }
        // ensure aliases
        state.projects = state.projects?.length ? state.projects : (state.projetos || []);
        state.projetos = state.projetos?.length ? state.projetos : (state.projects || []);
        state.setup = state.setup || { classes: [], dispositivosCatalogo: [] };
        state.classes = state.classes?.length ? state.classes : (state.setup.classes || []);
        state.setup.classes = state.setup.classes?.length ? state.setup.classes : state.classes;
        if (!state.ui) state.ui = { currentProjectId: state.projetoIdAtual || state.projetoId || (state.projects[0]?.id || null) };
        if (!state.projetoIdAtual) state.projetoIdAtual = state.ui.currentProjectId || state.projetoId || (state.projects[0]?.id || 1);
        state.projetoId = state.projetoId || state.projetoIdAtual || 1;
        return state;
    }

    function reset() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem("ps:state:v2");
            localStorage.removeItem("projects");
            localStorage.removeItem("classes");
            localStorage.removeItem("dispositivos");
            localStorage.removeItem("setup_classes");
        } catch { /* ignore */ }
        location.reload();
    }

    w.State = { STORAGE_KEY, defaultState, load, save, migrate, reset };
})(window);
