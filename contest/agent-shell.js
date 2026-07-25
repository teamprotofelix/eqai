/**
 * EQAI Contest Agent Shell
 * Renders strategy + execution UI from window.AGENT_CONFIG
 * Offline / API-disconnected demo mode with full agent workflow feel.
 */
(function () {
  function showFatal(msg) {
    var root = document.getElementById("app") || document.body;
    var box = document.createElement("div");
    box.setAttribute("role", "alert");
    box.style.cssText =
      "max-width:720px;margin:2rem auto;padding:1.2rem 1.4rem;border-radius:16px;" +
      "background:rgba(127,29,29,.45);border:1px solid rgba(248,113,113,.5);color:#fecaca;" +
      "font-family:system-ui,sans-serif;line-height:1.5";
    box.innerHTML =
      "<strong>에이전트 UI 로드 오류</strong><br>" +
      String(msg || "unknown") +
      '<br><br><a href="index.html" style="color:#67e8f9;font-weight:700">← 아이디어 뱅크로</a>';
    if (root.id === "app") root.appendChild(box);
    else document.body.insertBefore(box, document.body.firstChild);
  }

  var cfg = window.AGENT_CONFIG;
  if (!cfg || !cfg.id) {
    console.error("AGENT_CONFIG missing");
    showFatal("AGENT_CONFIG가 없거나 id가 없습니다.");
    return;
  }

  try {
  // --- main agent UI (errors surface via showFatal) ---

  var themes = ["lab", "ops", "radar", "matrix", "coach", "board", "stream", "console"];
  var accents = ["cyan", "violet", "emerald", "amber", "rose", "teal", "orange"];
  var layout = themes.indexOf(cfg.layout) >= 0 ? cfg.layout : "lab";
  var accent = accents.indexOf(cfg.accent) >= 0 ? cfg.accent : "cyan";

  document.body.classList.add("layout-" + layout, "accent-" + accent);
  document.title = (cfg.title || cfg.name) + " | EQAI Contest";

  /** Coerce config fields so a broken generator never blanks the whole page */
  function asArray(v) {
    if (Array.isArray(v)) return v;
    if (v == null || v === "") return [];
    if (typeof v === "string") return [v];
    return [];
  }
  function asStepList(v) {
    return asArray(v)
      .map(function (s, i) {
        if (s && typeof s === "object") {
          return {
            title: s.title || s.name || "단계 " + (i + 1),
            detail: s.detail || s.desc || "",
            log: s.log || "",
            bullets: asArray(s.bullets)
          };
        }
        return { title: String(s), detail: "", log: "", bullets: [] };
      })
      .filter(function (s) {
        return s.title;
      });
  }
  function asDelivList(v) {
    return asArray(v).map(function (d, i) {
      if (d && typeof d === "object") {
        return {
          title: d.title || "산출물 " + (i + 1),
          hint: d.hint || "",
          sample: d.sample || d.body || "",
          body: d.body || ""
        };
      }
      return { title: String(d), hint: "", sample: "", body: "" };
    });
  }
  function asToolList(v) {
    return asArray(v).map(function (t) {
      return typeof t === "string" ? t : String((t && t.label) || t || "");
    }).filter(Boolean);
  }

  var strategies = asStepList(cfg.strategies);
  var executions = asStepList(cfg.executions);
  var deliverables = asDelivList(cfg.deliverables);
  var tools = asToolList(cfg.tools);
  if (!strategies.length) {
    strategies = [
      { title: "미션 파악", detail: "입력을 정규화하고 목표를 고정합니다.", log: "ingest", bullets: [] },
      { title: "전략 수립", detail: "실행 경로와 우선순위를 정합니다.", log: "plan", bullets: [] },
      { title: "검증 포인트", detail: "리스크·공백을 표시합니다.", log: "validate", bullets: [] }
    ];
  }
  if (!executions.length) {
    executions = [
      { title: "파이프라인 실행", detail: "전략 단계에 따라 작업을 수행합니다.", log: "run", bullets: [] },
      { title: "결과 패키징", detail: "산출물 슬롯을 채웁니다.", log: "pack", bullets: [] }
    ];
  }
  if (!deliverables.length) {
    deliverables = [
      { title: "요약", hint: "한 장 요약", sample: "시연 요약\n{{seed}}", body: "" },
      { title: "다음 액션", hint: "후속", sample: "API 연결 후 동일 파이프라인 가동\n{{seed}}", body: "" }
    ];
  }
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var running = false;
  var toastTimer = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toolHtml() {
    if (!tools.length) return "";
    return (
      '<div class="tool-grid" id="tools">' +
      tools
        .map(function (t, i) {
          var checked = i < Math.max(2, Math.ceil(tools.length * 0.7)) ? " checked" : "";
          return (
            '<label class="tool-chip"><input type="checkbox"' +
            checked +
            "> " +
            esc(t) +
            "</label>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function stepsHtml(list, idPrefix, emptyHint) {
    if (!list.length) {
      return '<p class="placeholder">' + esc(emptyHint || "단계 정의 없음") + "</p>";
    }
    return (
      '<div class="' +
      (idPrefix === "st" ? "strategy-list" : "exec-list") +
      '" id="' +
      idPrefix +
      '-list">' +
      list
        .map(function (s, i) {
          var detail = s.detail || "";
          var bullets = s.bullets || [];
          var body =
            "<p>" +
            esc(detail) +
            "</p>" +
            (bullets.length
              ? "<ul>" +
                bullets
                  .map(function (b) {
                    return "<li>" + esc(b) + "</li>";
                  })
                  .join("") +
                "</ul>"
              : "");
          return (
            '<div class="step" data-step="' +
            i +
            '" id="' +
            idPrefix +
            "-" +
            i +
            '">' +
            '<button type="button" class="step-head" data-toggle="' +
            idPrefix +
            "-" +
            i +
            '">' +
            '<span class="step-num">' +
            (i + 1) +
            "</span>" +
            '<span class="step-title">' +
            esc(s.title) +
            "</span>" +
            '<span class="step-meta">대기</span>' +
            "</button>" +
            '<div class="step-body">' +
            body +
            "</div></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function delivHtml() {
    return (
      '<div class="deliv-grid" id="deliv">' +
      deliverables
        .map(function (d, i) {
          return (
            '<article class="deliv" data-i="' +
            i +
            '"><h3>' +
            esc(d.title) +
            '</h3><p class="placeholder">에이전트 기동 후 결과가 채워집니다. API 연결 시 동일 슬롯에 실시간 추론이 표시됩니다.</p></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }

  function boardHtml() {
    var lanes = [
      { id: "plan", title: "PLAN", items: strategies.slice(0, 3) },
      { id: "run", title: "EXECUTE", items: executions.slice(0, 3) },
      { id: "out", title: "DELIVER", items: deliverables.slice(0, 3).map(function (d) { return { title: d.title, detail: d.hint || "" }; }) }
    ];
    return (
      '<div class="board" id="board">' +
      lanes
        .map(function (lane) {
          return (
            '<div class="lane" data-lane="' +
            lane.id +
            '"><h3>' +
            lane.title +
            "</h3>" +
            lane.items
              .map(function (it, i) {
                return (
                  '<div class="lane-card" data-lane-card="' +
                  lane.id +
                  "-" +
                  i +
                  '"><strong>' +
                  esc(it.title) +
                  "</strong>" +
                  (it.detail ? "<div style=\"margin-top:.25rem;color:#94a3b8;font-size:.8rem\">" + esc(String(it.detail).slice(0, 80)) + "</div>" : "") +
                  "</div>"
                );
              })
              .join("") +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function matrixPreview() {
    var rows = (cfg.matrixRows || ["요소 A", "요소 B", "요소 C"]).slice(0, 4);
    var cols = (cfg.matrixCols || ["문헌1", "문헌2", "판단"]).slice(0, 4);
    var head = "<tr><th></th>" + cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr>";
    var body = rows
      .map(function (r) {
        return (
          "<tr><th>" +
          esc(r) +
          "</th>" +
          cols
            .map(function () {
              return '<td class="mx-cell">—</td>';
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    return '<table class="matrix-table" id="matrix"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
  }

  function coachSeed() {
    return (
      '<div class="coach-log" id="coachLog">' +
      '<div class="bubble agent"><strong>' +
      esc(cfg.name || "Agent") +
      "</strong><br>미션을 받았습니다. 입력을 확인한 뒤 전략을 수립합니다. API가 연결되면 동일 대화 슬롯에서 실시간 추론이 이어집니다.</div>" +
      "</div>"
    );
  }

  var radarBlock =
    layout === "radar"
      ? '<div class="radar-ring" aria-hidden="true"><span>' + esc(cfg.icon || "📡") + "</span></div>"
      : "";

  var inputPanel =
    '<section class="panel" id="inputPanel">' +
    "<h2><span class=\"dot\"></span> 미션 입력</h2>" +
    '<label class="field-label" for="mainInput">' +
    esc(cfg.inputLabel || "입력") +
    "</label>" +
    '<textarea id="mainInput" placeholder="' +
    esc(cfg.placeholder || "") +
    '"></textarea>' +
    toolHtml() +
    '<div class="actions">' +
    '<button type="button" class="btn" id="runBtn">▶ 에이전트 기동</button>' +
    '<button type="button" class="btn btn-ghost" id="clearBtn">초기화</button>' +
    "</div>" +
    '<p class="api-note"><strong>상태:</strong> AI API 연결 끊김 — 전략·실행 플로우는 로컬에서 시연됩니다. API가 연결되면 같은 버튼으로 실제 추론이 즉시 가동됩니다.</p>' +
    "</section>";

  var strategyPanel =
    '<section class="panel" id="strategyPanel">' +
    "<h2><span class=\"dot\"></span> 전략 수립</h2>" +
    '<div class="progress-bar" aria-hidden="true"><i id="stProgress"></i></div>' +
    (layout === "stream" || layout === "console" || layout === "coach"
      ? '<div class="think-stream" id="think"></div>'
      : '<div class="think-stream" id="think" style="min-height:64px;max-height:110px"></div>') +
    (layout === "coach" ? coachSeed() : "") +
    stepsHtml(strategies, "st", "전략 단계가 없습니다") +
    "</section>";

  var execPanel =
    '<section class="panel" id="execPanel">' +
    "<h2><span class=\"dot\"></span> 실행 파이프라인</h2>" +
    '<div class="progress-bar" aria-hidden="true"><i id="exProgress"></i></div>' +
    stepsHtml(executions, "ex", "실행 단계가 없습니다") +
    (layout === "board" ? '<div style="margin-top:.85rem">' + boardHtml() + "</div>" : "") +
    (layout === "matrix" ? '<div style="margin-top:.75rem">' + matrixPreview() + "</div>" : "") +
    "</section>";

  var outPanel =
    '<section class="panel" id="outPanel">' +
    "<h2><span class=\"dot\"></span> 산출물</h2>" +
    delivHtml() +
    "</section>";

  var workHtml = "";
  if (layout === "lab") {
    workHtml =
      '<div class="work"><div class="col-left">' +
      inputPanel +
      "</div><div class=\"col-right\">" +
      strategyPanel +
      execPanel +
      "</div></div>" +
      outPanel;
  } else if (layout === "ops") {
    workHtml =
      '<div class="work">' +
      '<div class="span-full">' +
      inputPanel +
      "</div>" +
      strategyPanel +
      execPanel +
      outPanel +
      "</div>";
  } else if (layout === "radar") {
    workHtml =
      radarBlock +
      inputPanel +
      '<div class="work">' +
      strategyPanel +
      execPanel +
      "</div>" +
      outPanel;
  } else if (layout === "board") {
    workHtml = inputPanel + strategyPanel + execPanel + outPanel;
  } else if (layout === "matrix") {
    workHtml = inputPanel + '<div class="work" style="display:grid;grid-template-columns:1fr 1fr;gap:.95rem">' + strategyPanel + execPanel + "</div>" + outPanel;
  } else if (layout === "coach") {
    workHtml = inputPanel + strategyPanel + execPanel + outPanel;
  } else if (layout === "stream" || layout === "console") {
    workHtml = inputPanel + strategyPanel + execPanel + outPanel;
  } else {
    workHtml = inputPanel + strategyPanel + execPanel + outPanel;
  }

  var root = document.getElementById("app");
  if (!root) {
    root = document.createElement("main");
    root.id = "app";
    document.body.appendChild(root);
  }

  root.innerHTML =
    '<header class="agent-head">' +
    '<div class="agent-avatar" aria-hidden="true">' +
    esc(cfg.icon || "🤖") +
    "</div>" +
    "<div>" +
    '<div class="agent-id">' +
    esc(cfg.id) +
    " · AGENT</div>" +
    "<h1>" +
    esc(cfg.title || cfg.name) +
    "</h1>" +
    '<div class="agent-role">' +
    esc(cfg.role || "IP Examination Agent") +
    "</div>" +
    '<p class="agent-mission">' +
    esc(cfg.mission || "") +
    "</p>" +
    "</div>" +
    '<div class="status-stack">' +
    '<span class="chip live">AI 연결 끊김</span>' +
    '<span class="chip">' +
    esc((cfg.domain || "IP").toUpperCase()) +
    "</span>" +
    '<span class="chip">LAYOUT · ' +
    esc(layout.toUpperCase()) +
    "</span>" +
    "</div></header>" +
    workHtml +
    '<footer class="shell-foot">App ID: ' +
    esc(cfg.id) +
    ' · <a href="index.html">아이디어 뱅크</a> · <a href="../quality.html">허브</a></footer>';

  // top bar if missing
  if (!document.querySelector(".top")) {
    var top = document.createElement("div");
    top.className = "top";
    top.innerHTML =
      '<a href="index.html">← 아이디어 뱅크</a><span class="badge-off">AI 연결 끊김</span>';
    document.body.insertBefore(top, document.body.firstChild);
  }

  var toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    toast.textContent = "AI 연결 끊김 — 로컬 시연 모드로 전략·실행 플로우를 표시합니다. API 연결 시 동일 UI에서 즉시 가동됩니다.";
    document.body.appendChild(toast);
  }

  function showToast(msg) {
    if (msg) toast.textContent = msg;
    toast.classList.add("on");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("on");
    }, 3200);
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, reduced ? Math.min(ms, 40) : ms);
    });
  }

  function setStepState(prefix, index, state) {
    var el = document.getElementById(prefix + "-" + index);
    if (!el) return;
    el.classList.remove("active", "done", "on", "open");
    var meta = el.querySelector(".step-meta");
    if (state === "active") {
      el.classList.add("on", "active", "open");
      if (meta) meta.textContent = "실행 중";
    } else if (state === "done") {
      el.classList.add("on", "done");
      if (meta) meta.textContent = "완료";
    } else if (state === "ready") {
      el.classList.add("on");
      if (meta) meta.textContent = "대기";
    }
  }

  function appendThink(line) {
    var think = document.getElementById("think");
    if (!think) return;
    var t = new Date();
    var ts =
      String(t.getHours()).padStart(2, "0") +
      ":" +
      String(t.getMinutes()).padStart(2, "0") +
      ":" +
      String(t.getSeconds()).padStart(2, "0");
    think.textContent += (think.textContent ? "\n" : "") + "[" + ts + "] " + line;
    think.scrollTop = think.scrollHeight;
  }

  function appendCoach(text, who) {
    var log = document.getElementById("coachLog");
    if (!log) return;
    var div = document.createElement("div");
    div.className = "bubble " + (who || "agent");
    div.innerHTML = who === "user" ? esc(text) : "<strong>" + esc(cfg.name || "Agent") + "</strong><br>" + esc(text);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function fillDeliverables(seed) {
    var cards = document.querySelectorAll("#deliv .deliv");
    cards.forEach(function (card, i) {
      var d = deliverables[i] || {};
      var p = card.querySelector("p");
      if (!p) return;
      p.classList.remove("placeholder");
      var body = d.sample || d.body || "";
      if (typeof body === "function") body = body(seed);
      if (!body) {
        body =
          "【시연 결과 #" +
          (i + 1) +
          "】 " +
          (d.title || "산출물") +
          "\n· 입력 반영: " +
          (seed || "(샘플 시나리오)") +
          "\n· " +
          (d.hint || "API 연결 시 이 슬롯에 모델 추론 결과가 스트리밍됩니다.") +
          "\n· 상태: 로컬 시연 완료 · 재연결 후 동일 파이프라인 가동 가능";
      } else {
        body = String(body).replace(/\{\{seed\}\}/g, seed || "샘플 시나리오");
      }
      p.textContent = body;
      card.classList.remove("reveal");
      void card.offsetWidth;
      card.classList.add("reveal");
    });
  }

  function fillMatrix(seed) {
    var cells = document.querySelectorAll("#matrix .mx-cell");
    if (!cells.length) return;
    var marks = ["△ 부분", "○ 대응", "× 없음", "◎ 핵심", "· 검토"];
    cells.forEach(function (c, i) {
      c.textContent = marks[i % marks.length];
      c.title = seed ? "seed: " + seed.slice(0, 40) : "";
    });
  }

  function lightBoard() {
    document.querySelectorAll(".lane-card").forEach(function (c, i) {
      setTimeout(function () {
        c.classList.add("on");
      }, reduced ? 0 : 120 * i);
    });
  }

  async function runAgent() {
    if (running) return;
    running = true;
    var runBtn = document.getElementById("runBtn");
    if (runBtn) runBtn.disabled = true;

    var input = document.getElementById("mainInput");
    var raw = (input && input.value ? input.value : "").trim();
    var seed = raw ? raw.slice(0, 120) : cfg.sampleSeed || "샘플 사건 시나리오";

    var think = document.getElementById("think");
    if (think) think.textContent = "";
    document.querySelectorAll(".step").forEach(function (s) {
      s.classList.remove("on", "active", "done", "open");
      var m = s.querySelector(".step-meta");
      if (m) m.textContent = "대기";
    });
    document.querySelectorAll(".lane-card").forEach(function (c) {
      c.classList.remove("on");
    });
    document.querySelectorAll("#deliv .deliv p").forEach(function (p) {
      p.className = "placeholder";
      p.textContent = "에이전트 기동 후 결과가 채워집니다. API 연결 시 동일 슬롯에 실시간 추론이 표시됩니다.";
    });

    showToast();
    appendThink("Agent boot · id=" + cfg.id);
    appendThink("API status = DISCONNECTED · switching to local rehearsal pipeline");
    appendThink("Mission ingest · chars=" + (raw ? raw.length : 0));
    if (layout === "coach") {
      appendCoach(raw || "(샘플 미션 로드)", "user");
      appendCoach("입력을 파싱했습니다. 전략 트리를 구성합니다.");
    }

    var stBar = document.getElementById("stProgress");
    var exBar = document.getElementById("exProgress");

    // Strategy phase
    for (var i = 0; i < strategies.length; i++) {
      setStepState("st", i, "active");
      if (stBar) stBar.style.width = Math.round(((i + 1) / Math.max(strategies.length, 1)) * 100) + "%";
      appendThink("STRATEGY[" + (i + 1) + "] " + strategies[i].title);
      if (strategies[i].log) appendThink("  ↳ " + strategies[i].log);
      if (layout === "coach" && strategies[i].detail) {
        appendCoach("전략 " + (i + 1) + ": " + strategies[i].title + " — " + strategies[i].detail.slice(0, 100));
      }
      await sleep(420 + (i % 3) * 80);
      setStepState("st", i, "done");
    }
    if (stBar) stBar.style.width = "100%";
    appendThink("Strategy locked · branching to execution pipeline");

    // Execution phase
    for (var j = 0; j < executions.length; j++) {
      setStepState("ex", j, "active");
      if (exBar) exBar.style.width = Math.round(((j + 1) / Math.max(executions.length, 1)) * 100) + "%";
      appendThink("EXEC[" + (j + 1) + "] " + executions[j].title);
      if (executions[j].log) appendThink("  ↳ " + executions[j].log);
      await sleep(480 + (j % 2) * 100);
      setStepState("ex", j, "done");
    }
    if (exBar) exBar.style.width = "100%";

    lightBoard();
    fillMatrix(seed);
    fillDeliverables(seed);
    appendThink("Deliverables packed · rehearsal complete");
    appendThink("Ready for live API bind · same pipeline entrypoint");
    if (layout === "coach") {
      appendCoach("실행 파이프라인을 마쳤습니다. 산출물 패널을 확인하세요. API 연결 시 이 결과가 실데이터로 교체됩니다.");
    }

    if (runBtn) runBtn.disabled = false;
    running = false;
  }

  function clearAll() {
    var input = document.getElementById("mainInput");
    if (input) input.value = "";
    var think = document.getElementById("think");
    if (think) think.textContent = "";
    ["stProgress", "exProgress"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.width = "0%";
    });
    document.querySelectorAll(".step").forEach(function (s) {
      s.classList.remove("on", "active", "done", "open");
      var m = s.querySelector(".step-meta");
      if (m) m.textContent = "대기";
    });
    document.querySelectorAll(".lane-card").forEach(function (c) {
      c.classList.remove("on");
    });
    document.querySelectorAll("#deliv .deliv p").forEach(function (p) {
      p.className = "placeholder";
      p.textContent = "에이전트 기동 후 결과가 채워집니다. API 연결 시 동일 슬롯에 실시간 추론이 표시됩니다.";
    });
    document.querySelectorAll("#matrix .mx-cell").forEach(function (c) {
      c.textContent = "—";
    });
    var log = document.getElementById("coachLog");
    if (log && layout === "coach") {
      log.innerHTML =
        '<div class="bubble agent"><strong>' +
        esc(cfg.name || "Agent") +
        "</strong><br>미션을 받았습니다. 입력을 확인한 뒤 전략을 수립합니다. API가 연결되면 동일 대화 슬롯에서 실시간 추론이 이어집니다.</div>";
    }
  }

  document.getElementById("runBtn").addEventListener("click", function () {
    runAgent();
  });
  document.getElementById("clearBtn").addEventListener("click", clearAll);

  document.getElementById("app").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-toggle]");
    if (!btn) return;
    var id = btn.getAttribute("data-toggle");
    var step = document.getElementById(id);
    if (!step || !step.classList.contains("on")) return;
    step.classList.toggle("open");
  });
  } catch (err) {
    console.error(err);
    showFatal((err && err.message) || String(err));
  }
})();
