(function () {
  var toast = document.getElementById('toast');
  var runBtn = document.getElementById('runBtn');
  var clearBtn = document.getElementById('clearBtn');
  var mainInput = document.getElementById('mainInput');
  var timer = null;

  function showToast() {
    if (!toast) return;
    toast.classList.add('on');
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      toast.classList.remove('on');
    }, 2800);
  }

  function fillDemo() {
    var text = (mainInput && mainInput.value ? mainInput.value : '').trim();
    var seed = text ? text.slice(0, 90) : '(입력 없음 — 샘플 시나리오)';
    var cards = document.querySelectorAll('#out .out-card p');
    cards.forEach(function (p, i) {
      p.className = '';
      p.textContent = '[시연 #' + (i + 1) + '] ' + seed + ' … / AI 연결 끊김 · API 연결 시 동일 슬롯에서 실추론 가동';
    });
    showToast();
  }

  function clearAll() {
    if (mainInput) mainInput.value = '';
    document.querySelectorAll('#out .out-card p').forEach(function (p) {
      p.className = 'placeholder';
      p.textContent = '실행 후 시연 결과가 표시됩니다. (AI 연결 끊김 · API 연결 시 즉시 가동)';
    });
  }

  if (runBtn) runBtn.addEventListener('click', fillDemo);
  if (clearBtn) clearBtn.addEventListener('click', clearAll);
})();
