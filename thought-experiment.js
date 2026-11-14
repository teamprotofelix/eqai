(() => {
    // The first AION — The Between experiment, adapted to a single responsive panel.
    // Source: Creative_LAB/AION_THE_BETWEEN/app.js (rebranch, chooseBranch, paintChoice).
    const canvas = document.getElementById('experimentGraph');
    let ctx;
    try { ctx = canvas.getContext('2d'); } catch { return; }
    if (!ctx) return;

    const panel = canvas.closest('.experiment-panel');
    const status = document.getElementById('experimentStatus');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const messages = {
        ko: ['나뭇가지 끝의 빛을 눌러 하나의 경로를 밝혀 보세요.', '하나의 길이 밝혀졌습니다. 다른 127개의 끝도 남아 있습니다.', '모든 가능성이 다시 펼쳐졌습니다.'],
        en: ['Touch a star at the tip of a branch to light one path.', 'One path is lit. The other 127 endings are still there.', 'All possibilities are open again.'],
        ja: ['枝先の光を選んで、一つの経路を照らしてください。', '一つの経路が光りました。残り127の結末もここにあります。', 'すべての可能性が再び開きました。']
    };
    let nodes;
    let leaves;
    let width, height, scaleX, scaleY, offsetX, offsetY;
    let seed = 60;
    let chosen = null;
    let preview = null;
    let keyboardIndex = -1;
    let message = 0;
    let animation = 0;
    let visible = false;

    function announce(next) {
        message = next;
        status.textContent = (messages[document.documentElement.lang] || messages.ko)[next];
    }

    function growTree() {
        let state = seed;
        function random() {
            state = (state + 0x6d2b79f5) >>> 0;
            let value = Math.imul(state ^ (state >>> 15), state | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        }
        nodes = [];
        leaves = [];
        function grow(x, y, angle, length, depth, parent) {
            const node = { x, y, depth, parent, phase: nodes.length * 2.399963 };
            nodes.push(node);
            if (depth === 7) {
                leaves.push(node);
                return;
            }
            for (const side of [-1, 1]) {
                const next = angle + side * (.31 + random() * .18);
                grow(x + Math.cos(next) * length, y + Math.sin(next) * length,
                    next, length * (.755 + random() * .024), depth + 1, node);
            }
        }
        grow(0, 0, 0, 108, 0, null);
        leaves.sort((a, b) => a.y - b.y);
    }

    function fitTree() {
        const ys = nodes.map(node => node.y);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const maxX = Math.max(...nodes.map(node => node.x));
        const compact = width < 500;
        scaleX = width * (compact ? .8 : .52) / maxX;
        scaleY = height * .84 / (maxY - minY);
        offsetX = width * (compact ? .10 : .15);
        offsetY = height * .47 - (minY + maxY) / 2 * scaleY;
    }

    function draw(now = 0) {
        const time = motion.matches ? 0 : now / 1000;
        ctx.clearRect(0, 0, width, height);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#b4d8dc0d';
        const step = width < 500 ? 34 : 65;
        ctx.beginPath();
        for (let x = step; x < width; x += step) {
            ctx.moveTo(x + .5, 18);
            ctx.lineTo(x + .5, height - 18);
        }
        for (let y = step; y < height; y += step) {
            ctx.moveTo(18, y + .5);
            ctx.lineTo(width - 18, y + .5);
        }
        ctx.stroke();

        ctx.fillStyle = '#a2c5c73e';
        for (let i = 1; i <= 53; i++) {
            ctx.fillRect((i * .618033989 % 1) * width, (i * .754877666 % 1) * height, 1, 1);
        }
        const active = preview || chosen;
        const path = new Set();
        for (let node = active; node; node = node.parent) path.add(node);

        // Paint dim branches first so the selected route remains legible at crossings.
        for (const highlighted of [false, true]) {
            for (const node of nodes) {
                const parent = node.parent;
                if (!parent || path.has(node) !== highlighted) continue;
                const x = offsetX + node.x * scaleX;
                const y = offsetY + node.y * scaleY;
                const px = offsetX + parent.x * scaleX;
                const py = offsetY + parent.y * scaleY;
                ctx.strokeStyle = highlighted ? '#a8e3d6' : active ? '#81cbc326'
                    : 'rgba(129,203,195,' + (.29 - node.depth * .028) + ')';
                ctx.lineWidth = highlighted ? 2 : Math.max(.55, 1.5 - node.depth * .13);
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.quadraticCurveTo((x + px) / 2, (y + py) / 2 + (y - py) * .1, x, y);
                ctx.stroke();
            }
        }

        for (const leaf of leaves) {
            const selected = leaf === active;
            ctx.fillStyle = selected ? '#fff4d7' : active ? '#93b4ac50' : '#9ddbcfb8';
            ctx.shadowBlur = selected ? 13 : 0;
            ctx.shadowColor = '#bef9ed';
            ctx.beginPath();
            ctx.arc(offsetX + leaf.x * scaleX, offsetY + leaf.y * scaleY,
                selected ? 4.3 : (width < 500 ? 1.45 : 2.1) + .35 * Math.sin(time * 1.3 + leaf.phase), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#e4cdaa';
        ctx.beginPath();
        ctx.arc(offsetX, offsetY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '12px Georgia, serif';
        ctx.fillStyle = '#9eafb6';
        ctx.fillText('ORIGIN', Math.max(12, offsetX - 40), offsetY + 24);
        if (!active && width >= 620) {
            ctx.fillStyle = '#7faeab';
            ctx.fillText('128 FUTURES', width * .8, height * .77);
        }
    }

    function resize() {
        const parent = canvas.parentElement;
        width = parent.clientWidth;
        height = parent.clientHeight;
        const dpr = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        fitTree();
        draw();
    }

    function findStar(event) {
        const rect = canvas.getBoundingClientRect();
        let nearest = null;
        let max = (event.pointerType === 'touch' ? 27 : 16) ** 2;
        for (const leaf of leaves) {
            const dx = event.clientX - rect.left - offsetX - leaf.x * scaleX;
            const dy = event.clientY - rect.top - offsetY - leaf.y * scaleY;
            const distance = dx * dx + dy * dy;
            if (distance < max) {
                nearest = leaf;
                max = distance;
            }
        }
        return nearest;
    }

    function select(leaf) {
        if (!leaf) return;
        chosen = leaf;
        preview = null;
        keyboardIndex = leaves.indexOf(leaf);
        announce(1);
        draw();
    }

    canvas.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch') return;
        const leaf = findStar(event);
        if (preview === leaf) return;
        preview = leaf;
        canvas.style.cursor = preview ? 'pointer' : '';
        draw();
    });
    canvas.addEventListener('pointerleave', () => {
        preview = null;
        draw();
    });
    canvas.addEventListener('pointerup', event => {
        if (event.button === 0) select(findStar(event));
    });
    canvas.addEventListener('keydown', event => {
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
        if (step) {
            event.preventDefault();
            keyboardIndex = keyboardIndex < 0 ? Math.floor(leaves.length / 2)
                : (keyboardIndex + step + leaves.length) % leaves.length;
            preview = leaves[keyboardIndex];
            draw();
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            select(leaves[keyboardIndex < 0 ? Math.floor(leaves.length / 2) : keyboardIndex]);
        }
    });
    canvas.addEventListener('blur', () => {
        preview = null;
        draw();
    });

    document.getElementById('experimentReset').addEventListener('click', () => {
        seed += 41;
        chosen = preview = null;
        keyboardIndex = -1;
        growTree();
        fitTree();
        announce(2);
        draw();
    });
    document.addEventListener('eqai:cards-rendered', () => announce(message));

    function syncAnimation() {
        clearInterval(animation);
        if (visible && !document.hidden && !motion.matches) {
            animation = setInterval(() => draw(performance.now()), 100);
        } else {
            draw();
        }
    }

    growTree();
    panel.classList.add('is-ready');
    announce(0);
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', syncAnimation);
    motion.addEventListener('change', syncAnimation);
    try {
        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            syncAnimation();
        });
        observer.observe(canvas);
    } catch {
        // Pointer and keyboard selection still redraw the graph.
    }
})();
