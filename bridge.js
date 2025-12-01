// bridge.js v2 - store/bus/snapshots/metrics helpers
(function () {
    const KEYS = {
        STATE: "ps:state:v2",
        METRICS: "ps:metrics:v2",
        SNAP: (pid) => `ps:snapshots:v2:${pid}`,
        LASTTAB: (pid) => `ps:lastTab:${pid}`
    };

    function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
    function todayISO() { return new Date().toISOString().split("T")[0]; }

    const bus = (() => {
        let bc = null;
        try { bc = new BroadcastChannel("ps:bus"); } catch { }
        const emit = (t, payload) => {
            if (bc) bc.postMessage({ t, payload });
            try { localStorage.setItem(`__bus__${t}`, String(Date.now())); } catch { }
            window.dispatchEvent(new CustomEvent(t, { detail: payload }));
        };
        const on = (t, fn) => {
            if (bc) bc.onmessage = (ev) => { if (ev?.data?.t === t) fn(ev.data.payload); };
            window.addEventListener(t, (e) => fn(e.detail));
            window.addEventListener("storage", (e) => { if (e.key === `__bus__${t}`) fn(null); });
        };
        return { emit, on };
    })();

    const utils = {
        todayISO,
        toISO(d) { return d ? new Date(d).toISOString() : null; },
        computeDeviceStatus(d) {
            if (d.Standby) return "Standby";
            const all100 =
                (d.DR1Percentual || 0) >= 100 &&
                (d.DR2Percentual || 0) >= 100 &&
                (d.DR3Percentual || 0) >= 100 &&
                (d.DoisDPercentual || 0) >= 100 &&
                (d.PlanoSequenciaPercentual || 0) >= 100 &&
                (d.ReleasePercentual || 0) >= 100;
            if (d.ReleaseOk || all100) return "Concluido";
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
            ) return "EmAtraso";
            return "NoPrazo";
        },
        effectiveStatus(d) {
            return d.StatusOverride ?? d.StatusComputed ?? utils.computeDeviceStatus(d);
        },
        selectClassesByProject(state, pid) {
            return (state.classes || []).filter((c) => (c.ProjetoId || 1) === pid);
        },
        selectDispsByProject(state, pid) {
            const cls = utils.selectClassesByProject(state, pid);
            const ids = new Set(cls.map((c) => c.Id));
            return (state.dispositivos || []).filter((d) => ids.has(d.ClasseId));
        },
        setLastTab(pid, tab) {
            try { localStorage.setItem(KEYS.LASTTAB(pid), tab); } catch { }
        },
        getLastTab(pid) {
            try { return localStorage.getItem(KEYS.LASTTAB(pid)) || "setup"; } catch { return "setup"; }
        }
    };

    const metrics = {
        recalc(state) {
            const projetoId = state.projetoIdAtual || 1;
            const dispositivos = utils.selectDispsByProject(state, projetoId);
            const classesProj = utils.selectClassesByProject(state, projetoId);
            const clsIds = new Set(classesProj.map((c) => c.Id));
            const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
            const in30 = new Date(hoje); in30.setDate(in30.getDate() + 30);
            let marcos = 0;
            Object.values(state.milestones || {}).forEach((arr) => {
                (arr || []).forEach((m) => {
                    if (!clsIds.has(m.ClasseId)) return;
                    const d = new Date(m.Data);
                    if (d >= hoje && d <= in30) marcos++;
                });
            });
            const data = {
                projetos: (state.projetos || []).filter((p) => p.Ativo !== false).length || 1,
                dispositivos: dispositivos.length || 0,
                marcos
            };
            try { localStorage.setItem(KEYS.METRICS, JSON.stringify(data)); } catch { }
            return data;
        }
    };

    const snapshots = {
        record(state) {
            const pid = state.projetoIdAtual || 1;
            const key = KEYS.SNAP(pid);
            const dispositivos = utils.selectDispsByProject(state, pid);
            const total = dispositivos.length || 0;
            let soma = 0;
            dispositivos.forEach((d) => {
                soma += ((d.DR1Percentual || 0) + (d.DR2Percentual || 0) + (d.DR3Percentual || 0) + (d.DoisDPercentual || 0) + (d.PlanoSequenciaPercentual || 0) + (d.ReleasePercentual || 0)) / 6;
            });
            const media = total ? soma / total : 0;
            let arr = [];
            try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch { arr = []; }
            const last = arr[arr.length - 1];
            if (!last || Math.abs((last.media || 0) - media) > 0.01 || Date.now() - (last.ts || 0) > 60000) {
                arr.push({ ts: Date.now(), media });
                if (arr.length > 200) arr = arr.slice(-200);
                try { localStorage.setItem(key, JSON.stringify(arr)); } catch { }
                bus.emit("snapshot:recorded", { projectId: pid });
            }
        },
        list(pid) {
            const key = KEYS.SNAP(pid);
            try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
        }
    };

    const store = (() => {
        let state = null;
        function ensureState() {
            if (!state) {
                try {
                    const raw = localStorage.getItem(KEYS.STATE);
                    if (raw) state = JSON.parse(raw);
                } catch { state = null; }
            }
            if (!state || state.schemaVersion !== 2) {
                const now = todayISO();
                state = {
                    schemaVersion: 2,
                    projetoIdAtual: 1,
                    projetos: [{ Id: 1, Nome: "Projeto 1", Ativo: true, CriadoEm: now, AtualizadoEm: now }],
                    classes: [],
                    milestones: {},
                    dispositivos: []
                };
                persist(false);
            }
            if (!state.projetos || state.projetos.length === 0) {
                const now = todayISO();
                state.projetos = [{ Id: 1, Nome: "Projeto 1", Ativo: true, CriadoEm: now, AtualizadoEm: now }];
                state.projetoIdAtual = 1;
                persist(false);
            }
        }
        function init() {
            ensureState();
            return getState();
        }
        function persist(emit = true) {
            try {
                state.schemaVersion = 2;
                localStorage.setItem(KEYS.STATE, JSON.stringify(state));
                metrics.recalc(state);
                if (emit) bus.emit("state:changed", { projectId: state.projetoIdAtual });
            } catch { }
        }
        function getState() { ensureState(); return clone(state); }
        function setState(next, emit = true) {
            state = clone(next);
            ensureState();
            persist(emit);
        }
        function patch(mutator, emit = true) {
            const draft = getState();
            mutator(draft);
            state = draft;
            ensureState();
            persist(emit);
        }
        function selectProject(id) {
            const nextId = Number(id) || 1;
            patch((s) => { s.projetoIdAtual = nextId; }, true);
            bus.emit("project:changed", { projectId: nextId });
        }
        function createProject(nome) {
            const now = todayISO();
            let createdId = 1;
            patch((s) => {
                const nextId = Math.max(0, ...s.projetos.map((p) => p.Id)) + 1;
                createdId = nextId;
                s.projetos.push({ Id: nextId, Nome: nome || `Projeto ${nextId}`, Ativo: true, CriadoEm: now, AtualizadoEm: now });
                s.projetoIdAtual = nextId;
            }, true);
            return createdId;
        }
        return { init, getState, setState, patch, selectProject, createProject, persist };
    })();

    window.PS = { store, bus, snapshots, metrics, utils, KEYS };
})();
